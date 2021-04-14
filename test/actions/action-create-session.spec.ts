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
import { BCRYPT_SALT_ROUNDS } from '../../lib/actions/constants';
import { actionCreateSession } from '../../lib/actions/action-create-session';

const pre = actionCreateSession.pre;
const handler = actionCreateSession.handler;

describe('pre()', () => {
	test('should throw an error on invalid scope schema', async () => {
		expect.assertions(1);
		if (pre) {
			try {
				await pre(
					session.id,
					makeContext(),
					makeRequest({
						scope: uuidv4(),
					}),
				);
			} catch (error) {
				expect(error.message).toEqual('Invalid schema for session scope');
			}
		}
	});

	test('should throw an error on invalid username', async () => {
		const request = makeRequest();
		request.card = uuidv4();

		expect.assertions(1);
		if (pre) {
			try {
				await pre(session.id, makeContext(), request);
			} catch (error) {
				expect(error.message).toEqual('Incorrect username or password');
			}
		}
	});

	test('should throw an error on disallowed login', async () => {
		const user = makeUser();
		const request = makeRequest();
		request.card = user.id;

		expect.assertions(1);
		if (pre) {
			try {
				await pre(session.id, makeContext([user]), request);
			} catch (error) {
				expect(error.message).toEqual('Login disallowed');
			}
		}
	});

	test('should throw an error on invalid password', async () => {
		const user = makeUser({
			hash: await bcrypt.hash(uuidv4(), BCRYPT_SALT_ROUNDS),
		});
		const request = makeRequest({
			password: uuidv4(),
		});
		request.card = user.id;

		expect.assertions(1);
		if (pre) {
			try {
				await pre(session.id, makeContext([user]), request);
			} catch (error) {
				expect(error.message).toEqual('Invalid password');
			}
		}
	});

	test('should return session arguments on success', async () => {
		const plaintext = uuidv4();
		const user = makeUser({
			hash: await bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS),
		});
		const request = makeRequest({
			password: plaintext,
			scope: {
				type: 'object',
				properties: {
					slug: {
						type: 'string',
						const: user.slug,
					},
				},
			},
		});
		request.card = user.id;

		expect.assertions(1);
		if (pre) {
			const result = await pre(session.id, makeContext([user]), request);
			if (!isNull(result) && !isArray(result)) {
				expect(result).toEqual({
					password: 'CHECKED IN PRE HOOK',
					scope: request.arguments.scope,
				});
			}
		}
	});
});

describe('handler()', () => {
	test('should throw an error on invalid user', async () => {
		const user = makeUser();

		expect.assertions(1);
		try {
			await handler(session.id, makeContext(), user, makeRequest());
		} catch (error) {
			expect(error.message).toEqual(`No such user: ${user.id}`);
		}
	});

	test('should throw an error on disallowed login', async () => {
		const user = makeUser();

		expect.assertions(1);
		try {
			await handler(session.id, makeContext([user]), user, makeRequest());
		} catch (error) {
			expect(error.message).toEqual('Login disallowed');
		}
	});

	test('should throw an error on no session type card', async () => {
		const user = makeUser({
			hash: uuidv4(),
		});

		expect.assertions(1);
		try {
			await handler(session.id, makeContext([user]), user, makeRequest());
		} catch (error) {
			expect(error.message).toEqual('No such type: session');
		}
	});

	test('should create a session on valid request', async () => {
		const user = makeUser({
			hash: uuidv4(),
		});

		expect.assertions(1);
		const result = await handler(
			session.id,
			makeContext([types.session, user]),
			user,
			makeRequest(),
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.slug).toMatch(/^session-/);
		}
	});
});
