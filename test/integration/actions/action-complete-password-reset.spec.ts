import { defaultEnvironment } from '@balena/jellyfish-environment';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { strict as assert } from 'assert';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import nock from 'nock';
import ActionLibrary from '../../../lib';
import { actionCompletePasswordReset } from '../../../lib/actions/action-complete-password-reset';
import { makeRequest } from './helpers';

const ACTIONS = defaultEnvironment.actions;
const MAIL_OPTIONS = defaultEnvironment.mail.options;
let balenaOrg: any;
const hash = 'foobar';
const resetToken = crypto
	.createHmac('sha256', ACTIONS.resetPasswordSecretToken)
	.update(hash)
	.digest('hex');

const pre = actionCompletePasswordReset.pre;
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
});

afterAll(async () => {
	return integrationHelpers.after(ctx);
});

beforeEach(async () => {
	nock(`${MAIL_OPTIONS!.baseUrl}/${MAIL_OPTIONS!.domain}`)
		.persist()
		.post('/messages')
		.basicAuth({
			user: 'api',
			pass: MAIL_OPTIONS!.token,
		})
		.reply(200);
});

afterEach(() => {
	nock.cleanAll();
});

describe('action-complete-password-reset', () => {
	test('should hash new password', async () => {
		const plaintext = ctx.generateRandomID();
		const request = makeRequest(ctx, {
			newPassword: plaintext,
		});

		expect.hasAssertions();
		if (pre) {
			const result = await pre(ctx.session, actionContext, request);
			if (!isNull(result) && !isArray(result)) {
				const match = await bcrypt.compare(plaintext, result.newPassword);
				expect(match).toBe(true);
			}
		}
	});

	test('should replace the user password when the requestToken is valid', async () => {
		const username = ctx.generateRandomWords(1);
		const user = await ctx.createUser(username, hash);

		const passwordReset = await ctx.processAction(ctx.session, {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {
				username,
			},
		});
		expect(passwordReset.error).toBe(false);

		const completePasswordReset = await ctx.worker.pre(ctx.session, {
			action: 'action-complete-password-reset@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {
				resetToken,
				newPassword: ctx.generateRandomID(),
			},
		});
		const completePasswordResetResult = await ctx.processAction(
			user.session,
			completePasswordReset,
		);
		expect(completePasswordResetResult.error).toBe(false);

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			user.contract.id,
		);
		assert(updated);
		expect(updated.data.hash).not.toEqual(hash);
	});

	test('should fail when the reset token does not match a valid card', async () => {
		const user = await ctx.createUser(ctx.generateRandomWords(1));

		const completePasswordReset = await ctx.worker.pre(ctx.session, {
			action: 'action-complete-password-reset@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {
				resetToken: 'fake-reset-token',
				newPassword: ctx.generateRandomID(),
			},
		});

		await expect(
			ctx.processAction(ctx.session, completePasswordReset),
		).rejects.toThrow(ctx.worker.errors.WorkerSchemaMismatch);
	});

	test('should fail when the reset token has expired', async () => {
		const username = ctx.generateRandomWords(1);
		const user = await ctx.createUser(username, hash);

		await ctx.processAction(ctx.session, {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {
				username,
			},
		});

		const match = await ctx.waitForMatch({
			type: 'object',
			required: ['id', 'type'],
			additionalProperties: true,
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
				id: {
					type: 'string',
				},
				type: {
					type: 'string',
					const: 'password-reset@1.0.0',
				},
				data: {
					type: 'object',
					additionalProperties: true,
					properties: {
						resetToken: {
							type: 'string',
							const: resetToken,
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

		const completePasswordReset = await ctx.worker.pre(ctx.session, {
			action: 'action-complete-password-reset@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {
				resetToken,
				newPassword: ctx.generateRandomID(),
			},
		});

		await expect(
			ctx.processAction(ctx.session, completePasswordReset),
		).rejects.toThrow(ctx.worker.errors.WorkerAuthenticationError);
	});

	test('should fail when the reset token is not active', async () => {
		const username = ctx.generateRandomWords(1);
		const user = await ctx.createUser(username, hash);
		await ctx.processAction(ctx.session, {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {
				username,
			},
		});

		const match = await ctx.waitForMatch({
			type: 'object',
			required: ['id', 'type'],
			additionalProperties: true,
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
				id: {
					type: 'string',
				},
				type: {
					type: 'string',
					const: 'password-reset@1.0.0',
				},
				data: {
					type: 'object',
					additionalProperties: true,
					properties: {
						resetToken: {
							type: 'string',
							const: resetToken,
						},
					},
				},
			},
		});

		const requestDelete = await ctx.processAction(ctx.session, {
			action: 'action-delete-card@1.0.0',
			context: ctx.context,
			card: match.id,
			type: match.type,
			arguments: {},
		});
		expect(requestDelete.error).toBe(false);

		const completePasswordReset = await ctx.worker.pre(ctx.session, {
			action: 'action-complete-password-reset@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {
				resetToken,
				newPassword: ctx.generateRandomID(),
			},
		});

		await expect(
			ctx.processAction(ctx.session, completePasswordReset),
		).rejects.toThrow(ctx.worker.errors.WorkerAuthenticationError);
	});

	test('should fail if the user becomes inactive between requesting and completing the password reset', async () => {
		const username = ctx.generateRandomWords(1);
		const user = await ctx.createUser(username, hash);
		const requestPasswordReset = await ctx.processAction(ctx.session, {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {
				username,
			},
		});
		expect(requestPasswordReset.error).toBe(false);

		const requestDelete = await ctx.processAction(ctx.session, {
			action: 'action-delete-card@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {},
		});
		expect(requestDelete.error).toBe(false);

		const completePasswordReset = await ctx.worker.pre(ctx.session, {
			action: 'action-complete-password-reset@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {
				resetToken,
				newPassword: ctx.generateRandomID(),
			},
		});

		await expect(
			ctx.processAction(ctx.session, completePasswordReset),
		).rejects.toThrow(ctx.worker.errors.WorkerAuthenticationError);
	});

	test('should soft delete password reset card', async () => {
		const username = ctx.generateRandomWords(1);
		const user = await ctx.createUser(username, hash);

		const requestPasswordReset = await ctx.processAction(ctx.session, {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {
				username,
			},
		});
		expect(requestPasswordReset.error).toBe(false);

		const completePasswordReset = await ctx.worker.pre(ctx.session, {
			action: 'action-complete-password-reset@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {
				resetToken,
				newPassword: ctx.generateRandomID(),
			},
		});
		await ctx.processAction(ctx.session, completePasswordReset);

		await ctx.waitForMatch({
			type: 'object',
			required: ['type', 'active', 'data'],
			additionalProperties: true,
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
					const: 'password-reset@1.0.0',
				},
				active: {
					type: 'boolean',
					const: false,
				},
				data: {
					type: 'object',
					properties: {
						resetToken: {
							type: 'string',
							const: resetToken,
						},
					},
					required: ['resetToken'],
				},
			},
		});
	});
});
