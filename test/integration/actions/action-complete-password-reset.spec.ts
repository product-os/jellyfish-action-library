/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { defaultEnvironment } from '@balena/jellyfish-environment';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import nock from 'nock';
import { v4 as uuidv4 } from 'uuid';
import { actionCompletePasswordReset } from '../../../lib/actions/action-complete-password-reset';
import { after, before, makeContext, makeRequest } from './helpers';

const ACTIONS = defaultEnvironment.actions;
const MAIL_OPTIONS = defaultEnvironment.mail.options;

const pre = actionCompletePasswordReset.pre;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

beforeEach(async () => {
	const userTypeContract = await context.jellyfish.getCardBySlug(
		context.context,
		context.session,
		'user@latest',
	);

	expect(userTypeContract).not.toBeNull();

	context.userEmail = 'test@test.com';
	context.userPassword = 'original-password';
	context.username = context.generateRandomSlug();

	const createUserAction = await context.worker.pre(context.session, {
		action: 'action-create-user@1.0.0',
		context: context.context,
		card: userTypeContract.id,
		type: userTypeContract.type,
		arguments: {
			email: context.userEmail,
			password: context.userPassword,
			username: `user-${context.username}`,
		},
	});

	const userInfo = await context.processAction(
		context.session,
		createUserAction,
	);
	context.user = await context.jellyfish.getCardById(
		context.context,
		context.session,
		userInfo.data.id,
	);

	expect(context.user).not.toBeNull();

	context.resetToken = crypto
		.createHmac('sha256', ACTIONS.resetPasswordSecretToken)
		.update(context.user.data.hash)
		.digest('hex');

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
	await after(context);
});

afterEach(() => {
	nock.cleanAll();
});

