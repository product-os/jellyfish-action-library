import { strict as assert } from 'assert';
import { testUtils as coreTestUtils } from '@balena/jellyfish-core';
import { defaultEnvironment } from '@balena/jellyfish-environment';
import {
	errors as workerErrors,
	testUtils as workerTestUtils,
	WorkerContext,
} from '@balena/jellyfish-worker';
import nock from 'nock';
import { actionLibrary } from '../../../lib';
import { actionCompleteFirstTimeLogin } from '../../../lib/actions/action-complete-first-time-login';
import { PASSWORDLESS_USER_HASH } from '../../../lib/actions/constants';
import { makeHandlerRequest } from './helpers';

const MAIL_OPTIONS = defaultEnvironment.mail.options;
let balenaOrg: any;

const handler = actionCompleteFirstTimeLogin.handler;
let ctx: workerTestUtils.TestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await workerTestUtils.newContext({
		plugins: [actionLibrary],
	});
	actionContext = ctx.worker.getActionContext({
		id: `test-${coreTestUtils.generateRandomId()}`,
	});

	// Get org and add test user as member
	balenaOrg = await ctx.kernel.getCardBySlug(
		ctx.logContext,
		ctx.session,
		'org-balena@1.0.0',
	);
	assert(balenaOrg);
	await ctx.createLink(
		ctx.adminUserId,
		ctx.session,
		(await ctx.kernel.getContractById(
			ctx.logContext,
			ctx.session,
			ctx.adminUserId,
		))!,
		balenaOrg,
		'is member of',
		'has member',
	);

	nock(`${MAIL_OPTIONS!.baseUrl}/${MAIL_OPTIONS!.domain}`)
		.persist()
		.post('/messages')
		.basicAuth({
			user: 'api',
			pass: MAIL_OPTIONS!.token,
		})
		.reply(200);
});

afterAll(async () => {
	return workerTestUtils.destroyContext(ctx);
});

afterEach(async () => {
	nock.cleanAll();
});

