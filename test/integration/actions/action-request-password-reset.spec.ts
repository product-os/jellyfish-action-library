/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { defaultEnvironment } from '@balena/jellyfish-environment';
import { strict as assert } from 'assert';
import nock from 'nock';
import { after, before, includes, makeContext } from './helpers';

const context = makeContext();
const MAIL_OPTIONS = defaultEnvironment.mail.options;

beforeAll(async () => {
	await before(context);
	context.userEmail = 'test@test.com';
	context.userPassword = 'foobarbaz';
	context.userCard = await context.jellyfish.getCardBySlug(
		context.context,
		context.session,
		'user@latest',
	);
});

beforeEach(async () => {
	// Create user
	context.username = context.generateRandomSlug();
	const createUserAction = await context.worker.pre(context.session, {
		action: 'action-create-user@1.0.0',
		context: context.context,
		card: context.userCard.id,
		type: context.userCard.type,
		arguments: {
			username: `user-${context.username}`,
			password: context.userPassword,
			email: context.userEmail,
		},
	});

	// Check that required mail options are set
	assert.ok(MAIL_OPTIONS);

	// Nock mail integration
	context.nockRequest = () => {
		nock(`${MAIL_OPTIONS.baseUrl}/${MAIL_OPTIONS.domain}`)
			.persist()
			.post('/messages')
			.basicAuth({
				user: 'api',
				pass: MAIL_OPTIONS.token,
			})
			.reply(200, (_uri, requestBody) => {
				context.mailBody = requestBody;
			});
	};

	context.user = await context.processAction(context.session, createUserAction);
});

afterAll(async () => {
	await after(context);
});

afterEach(() => {
	nock.cleanAll();
});

