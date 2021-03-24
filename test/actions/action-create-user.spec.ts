/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { makeContext, makeRequest, makeUser, session, types } from './helpers';
import { PASSWORDLESS_USER_HASH } from '../../lib/actions/constants';
import { actionCreateUser } from '../../lib/actions/action-create-user';

const pre = actionCreateUser.pre;
const handler = actionCreateUser.handler;

describe('pre()', () => {
	test('sets password-less user hash when no password argument is set', async () => {
		const request = makeRequest({
			username: `user-${uuidv4()}`,
			email: 'user@foo.bar',
		});

		expect.assertions(1);
		if (pre) {
			const result = await pre(session.id, makeContext(), request);
			expect(result).toEqual({
				...request.arguments,
				password: PASSWORDLESS_USER_HASH,
			});
		}
	});

	test('hashes provided plaintext password', async () => {
		const request = makeRequest({
			username: `user-${uuidv4()}`,
			email: 'user@foo.bar',
			password: uuidv4(),
		});
		const plaintext = request.arguments.password;

		expect.assertions(1);
		if (pre) {
			const result = await pre(session.id, makeContext(), request);
			if (!isNull(result) && !isArray(result)) {
				const match = await bcrypt.compare(plaintext, result.password);
				expect(match).toBe(true);
			}
		}
	});
});

describe('handler()', () => {
	test('should throw an error on attempt to insert existing card', async () => {
		const user = makeUser();
		const context = makeContext([types.user, user]);
		const request = makeRequest({
			username: user.slug,
			email: 'user@foo.bar',
			password: uuidv4(),
		});

		expect.assertions(1);
		try {
			await handler(session.id, context, user, request);
		} catch (error) {
			expect(error.name).toEqual('JellyfishElementAlreadyExists');
		}
	});

	test('should create a new user card', async () => {
		const context = makeContext([types.user]);
		const request = makeRequest({
			username: `user-${uuidv4()}`,
			email: 'user@foo.bar',
			password: 'baz',
		});

		expect.assertions(1);
		const result = await handler(session.id, context, makeUser(), request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.slug).toEqual(request.arguments.username);
		}
	});
});
