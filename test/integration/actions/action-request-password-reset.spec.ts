/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { defaultEnvironment } from '@balena/jellyfish-environment';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { strict as assert } from 'assert';
import nock from 'nock';
import ActionLibrary from '../../../lib';
import { PASSWORDLESS_USER_HASH } from '../../../lib/actions/constants';
import { includes } from './helpers';

const MAIL_OPTIONS = defaultEnvironment.mail.options;
let mailBody: string = '';
let balenaOrg: any;

let ctx: integrationHelpers.IntegrationTestContext;

beforeAll(async () => {
	ctx = await integrationHelpers.before([
		DefaultPlugin,
		ActionLibrary,
		ProductOsPlugin,
	]);

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

afterEach(() => {
	nock.cleanAll();
});

function nockRequest() {
	nock(`${MAIL_OPTIONS!.baseUrl}/${MAIL_OPTIONS!.domain}`)
		.persist()
		.post('/messages')
		.basicAuth({
			user: 'api',
			pass: MAIL_OPTIONS!.token,
		})
		.reply(200, (_uri: string, requestBody: string) => {
			mailBody = requestBody;
		});
}

describe('action-request-password-reset', () => {
	test('should create a password reset card and user link when arguments match a valid user', async () => {
		nockRequest();
		const username = ctx.generateRandomWords(1);
		const user = await ctx.createUser(username);
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

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

		await ctx.waitForMatch({
			type: 'object',
			required: ['type'],
			additionalProperties: true,
			properties: {
				type: {
					type: 'string',
					const: 'password-reset@1.0.0',
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
	});

	test('should send a password-reset email when the username in the argument matches a valid user', async () => {
		mailBody = '';
		nockRequest();
		const username = ctx.generateRandomWords(1);
		const user = await ctx.createUser(username);
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);
		const email = (user.contract.data as any).email[0];

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

		const match = await ctx.waitForMatch({
			type: 'object',
			required: ['type', 'data'],
			additionalProperties: false,
			properties: {
				type: {
					type: 'string',
					const: 'password-reset@1.0.0',
				},
				data: {
					type: 'object',
					properties: {
						resetToken: {
							type: 'string',
						},
					},
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

		const resetPasswordUrl = `https://jel.ly.fish/password_reset/${match.data.resetToken}/${username}`;
		const expectedEmailBody = `<p>Hello,</p><p>We have received a password reset request for the Jellyfish account attached to this email.</p><p>Please use the link below to reset your password:</p><a href="${resetPasswordUrl}">${resetPasswordUrl}</a><p>Cheers</p><p>Jellyfish Team</p><a href="https://jel.ly.fish">https://jel.ly.fish</a>`;

		expect(includes('to', email, mailBody)).toBe(true);
		expect(includes('from', 'no-reply@mail.ly.fish', mailBody)).toBe(true);
		expect(includes('subject', 'Jellyfish Password Reset', mailBody)).toBe(
			true,
		);
		expect(includes('html', expectedEmailBody, mailBody)).toBe(true);
	});

	test('should fail silently if the username does not match a user', async () => {
		nockRequest();
		const user = await ctx.createUser(ctx.generateRandomWords(1));
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		const requestPasswordReset = await ctx.processAction(ctx.session, {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {
				username: ctx.generateRandomWords(1),
			},
		});
		expect(requestPasswordReset.error).toBe(false);

		await expect(
			ctx.waitForMatch(
				{
					type: 'object',
					required: ['type'],
					additionalProperties: false,
					properties: {
						type: {
							type: 'string',
							const: 'password-reset@1.0.0',
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
				},
				3,
			),
		).rejects.toThrow(new Error('The wait query did not resolve'));
	});

	test('should fail silently if the user is inactive', async () => {
		nockRequest();
		const username = ctx.generateRandomWords(1);
		const user = await ctx.createUser(username);
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		const requestDelete = await ctx.processAction(ctx.session, {
			action: 'action-delete-card@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {},
		});
		expect(requestDelete.error).toBe(false);

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

		await expect(
			ctx.waitForMatch(
				{
					type: 'object',
					required: ['type'],
					additionalProperties: false,
					properties: {
						type: {
							type: 'string',
							const: 'password-reset@1.0.0',
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
				},
				3,
			),
		).rejects.toThrow(new Error('The wait query did not resolve'));
	});

	test('should fail silently if the user does not have a hash', async () => {
		nockRequest();
		const username = ctx.generateRandomWords(1);
		const user = await ctx.createUser(username, PASSWORDLESS_USER_HASH);
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

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

		await expect(
			ctx.waitForMatch(
				{
					type: 'object',
					required: ['type'],
					additionalProperties: false,
					properties: {
						type: {
							type: 'string',
							const: 'password-reset@1.0.0',
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
				},
				3,
			),
		).rejects.toThrow(new Error('The wait query did not resolve'));
	});

	test('should invalidate previous password reset requests', async () => {
		nockRequest();
		const username = ctx.generateRandomWords(1);
		const user = await ctx.createUser(username);
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		const requestPasswordResetAction = {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {
				username,
			},
		};

		const firstPasswordResetRequest = await ctx.processAction(
			ctx.session,
			requestPasswordResetAction,
		);
		expect(firstPasswordResetRequest.error).toBe(false);

		const secondPasswordResetRequest = await ctx.processAction(
			ctx.session,
			requestPasswordResetAction,
		);
		expect(secondPasswordResetRequest.error).toBe(false);

		const passwordResets = await ctx.jellyfish.query(
			ctx.context,
			ctx.session,
			{
				type: 'object',
				required: ['type'],
				additionalProperties: true,
				properties: {
					type: {
						type: 'string',
						const: 'password-reset@1.0.0',
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
			},
			{
				sortBy: 'created_at',
			},
		);

		expect(passwordResets.length).toBe(2);
		expect(passwordResets[0].active).toBe(false);
		expect(passwordResets[1].active).toBe(true);
	});

	test('should not invalidate previous password reset requests from other users', async () => {
		nockRequest();
		const firstUsername = ctx.generateRandomWords(1);
		const secondUsername = ctx.generateRandomWords(1);
		const firstUser = await ctx.createUser(firstUsername);
		const secondUser = await ctx.createUser(secondUsername);
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			firstUser.contract,
			balenaOrg,
			'is member of',
			'has member',
		);
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			secondUser.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		const otherUserRequest = {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: secondUser.contract.id,
			type: secondUser.contract.type,
			arguments: {
				username: secondUsername,
			},
		};
		await ctx.processAction(ctx.session, otherUserRequest);

		const userRequest = {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: firstUser.contract.id,
			type: firstUser.contract.type,
			arguments: {
				username: firstUsername,
			},
		};
		await ctx.processAction(ctx.session, userRequest);

		const passwordResets = await ctx.jellyfish.query(
			ctx.context,
			ctx.session,
			{
				type: 'object',
				additionalProperties: true,
				properties: {
					type: {
						type: 'string',
						const: 'password-reset@1.0.0',
					},
					active: {
						type: 'boolean',
					},
				},
				$$links: {
					'is attached to': {
						type: 'object',
						properties: {
							id: {
								type: 'string',
								enum: [firstUser.contract.id, secondUser.contract.id],
							},
						},
					},
				},
			},
			{
				sortBy: 'created_at',
			},
		);

		expect(passwordResets.length).toBe(2);
		expect(passwordResets[0].active).toBe(true);
		expect(passwordResets[1].active).toBe(true);
	});

	test('accounts with the same password have different request tokens', async () => {
		nockRequest();
		const password = ctx.generateRandomID().split('-')[0];

		const firstUsername = ctx.generateRandomID().split('-')[0];
		const firstUserCreate = await ctx.worker.pre(ctx.session, {
			action: 'action-create-user@1.0.0',
			context: ctx.context,
			card: ctx.worker.typeContracts['user@1.0.0'].id,
			type: ctx.worker.typeContracts['user@1.0.0'].type,
			arguments: {
				email: `${firstUsername}@foo.bar`,
				username: `user-${firstUsername}`,
				password,
			},
		});
		const firstUser = await ctx.processAction(ctx.session, firstUserCreate);
		expect(firstUser.error).toBe(false);
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			firstUser.data,
			balenaOrg,
			'is member of',
			'has member',
		);

		const secondUsername = ctx.generateRandomID().split('-')[0];
		const secondUserCreate = await ctx.worker.pre(ctx.session, {
			action: 'action-create-user@1.0.0',
			context: ctx.context,
			card: ctx.worker.typeContracts['user@1.0.0'].id,
			type: ctx.worker.typeContracts['user@1.0.0'].type,
			arguments: {
				email: `${secondUsername}@foo.bar`,
				username: `user-${secondUsername}`,
				password,
			},
		});
		const secondUser = await ctx.processAction(ctx.session, secondUserCreate);
		expect(secondUser.error).toBe(false);
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			secondUser.data,
			balenaOrg,
			'is member of',
			'has member',
		);

		const firstPasswordResetRequest = await ctx.processAction(ctx.session, {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: firstUser.data.id,
			type: firstUser.data.type,
			arguments: {
				username: firstUsername,
			},
		});
		expect(firstPasswordResetRequest.error).toBe(false);

		const secondPasswordResetRequest = await ctx.processAction(ctx.session, {
			action: 'action-request-password-reset@1.0.0',
			context: ctx.context,
			card: secondUser.data.id,
			type: secondUser.data.type,
			arguments: {
				username: secondUsername,
			},
		});
		expect(secondPasswordResetRequest.error).toBe(false);

		const passwordResets = await ctx.jellyfish.query(
			ctx.context,
			ctx.session,
			{
				type: 'object',
				required: ['type'],
				additionalProperties: true,
				properties: {
					type: {
						type: 'string',
						const: 'password-reset@1.0.0',
					},
				},
				$$links: {
					'is attached to': {
						type: 'object',
						properties: {
							id: {
								type: 'string',
								enum: [firstUser.data.id, secondUser.data.id],
							},
						},
					},
				},
			},
			{
				sortBy: 'created_at',
			},
		);
		expect(passwordResets.length).toBe(2);
		expect(
			passwordResets[0].data.resetToken === passwordResets[1].data.resetToken,
		).toBe(false);
	});

	test('should successfully send an email to a user with an array of emails', async () => {
		mailBody = '';
		nockRequest();
		const username = ctx.generateRandomWords(1);
		const user = await ctx.createUser(username);
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);
		const emails = [
			`${ctx.generateRandomWords(1)}@example.com`,
			`${ctx.generateRandomWords(1)}@example.com`,
		];

		// Update user emails
		await ctx.worker.patchCard(
			ctx.context,
			ctx.session,
			ctx.worker.typeContracts[user.contract.type],
			{
				attachEvents: true,
				actor: ctx.actor.id,
			},
			user.contract,
			[
				{
					op: 'replace',
					path: '/data/email',
					value: emails,
				},
			],
		);
		await ctx.flushAll(ctx.session);

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
		expect(includes('to', emails[0], mailBody)).toBe(true);
	});

	test('should throw error when provided username is an email address', async () => {
		nockRequest();
		const user = await ctx.createUser(ctx.generateRandomWords(1));

		await expect(
			ctx.processAction(ctx.session, {
				action: 'action-request-password-reset@1.0.0',
				context: ctx.context,
				card: user.contract.id,
				type: user.contract.type,
				arguments: {
					username: 'foo@bar.com',
				},
			}),
		).rejects.toThrow(ctx.worker.errors.WorkerSchemaMismatch);
	});
});