describe('action-complete-first-time-login', () => {
	test("should update the user's password when the firstTimeLoginToken is valid", async () => {
		const user = await ctx.createUser(
			coreTestUtils.generateRandomSlug(),
			PASSWORDLESS_USER_HASH,
		);
		const session = await ctx.createSession(user);
		await ctx.createLink(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			logContext: ctx.logContext,
			card: user.id,
			type: user.type,
			arguments: {},
		});

		const match = await ctx.waitForMatch({
			type: 'object',
			properties: {
				type: {
					type: 'string',
					const: 'first-time-login@1.0.0',
				},
			},
		});

		const newPassword = coreTestUtils.generateRandomId();
		const completeFirstTimeLoginAction = (await ctx.worker.pre(ctx.session, {
			action: 'action-complete-first-time-login@1.0.0',
			logContext: ctx.logContext,
			card: user.id,
			type: user.type,
			arguments: {
				firstTimeLoginToken: match.data.firstTimeLoginToken,
				newPassword,
			},
		})) as any;
		completeFirstTimeLoginAction.logContext =
			completeFirstTimeLoginAction.context;
		await ctx.processAction(session.id, completeFirstTimeLoginAction);

		const updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.hash).not.toEqual(PASSWORDLESS_USER_HASH);
	});

	test('should fail when the first-time login does not match a valid card', async () => {
		const user = await ctx.createUser(coreTestUtils.generateRandomSlug());
		await ctx.createLink(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		const fakeToken = coreTestUtils.generateRandomId();
		await expect(
			ctx.processAction(ctx.session, {
				action: 'action-complete-first-time-login@1.0.0',
				logContext: ctx.logContext,
				card: user.id,
				type: user.type,
				arguments: {
					firstTimeLoginToken: fakeToken,
					newPassword: coreTestUtils.generateRandomId(),
				},
			}),
		).rejects.toThrow(workerErrors.WorkerAuthenticationError);
	});

	test('should fail when the first-time login token has expired', async () => {
		const user = await ctx.createUser(coreTestUtils.generateRandomSlug());
		await ctx.createLink(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			logContext: ctx.logContext,
			card: user.id,
			type: user.type,
			arguments: {},
		});

		const match = await ctx.waitForMatch({
			type: 'object',
			additionalProperties: true,
			properties: {
				type: {
					type: 'string',
					const: 'first-time-login@1.0.0',
				},
			},
			$$links: {
				'is attached to': {
					type: 'object',
					properties: {
						id: {
							type: 'string',
							const: user.id,
						},
					},
				},
			},
		});

		const now = new Date();
		const hourInPast = now.setHours(now.getHours() - 1);
		await ctx.worker.patchCard(
			ctx.logContext,
			ctx.session,
			ctx.worker.typeContracts[match.type],
			{
				attachEvents: true,
				actor: ctx.adminUserId,
			},
			match,
			[
				{
					op: 'replace',
					path: '/data/expiresAt',
					value: new Date(hourInPast).toISOString(),
				},
			],
		);
		await ctx.flushAll(ctx.session);

		await expect(
			ctx.processAction(ctx.session, {
				action: 'action-complete-first-time-login@1.0.0',
				logContext: ctx.logContext,
				card: user.id,
				type: user.type,
				arguments: {
					firstTimeLoginToken: match.data.firstTimeLoginToken,
					newPassword: coreTestUtils.generateRandomId(),
				},
			}),
		).rejects.toThrow(workerErrors.WorkerAuthenticationError);
	});

	test('should fail when the first-time login is not active', async () => {
		const user = await ctx.createUser(coreTestUtils.generateRandomSlug());
		await ctx.createLink(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			logContext: ctx.logContext,
			card: user.id,
			type: user.type,
			arguments: {},
		});

		const match = await ctx.waitForMatch({
			type: 'object',
			$$links: {
				'is attached to': {
					type: 'object',
					required: ['id'],
					properties: {
						id: {
							type: 'string',
							const: user.id,
						},
					},
				},
			},
			properties: {
				type: {
					type: 'string',
					const: 'first-time-login@1.0.0',
				},
			},
		});

		await ctx.processAction(ctx.session, {
			action: 'action-delete-card@1.0.0',
			logContext: ctx.logContext,
			card: match.id,
			type: match.type,
			arguments: {},
		});

		await expect(
			ctx.processAction(ctx.session, {
				action: 'action-complete-first-time-login@1.0.0',
				logContext: ctx.logContext,
				card: user.id,
				type: user.type,
				arguments: {
					firstTimeLoginToken: match.data.firstTimeLoginToken,
					newPassword: coreTestUtils.generateRandomId(),
				},
			}),
		).rejects.toThrow(workerErrors.WorkerAuthenticationError);
	});

	test('should fail if the user becomes inactive between requesting and completing the first-time login', async () => {
		const user = await ctx.createUser(
			coreTestUtils.generateRandomSlug(),
			PASSWORDLESS_USER_HASH,
		);
		const session = await ctx.createSession(user);
		await ctx.createLink(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			logContext: ctx.logContext,
			card: user.id,
			type: user.type,
			arguments: {},
		});

		await ctx.processAction(ctx.session, {
			action: 'action-delete-card@1.0.0',
			logContext: ctx.logContext,
			card: user.id,
			type: user.type,
			arguments: {},
		});

		const match = await ctx.waitForMatch({
			type: 'object',
			properties: {
				type: {
					type: 'string',
					const: 'first-time-login@1.0.0',
				},
			},
		});

		const newPassword = coreTestUtils.generateRandomId();
		const completeFirstTimeLoginAction = (await ctx.worker.pre(ctx.session, {
			action: 'action-complete-first-time-login@1.0.0',
			logContext: ctx.logContext,
			card: user.id,
			type: user.type,
			arguments: {
				firstTimeLoginToken: match.data.firstTimeLoginToken,
				newPassword,
			},
		})) as any;
		completeFirstTimeLoginAction.logContext =
			completeFirstTimeLoginAction.context;

		await expect(
			ctx.processAction(session.id, completeFirstTimeLoginAction),
		).rejects.toThrow(workerErrors.WorkerNoElement);
	});

	test('should invalidate the first-time-login card', async () => {
		const user = await ctx.createUser(
			coreTestUtils.generateRandomSlug(),
			PASSWORDLESS_USER_HASH,
		);
		await ctx.createLink(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			logContext: ctx.logContext,
			card: user.id,
			type: user.type,
			arguments: {
				username: user.slug,
			},
		});

		const firstTimeLogin = await ctx.waitForMatch({
			type: 'object',
			$$links: {
				'is attached to': {
					type: 'object',
					required: ['id'],
					properties: {
						id: {
							type: 'string',
							const: user.id,
						},
					},
				},
			},
			properties: {
				type: {
					type: 'string',
					const: 'first-time-login@1.0.0',
				},
			},
			required: ['type'],
			additionalProperties: true,
		});

		// Execute action and check that the first time login contract was invalidated
		await handler(
			ctx.session,
			actionContext,
			user,
			makeHandlerRequest(ctx, actionCompleteFirstTimeLogin.contract, {
				firstTimeLoginToken: firstTimeLogin.data.firstTimeLoginToken,
				newPassword: coreTestUtils.generateRandomId(),
			}),
		);

		const updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			firstTimeLogin.id,
		);
		assert(updated);
		expect(updated.active).toBe(false);
	});

	test('should throw an error when the user already has a password set', async () => {
		const user = await ctx.createUser(
			coreTestUtils.generateRandomSlug(),
			coreTestUtils.generateRandomId(),
		);
		await ctx.createLink(
			ctx.adminUserId,
			ctx.session,
			user,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			logContext: ctx.logContext,
			card: user.id,
			type: user.type,
			arguments: {},
		});

		const match = await ctx.waitForMatch({
			type: 'object',
			properties: {
				type: {
					type: 'string',
					const: 'first-time-login@1.0.0',
				},
			},
			$$links: {
				'is attached to': {
					type: 'object',
					properties: {
						id: {
							type: 'string',
							const: user.id,
						},
					},
				},
			},
		});

		await expect(
			ctx.processAction(ctx.session, {
				action: 'action-complete-first-time-login@1.0.0',
				logContext: ctx.logContext,
				card: user.id,
				type: user.type,
				arguments: {
					firstTimeLoginToken: match.data.firstTimeLoginToken,
					newPassword: coreTestUtils.generateRandomId(),
				},
			}),
		).rejects.toThrow(workerErrors.WorkerAuthenticationError);
	});
});