describe('action-request-password-reset', () => {
	test('should create a password reset card and user link when arguments match a valid user', async () => {
		context.nockRequest();

		const requestPasswordResetAction = {
			action: 'action-request-password-reset@1.0.0',
			context: context.context,
			card: context.user.data.id,
			type: context.user.data.type,
			arguments: {
				username: context.username,
			},
		};

		const requestPasswordReset = await context.processAction(
			context.session,
			requestPasswordResetAction,
		);
		expect(requestPasswordReset.error).toBe(false);

		const [passwordReset] = await context.jellyfish.query(
			context.context,
			context.session,
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
								const: context.user.data.id,
							},
						},
					},
				},
			},
			{
				limit: 1,
			},
		);

		expect(passwordReset !== undefined).toBe(true);
		expect(new Date(passwordReset.data.expiresAt) > new Date()).toBe(true);
		expect(passwordReset.links['is attached to'].id).toBe(context.user.id);
	});

	test('should send a password-reset email when the username in the argument matches a valid user', async () => {
		context.mailBody = '';
		context.nockRequest();

		const requestPasswordResetAction = {
			action: 'action-request-password-reset@1.0.0',
			context: context.context,
			card: context.user.data.id,
			type: context.user.data.type,
			arguments: {
				username: context.username,
			},
		};

		const requestPasswordReset = await context.processAction(
			context.session,
			requestPasswordResetAction,
		);
		expect(requestPasswordReset.error).toBe(false);

		const [passwordReset] = await context.jellyfish.query(
			context.context,
			context.session,
			{
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
								const: context.user.data.id,
							},
						},
					},
				},
			},
			{
				limit: 1,
			},
		);

		const resetPasswordUrl = `https://jel.ly.fish/password_reset/${passwordReset.data.resetToken}/${context.username}`;
		const expectedEmailBody = `<p>Hello,</p><p>We have received a password reset request for the Jellyfish account attached to this email.</p><p>Please use the link below to reset your password:</p><a href="${resetPasswordUrl}">${resetPasswordUrl}</a><p>Cheers</p><p>Jellyfish Team</p><a href="https://jel.ly.fish">https://jel.ly.fish</a>`;

		expect(includes('to', context.userEmail, context.mailBody)).toBe(true);
		expect(includes('from', 'no-reply@mail.ly.fish', context.mailBody)).toBe(
			true,
		);
		expect(
			includes('subject', 'Jellyfish Password Reset', context.mailBody),
		).toBe(true);
		expect(includes('html', expectedEmailBody, context.mailBody)).toBe(true);
	});

	test('should fail silently if the username does not match a user', async () => {
		context.nockRequest();

		const requestPasswordResetAction = {
			action: 'action-request-password-reset@1.0.0',
			context: context.context,
			card: context.user.data.id,
			type: context.user.data.type,
			arguments: {
				username: context.generateRandomSlug(),
			},
		};

		const requestPasswordReset = await context.processAction(
			context.session,
			requestPasswordResetAction,
		);
		expect(requestPasswordReset.error).toBe(false);

		const [passwordReset] = await context.jellyfish.query(
			context.context,
			context.session,
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
								const: context.user.data.id,
							},
						},
					},
				},
			},
			{
				limit: 1,
			},
		);

		expect(passwordReset === undefined).toBe(true);
	});

	test('should fail silently if the user is inactive', async () => {
		context.nockRequest();

		const requestDeleteCard = {
			action: 'action-delete-card@1.0.0',
			context: context.context,
			card: context.user.data.id,
			type: context.user.data.type,
			arguments: {},
		};

		const requestDelete = await context.processAction(
			context.session,
			requestDeleteCard,
		);
		expect(requestDelete.error).toBe(false);

		const requestPasswordResetAction = {
			action: 'action-request-password-reset@1.0.0',
			context: context.context,
			card: context.user.data.id,
			type: context.user.data.type,
			arguments: {
				username: context.username,
			},
		};

		const requestPasswordReset = await context.processAction(
			context.session,
			requestPasswordResetAction,
		);
		expect(requestPasswordReset.error).toBe(false);

		const [passwordReset] = await context.jellyfish.query(
			context.context,
			context.session,
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
								const: context.user.data.id,
							},
						},
					},
				},
			},
			{
				limit: 1,
			},
		);

		expect(passwordReset === undefined).toBe(true);
	});

	test('should fail silently if the user does not have a hash', async () => {
		context.nockRequest();

		const requestUpdateCard = {
			action: 'action-update-card@1.0.0',
			context: context.context,
			card: context.user.data.id,
			type: context.user.data.type,
			arguments: {
				reason: 'Removing hash for test',
				patch: [
					{
						op: 'replace',
						path: '/data/hash',
						value: 'PASSWORDLESS',
					},
				],
			},
		};

		const requestUpdate = await context.processAction(
			context.session,
			requestUpdateCard,
		);
		expect(requestUpdate.error).toBe(false);

		const requestPasswordResetAction = {
			action: 'action-request-password-reset@1.0.0',
			context: context.context,
			card: context.user.data.id,
			type: context.user.data.type,
			arguments: {
				username: context.username,
			},
		};

		const requestPasswordReset = await context.processAction(
			context.session,
			requestPasswordResetAction,
		);
		expect(requestPasswordReset.error).toBe(false);

		const [passwordReset] = await context.jellyfish.query(
			context.context,
			context.session,
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
								const: context.user.data.id,
							},
						},
					},
				},
			},
			{
				limit: 1,
			},
		);

		expect(passwordReset === undefined).toBe(true);
	});

	test('should invalidate previous password reset requests', async () => {
		context.nockRequest();

		const requestPasswordResetAction = {
			action: 'action-request-password-reset@1.0.0',
			context: context.context,
			card: context.user.data.id,
			type: context.user.data.type,
			arguments: {
				username: context.username,
			},
		};

		const firstPasswordResetRequest = await context.processAction(
			context.session,
			requestPasswordResetAction,
		);
		expect(firstPasswordResetRequest.error).toBe(false);

		const secondPasswordResetRequest = await context.processAction(
			context.session,
			requestPasswordResetAction,
		);
		expect(secondPasswordResetRequest.error).toBe(false);

		const passwordResets = await context.jellyfish.query(
			context.context,
			context.session,
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
								const: context.user.data.id,
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
		context.nockRequest();

		const otherUsername = context.generateRandomSlug();

		const createUserAction = await context.worker.pre(context.session, {
			action: 'action-create-user@1.0.0',
			context: context.context,
			card: context.userCard.id,
			type: context.userCard.type,
			arguments: {
				email: 'other@user.com',
				username: `user-${otherUsername}`,
				password: 'apassword',
			},
		});

		const otherUser = await context.processAction(
			context.session,
			createUserAction,
		);
		expect(otherUser.error).toBe(false);

		const otherUserRequest = {
			action: 'action-request-password-reset@1.0.0',
			context: context.context,
			card: context.user.data.id,
			type: context.user.data.type,
			arguments: {
				username: otherUsername,
			},
		};

		await context.processAction(context.session, otherUserRequest);

		const userRequest = {
			action: 'action-request-password-reset@1.0.0',
			context: context.context,
			card: context.user.data.id,
			type: context.user.data.type,
			arguments: {
				username: context.username,
			},
		};
		await context.processAction(context.session, userRequest);

		const passwordResets = await context.jellyfish.query(
			context.context,
			context.session,
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
								enum: [context.user.data.id, otherUser.data.id],
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
	});

	test('accounts with the same password have different request tokens', async () => {
		context.nockRequest();

		const newUsername = context.generateRandomSlug();

		const createUserAction = await context.worker.pre(context.session, {
			action: 'action-create-user@1.0.0',
			context: context.context,
			card: context.userCard.id,
			type: context.userCard.type,
			arguments: {
				email: 'madeup@gmail.com',
				username: `user-${newUsername}`,
				password: context.userPassword,
			},
		});

		const secondUser = await context.processAction(
			context.session,
			createUserAction,
		);
		expect(secondUser.error).toBe(false);

		const firstRequest = {
			action: 'action-request-password-reset@1.0.0',
			context: context.context,
			card: context.user.data.id,
			type: context.user.data.type,
			arguments: {
				username: context.username,
			},
		};

		const firstPasswordResetRequest = await context.processAction(
			context.session,
			firstRequest,
		);
		expect(firstPasswordResetRequest.error).toBe(false);

		const secondRequest = {
			action: 'action-request-password-reset@1.0.0',
			context: context.context,
			card: context.user.data.id,
			type: context.user.data.type,
			arguments: {
				username: newUsername,
			},
		};

		const secondPasswordResetRequest = await context.processAction(
			context.session,
			secondRequest,
		);
		expect(secondPasswordResetRequest.error).toBe(false);

		const passwordResets = await context.jellyfish.query(
			context.context,
			context.session,
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
								enum: [context.user.data.id, secondUser.data.id],
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
		context.mailBody = '';
		context.nockRequest();

		const firstEmail = 'first@email.com';
		const secondEmail = 'second@email.com';
		const newUsername = context.generateRandomSlug();

		const createUserAction = await context.worker.pre(context.session, {
			action: 'action-create-user@1.0.0',
			context: context.context,
			card: context.userCard.id,
			type: context.userCard.type,
			arguments: {
				email: firstEmail,
				username: `user-${newUsername}`,
				password: 'foobarbaz',
			},
		});

		const newUser = await context.processAction(
			context.session,
			createUserAction,
		);
		expect(newUser.error).toBe(false);

		const requestUpdateCard = {
			action: 'action-update-card@1.0.0',
			context: context.context,
			card: newUser.data.id,
			type: newUser.data.type,
			arguments: {
				reason: 'Making email an array for test',
				patch: [
					{
						op: 'replace',
						path: '/data/email',
						value: [firstEmail, secondEmail],
					},
				],
			},
		};

		const requestUpdate = await context.processAction(
			context.session,
			requestUpdateCard,
		);
		expect(requestUpdate.error).toBe(false);

		const userWithEmailArray = await context.jellyfish.getCardById(
			context.context,
			context.session,
			newUser.data.id,
		);

		expect(userWithEmailArray.data.email).toEqual([firstEmail, secondEmail]);

		const passwordResetRequest = {
			action: 'action-request-password-reset@1.0.0',
			context: context.context,
			card: newUser.data.id,
			type: newUser.data.type,
			arguments: {
				username: newUsername,
			},
		};

		const passwordReset = await context.processAction(
			context.session,
			passwordResetRequest,
		);

		expect(passwordReset.error).toBe(false);
		expect(includes('to', firstEmail, context.mailBody)).toBe(true);
	});
});