describe('action-complete-password-reset', () => {
	test('should hash new password', async () => {
		const plaintext = uuidv4();
		const request = makeRequest(context, {
			newPassword: plaintext,
		});

		expect.hasAssertions();
		if (pre) {
			const result = await pre(context.session, context, request);
			if (!isNull(result) && !isArray(result)) {
				const match = await bcrypt.compare(plaintext, result.newPassword);
				expect(match).toBe(true);
			}
		}
	});

	test('should replace the user password when the requestToken is valid', async () => {
		const newPassword = 'new-password';

		const requestPasswordReset = {
			action: 'action-request-password-reset@1.0.0',
			context: context.context,
			card: context.user.id,
			type: context.user.type,
			arguments: {
				username: context.username,
			},
		};

		const passwordReset = await context.processAction(
			context.session,
			requestPasswordReset,
		);
		expect(passwordReset.error).toBe(false);

		const completePasswordReset = await context.worker.pre(context.session, {
			action: 'action-complete-password-reset@1.0.0',
			context: context.context,
			card: context.user.id,
			type: context.user.type,
			arguments: {
				resetToken: context.resetToken,
				newPassword,
			},
		});

		const completePasswordResetResult = await context.processAction(
			context.session,
			completePasswordReset,
		);
		expect(completePasswordResetResult.error).toBe(false);

		await expect(
			context.worker.pre(context.session, {
				action: 'action-create-session@1.0.0',
				card: context.user.id,
				type: context.user.type,
				context: context.context,
				arguments: {
					password: context.userPassword,
				},
			}),
		).rejects.toThrow(context.worker.errors.WorkerAuthenticationError);

		const newPasswordLoginRequest = await context.worker.pre(context.session, {
			action: 'action-create-session@1.0.0',
			context: context.context,
			card: context.user.id,
			type: context.user.type,
			arguments: {
				password: newPassword,
			},
		});

		const newPasswordLoginResult = await context.processAction(
			context.session,
			newPasswordLoginRequest,
		);

		expect(newPasswordLoginResult.error).toBe(false);
	});

	test('should fail when the reset token does not match a valid card', async () => {
		const completePasswordReset = await context.worker.pre(context.session, {
			action: 'action-complete-password-reset@1.0.0',
			context: context.context,
			card: context.user.id,
			type: context.user.type,
			arguments: {
				resetToken: 'fake-reset-token',
				newPassword: 'new-password',
			},
		});

		expect.hasAssertions();
		try {
			await context.processAction(context.session, completePasswordReset);
		} catch (error) {
			expect(error.name).toBe('WorkerSchemaMismatch');
			expect(error.message).toBe(
				`Arguments do not match for action action-complete-password-reset: {
  "resetToken": "fake-reset-token",
  "newPassword": "${completePasswordReset.arguments.newPassword}"
}`,
			);
		}
	});

	test('should fail when the reset token has expired', async () => {
		const newPassword = 'new-password';
		const requestPasswordReset = {
			action: 'action-request-password-reset@1.0.0',
			context: context.context,
			card: context.user.id,
			type: context.user.type,
			arguments: {
				username: context.username,
			},
		};

		await context.processAction(context.session, requestPasswordReset);

		const [passwordReset] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				required: ['id', 'type'],
				additionalProperties: true,
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
								const: context.resetToken,
							},
						},
					},
				},
			},
		);

		const now = new Date();
		const hourInPast = now.setHours(now.getHours() - 1);
		const newExpiry = new Date(hourInPast);
		const requestUpdateCard = {
			action: 'action-update-card@1.0.0',
			context: context.context,
			card: passwordReset.id,
			type: passwordReset.type,
			arguments: {
				reason: 'Expiring token for test',
				patch: [
					{
						op: 'replace',
						path: '/data/expiresAt',
						value: newExpiry.toISOString(),
					},
				],
			},
		};

		const updatedCard = await context.processAction(
			context.session,
			requestUpdateCard,
		);
		expect(updatedCard.error).toBe(false);

		const completePasswordReset = await context.worker.pre(context.session, {
			action: 'action-complete-password-reset@1.0.0',
			context: context.context,
			card: context.user.id,
			type: context.user.type,
			arguments: {
				resetToken: context.resetToken,
				newPassword,
			},
		});

		await expect(
			context.processAction(context.session, completePasswordReset),
		).rejects.toThrow(context.worker.errors.WorkerAuthenticationError);
	});

	test('should fail when the reset token is not active', async () => {
		const newPassword = 'new-password';
		const requestPasswordReset = {
			action: 'action-request-password-reset@1.0.0',
			context: context.context,
			card: context.user.id,
			type: context.user.type,
			arguments: {
				username: context.username,
			},
		};

		await context.processAction(context.session, requestPasswordReset);

		const [passwordReset] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				required: ['id', 'type'],
				additionalProperties: true,
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
								const: context.resetToken,
							},
						},
					},
				},
			},
		);

		const requestDeleteCard = {
			action: 'action-delete-card@1.0.0',
			context: context.context,
			card: passwordReset.id,
			type: passwordReset.type,
			arguments: {},
		};

		const requestDelete = await context.processAction(
			context.session,
			requestDeleteCard,
		);
		expect(requestDelete.error).toBe(false);

		const completePasswordReset = await context.worker.pre(context.session, {
			action: 'action-complete-password-reset@1.0.0',
			context: context.context,
			card: context.user.id,
			type: context.user.type,
			arguments: {
				resetToken: context.resetToken,
				newPassword,
			},
		});

		await expect(
			context.processAction(context.session, completePasswordReset),
		).rejects.toThrow(context.worker.errors.WorkerAuthenticationError);
	});

	test('should fail if the user becomes inactive between requesting and completing the password reset', async () => {
		const requestPasswordResetAction = {
			action: 'action-request-password-reset@1.0.0',
			context: context.context,
			card: context.user.id,
			type: context.user.type,
			arguments: {
				username: context.username,
			},
		};

		const requestPasswordReset = await context.processAction(
			context.session,
			requestPasswordResetAction,
		);
		expect(requestPasswordReset.error).toBe(false);

		const requestDeleteCard = {
			action: 'action-delete-card@1.0.0',
			context: context.context,
			card: context.user.id,
			type: context.user.type,
			arguments: {},
		};

		const requestDelete = await context.processAction(
			context.session,
			requestDeleteCard,
		);
		expect(requestDelete.error).toBe(false);

		const completePasswordReset = await context.worker.pre(context.session, {
			action: 'action-complete-password-reset@1.0.0',
			context: context.context,
			card: context.user.id,
			type: context.user.type,
			arguments: {
				resetToken: context.resetToken,
				newPassword: 'new-password',
			},
		});

		await expect(
			context.processAction(context.session, completePasswordReset),
		).rejects.toThrow(context.worker.errors.WorkerAuthenticationError);
	});

	test('should remove the password reset card', async () => {
		const requestPasswordResetAction = {
			action: 'action-request-password-reset@1.0.0',
			context: context.context,
			card: context.user.id,
			type: context.user.type,
			arguments: {
				username: context.username,
			},
		};

		const requestPasswordReset = await context.processAction(
			context.session,
			requestPasswordResetAction,
		);
		expect(requestPasswordReset.error).toBe(false);

		const completePasswordReset = await context.worker.pre(context.session, {
			action: 'action-complete-password-reset@1.0.0',
			context: context.context,
			card: context.user.id,
			type: context.user.type,
			arguments: {
				resetToken: context.resetToken,
				newPassword: 'new-password',
			},
		});

		await context.processAction(context.session, completePasswordReset);

		const [passwordReset] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				required: ['type', 'active', 'data'],
				additionalProperties: true,
				properties: {
					type: {
						type: 'string',
						const: 'password-reset@1.0.0',
					},
					active: {
						type: 'boolean',
					},
					data: {
						type: 'object',
						properties: {
							resetToken: {
								type: 'string',
								const: context.resetToken,
							},
						},
						required: ['resetToken'],
					},
				},
			},
			{
				limit: 1,
			},
		);

		// Sanity check to make sure the return element is the one we expect
		expect(passwordReset.data.resetToken).toBe(context.resetToken);
		expect(passwordReset.active).toBe(false);
	});
});
