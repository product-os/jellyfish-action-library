/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { defaultEnvironment } from '@balena/jellyfish-environment';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import get from 'lodash/get';
import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import { v4 as uuidv4 } from 'uuid';
import { actionCompletePasswordReset } from '../../../lib/actions/action-complete-password-reset';
import { addLinkCard } from '../../../lib/actions/utils';
import {
	after,
	before,
	makeContext,
	makePasswordReset,
	makeRequest,
	makeUser,
} from './helpers';

const ACTIONS = defaultEnvironment.actions;

const pre = actionCompletePasswordReset.pre;
const handler = actionCompletePasswordReset.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('pre()', () => {
	test('should hash new password', async () => {
		const plaintext = uuidv4();
		const request = makeRequest(context, {
			newPassword: plaintext,
		});

		expect.assertions(1);
		if (pre) {
			const result = await pre(context.session, context, request);
			if (!isNull(result) && !isArray(result)) {
				const match = await bcrypt.compare(plaintext, result.newPassword);
				expect(match).toBe(true);
			}
		}
	});
});

describe('handler()', () => {
	test('should throw on invalid reset token', async () => {
		expect.assertions(1);
		try {
			await handler(
				context.session,
				context,
				makeUser(),
				makeRequest(context, {
					resetToken: 'foobar',
				}),
			);
		} catch (error) {
			expect(error.message).toEqual('Reset token invalid');
		}
	});

	test('should update password on valid reset token', async () => {
		// Create a new user with a random password
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				hash: uuidv4(),
			}),
		);

		// Create a password reset contract and attach to user
		const resetToken = crypto
			.createHmac('sha256', ACTIONS.resetPasswordSecretToken)
			.update(user.data.hash as crypto.BinaryLike)
			.digest('hex');
		const passwordReset = await context.kernel.insertCard(
			context.context,
			context.session,
			makePasswordReset({
				resetToken,
			}),
		);
		await addLinkCard(context, makeRequest(context), passwordReset, user);

		// Create request with new random password
		const request = makeRequest(context, {
			newPassword: uuidv4(),
			resetToken: passwordReset.data.resetToken,
		});

		// Execute action and check that the password was updated
		const result = await handler(context.session, context, makeUser(), request);
		expect(get(result, ['id'])).toEqual(user.id);
		expect(get(result, ['data', 'hash'])).toEqual(
			request.arguments.newPassword,
		);

		// Get user from backend and confirm password change
		const updated = await context.getCardById(
			context.privilegedSession,
			user.id,
		);
		expect(get(updated, ['data', 'hash'])).toEqual(
			request.arguments.newPassword,
		);
	});
});
