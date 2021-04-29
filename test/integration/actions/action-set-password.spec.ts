/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import bcrypt from 'bcrypt';
import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import { v4 as uuidv4 } from 'uuid';
import { actionSetPassword } from '../../../lib/actions/action-set-password';
import {
	BCRYPT_SALT_ROUNDS,
	PASSWORDLESS_USER_HASH,
} from '../../../lib/actions/constants';
import { after, before, makeContext, makeRequest, makeUser } from './helpers';

const pre = actionSetPassword.pre;
const handler = actionSetPassword.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('pre()', () => {
	test('should set password if first time password', async () => {
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				hash: PASSWORDLESS_USER_HASH,
			}),
		);
		const request = makeRequest(context, {
			newPassword: uuidv4(),
		});
		request.card = user.id;

		expect.assertions(1);
		if (pre) {
			const plaintext = request.arguments.newPassword;
			const result = await pre(context.session, context, request);
			const match = await bcrypt.compare(plaintext, result.newPassword);
			expect(match).toBe(true);
		}
	});

	test('should throw an error if current password is incorrect', async () => {
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				hash: await bcrypt.hash('foo', BCRYPT_SALT_ROUNDS),
			}),
		);
		const request = makeRequest(context, {
			currentPassword: 'bar',
			newPassword: 'foobar',
		});
		request.card = user.id;

		expect.assertions(1);
		if (pre) {
			try {
				await pre(context.session, context, request);
			} catch (error) {
				expect(error.message).toEqual('Invalid password');
			}
		}
	});

	test('should set password if current password is correct', async () => {
		const plaintext = 'foo';
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				hash: await bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS),
			}),
		);
		const request = makeRequest(context, {
			currentPassword: plaintext,
			newPassword: 'foobar',
		});
		request.card = user.id;

		expect.assertions(2);
		if (pre) {
			const newPassword = request.arguments.newPassword;
			const result = await pre(context.session, context, request);
			expect(result.currentPassword).toEqual('CHECKED IN PRE HOOK');

			const match = await bcrypt.compare(newPassword, result.newPassword);
			expect(match).toBe(true);
		}
	});
});

describe('handler()', () => {
	test('should update current password (first time)', async () => {
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				hash: PASSWORDLESS_USER_HASH,
			}),
		);
		const request = makeRequest(context, {
			newPassword: uuidv4(),
		});
		request.card = user.id;

		expect.assertions(2);
		const result = await handler(context.session, context, user, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(user.id);
		}

		const updated = await context.getCardById(context.session, user.id);
		expect(updated.data.hash).toEqual(request.arguments.newPassword);
	});
});
