/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import {
	BCRYPT_SALT_ROUNDS,
	PASSWORDLESS_USER_HASH,
} from '../../lib/actions/constants';
import { makeContext, makeUser, session, types, makeRequest } from './helpers';
import { actionSetPassword } from '../../lib/actions/action-set-password';

const pre = actionSetPassword.pre;
const handler = actionSetPassword.handler;

describe('pre()', () => {
	test('should set password if first time password', async () => {
		const user = makeUser({
			hash: PASSWORDLESS_USER_HASH,
		});
		const request = makeRequest({
			newPassword: uuidv4(),
		});
		request.card = user.id;

		expect.assertions(1);
		if (pre) {
			const plaintext = request.arguments.newPassword;
			const result = await pre(
				session.id,
				makeContext([types.user, user]),
				request,
			);
			const match = await bcrypt.compare(plaintext, result.newPassword);
			expect(match).toBe(true);
		}
	});

	test('should throw an error if current password is incorrect', async () => {
		const user = makeUser({
			hash: await bcrypt.hash('foo', BCRYPT_SALT_ROUNDS),
		});
		const request = makeRequest({
			currentPassword: 'bar',
			newPassword: 'foobar',
		});
		request.card = user.id;

		expect.assertions(1);
		if (pre) {
			try {
				await pre(session.id, makeContext([types.user, user]), request);
			} catch (error) {
				expect(error.message).toEqual('Invalid password');
			}
		}
	});

	test('should set password if current password is correct', async () => {
		const plaintext = 'foo';
		const user = makeUser({
			hash: await bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS),
		});
		const request = makeRequest({
			currentPassword: plaintext,
			newPassword: 'foobar',
		});
		request.card = user.id;

		expect.assertions(2);
		if (pre) {
			const newPassword = request.arguments.newPassword;
			const result = await pre(
				session.id,
				makeContext([types.user, user]),
				request,
			);
			expect(result.currentPassword).toEqual('CHECKED IN PRE HOOK');

			const match = await bcrypt.compare(newPassword, result.newPassword);
			expect(match).toBe(true);
		}
	});
});

describe('handler()', () => {
	test('should throw an error on invalid type', async () => {
		const user = makeUser();

		expect.assertions(1);
		try {
			await handler(session.id, makeContext(), user, makeRequest());
		} catch (error) {
			expect(error.message).toEqual(`No such type: ${user.type}`);
		}
	});

	test('should update current password (first time)', async () => {
		const user = makeUser({
			hash: PASSWORDLESS_USER_HASH,
		});
		const context = makeContext([types.user, user]);
		const request = makeRequest({
			newPassword: uuidv4(),
		});
		request.card = user.id;

		expect.assertions(2);
		const result = await handler(session.id, context, user, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(user.id);
		}

		const updated = await context.getCardById(session.id, user.id);
		expect(updated.data.hash).toEqual(request.arguments.newPassword);
	});
});
