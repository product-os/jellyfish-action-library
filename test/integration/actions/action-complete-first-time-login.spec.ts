import { strict as assert } from 'assert';
import { defaultEnvironment } from '@balena/jellyfish-environment';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { WorkerContext } from '@balena/jellyfish-types/build/worker';
import nock from 'nock';
import { makeRequest } from './helpers';
import ActionLibrary from '../../../lib';
import { actionCompleteFirstTimeLogin } from '../../../lib/actions/action-complete-first-time-login';
import { PASSWORDLESS_USER_HASH } from '../../../lib/actions/constants';

const MAIL_OPTIONS = defaultEnvironment.mail.options;
let balenaOrg: any;

const handler = actionCompleteFirstTimeLogin.handler;
let ctx: integrationHelpers.IntegrationTestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await integrationHelpers.before([
		DefaultPlugin,
		ActionLibrary,
		ProductOsPlugin,
	]);
	actionContext = ctx.worker.getActionContext({
		id: `test-${ctx.generateRandomID()}`,
	});

	// Get org and add test user as member
	balenaOrg = await ctx.jellyfish.getCardBySlug(
		ctx.context,
		ctx.session,
		'org-balena@1.0.0',
	);
	assert(balenaOrg);
	await ctx.createLink(
		ctx.actor.id,
		ctx.session,
		ctx.actor,
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
	return integrationHelpers.after(ctx);
});

afterEach(async () => {
	nock.cleanAll();
});

describe('action-complete-first-time-login', () => {
	test("should update the user's password when the firstTimeLoginToken is valid", async () => {
		const user = await ctx.createUser(
			ctx.generateRandomWords(1),
			PASSWORDLESS_USER_HASH,
		);
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
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

		const newPassword = ctx.generateRandomID();
		const completeFirstTimeLoginAction = await ctx.worker.pre(ctx.session, {
			action: 'action-complete-first-time-login@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {
				firstTimeLoginToken: match.data.firstTimeLoginToken,
				newPassword,
			},
		});
		await ctx.processAction(user.session, completeFirstTimeLoginAction);

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			user.contract.id,
		);
		assert(updated);
		expect(updated.data.hash).not.toEqual(PASSWORDLESS_USER_HASH);
	});

	test('should fail when the first-time login does not match a valid card', async () => {
		const user = await ctx.createUser(ctx.generateRandomWords(1));
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		const fakeToken = ctx.generateRandomID();
		await expect(
			ctx.processAction(ctx.session, {
				action: 'action-complete-first-time-login@1.0.0',
				context: ctx.context,
				card: user.contract.id,
				type: user.contract.type,
				arguments: {
					firstTimeLoginToken: fakeToken,
					newPassword: ctx.generateRandomID(),
				},
			}),
		).rejects.toThrow(ctx.worker.errors.WorkerAuthenticationError);
	});

	test('should fail when the first-time login token has expired', async () => {
		const user = await ctx.createUser(ctx.generateRandomWords(1));
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
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
							const: user.contract.id,
						},
					},
				},
			},
		});

		const now = new Date();
		const hourInPast = now.setHours(now.getHours() - 1);
		await ctx.worker.patchCard(
			ctx.context,
			ctx.session,
			ctx.worker.typeContracts[match.type],
			{
				attachEvents: true,
				actor: ctx.actor.id,
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
				context: ctx.context,
				card: user.contract.id,
				type: user.contract.type,
				arguments: {
					firstTimeLoginToken: match.data.firstTimeLoginToken,
					newPassword: ctx.generateRandomID(),
				},
			}),
		).rejects.toThrow(ctx.worker.errors.WorkerAuthenticationError);
	});

	test('should fail when the first-time login is not active', async () => {
		const user = await ctx.createUser(ctx.generateRandomWords(1));
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
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
							const: user.contract.id,
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
			context: ctx.context,
			card: match.id,
			type: match.type,
			arguments: {},
		});

		await expect(
			ctx.processAction(ctx.session, {
				action: 'action-complete-first-time-login@1.0.0',
				context: ctx.context,
				card: user.contract.id,
				type: user.contract.type,
				arguments: {
					firstTimeLoginToken: match.data.firstTimeLoginToken,
					newPassword: ctx.generateRandomID(),
				},
			}),
		).rejects.toThrow(ctx.worker.errors.WorkerAuthenticationError);
	});

	test('should fail if the user becomes inactive between requesting and completing the first-time login', async () => {
		const user = await ctx.createUser(
			ctx.generateRandomWords(1),
			PASSWORDLESS_USER_HASH,
		);
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {},
		});

		await ctx.processAction(ctx.session, {
			action: 'action-delete-card@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
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

		const newPassword = ctx.generateRandomID();
		const completeFirstTimeLoginAction = await ctx.worker.pre(ctx.session, {
			action: 'action-complete-first-time-login@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {
				firstTimeLoginToken: match.data.firstTimeLoginToken,
				newPassword,
			},
		});

		await expect(
			ctx.processAction(user.session, completeFirstTimeLoginAction),
		).rejects.toThrow(ctx.worker.errors.WorkerNoElement);
	});

	test('should invalidate the first-time-login card', async () => {
		const user = await ctx.createUser(
			ctx.generateRandomWords(1),
			PASSWORDLESS_USER_HASH,
		);
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {
				username: user.contract.slug,
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
							const: user.contract.id,
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
			user.contract,
			makeRequest(ctx, {
				firstTimeLoginToken: firstTimeLogin.data.firstTimeLoginToken,
				newPassword: ctx.generateRandomID(),
			}),
		);

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			firstTimeLogin.id,
		);
		assert(updated);
		expect(updated.active).toBe(false);
	});

	test('should throw an error when the user already has a password set', async () => {
		const user = await ctx.createUser(
			ctx.generateRandomWords(1),
			ctx.generateRandomID(),
		);
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
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
							const: user.contract.id,
						},
					},
				},
			},
		});

		await expect(
			ctx.processAction(ctx.session, {
				action: 'action-complete-first-time-login@1.0.0',
				context: ctx.context,
				card: user.contract.id,
				type: user.contract.type,
				arguments: {
					firstTimeLoginToken: match.data.firstTimeLoginToken,
					newPassword: ctx.generateRandomID(),
				},
			}),
		).rejects.toThrow(ctx.worker.errors.WorkerAuthenticationError);
	});
});
