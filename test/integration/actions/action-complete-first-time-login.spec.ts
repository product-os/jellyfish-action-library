/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import get from 'lodash/get';
import { v4 as uuidv4 } from 'uuid';
import { actionCompleteFirstTimeLogin } from '../../../lib/actions/action-complete-first-time-login';
import { PASSWORDLESS_USER_HASH } from '../../../lib/actions/constants';
import { addLinkCard } from '../../../lib/actions/utils';
import {
	after,
	before,
	makeContext,
	makeFirstTimeLogin,
	makeRequest,
	makeUser,
} from './helpers';

const handler = actionCompleteFirstTimeLogin.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('handler()', () => {
	test('should throw on invalid reset token', async () => {
		const request = makeRequest(context, {
			firstTimeLoginToken: uuidv4(),
		});

		expect.assertions(1);
		try {
			await handler(context.session, context, makeUser(), request);
		} catch (error) {
			expect(error.message).toEqual('First-time login token invalid');
		}
	});

	test('should throw an error when user already has a password', async () => {
		// Attach first time login contract to user with a password
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				hash: uuidv4(),
			}),
		);
		const firstTimeLogin = await context.kernel.insertCard(
			context.context,
			context.session,
			makeFirstTimeLogin(),
		);
		await addLinkCard(context, makeRequest(context), firstTimeLogin, user);

		// Create request and execute action
		const request = makeRequest(context, {
			firstTimeLoginToken: firstTimeLogin.data.firstTimeLoginToken,
		});

		expect.assertions(1);
		try {
			await handler(context.session, context, user, request);
		} catch (error) {
			expect(error.message).toEqual('User already has a password set');
		}
	});

	test('handler() should update password on valid first time login token', async () => {
		// Attach first time login contract to user without a password
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				hash: PASSWORDLESS_USER_HASH,
			}),
		);
		const firstTimeLogin = await context.kernel.insertCard(
			context.context,
			context.session,
			makeFirstTimeLogin(),
		);
		await addLinkCard(context, makeRequest(context), firstTimeLogin, user);

		// Create request with new random password
		const request = makeRequest(context, {
			firstTimeLoginToken: firstTimeLogin.data.firstTimeLoginToken,
			newPassword: uuidv4(),
		});

		// Execute action and check that the password was updated
		const result = await handler(context.session, context, user, request);
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
