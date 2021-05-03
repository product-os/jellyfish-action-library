/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import bcrypt from 'bcrypt';
import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import { v4 as uuidv4 } from 'uuid';
import { actionCreateSession } from '../../../lib/actions/action-create-session';
import { BCRYPT_SALT_ROUNDS } from '../../../lib/actions/constants';
import { after, before, makeContext, makeRequest, makeUser } from './helpers';

const pre = actionCreateSession.pre;
const handler = actionCreateSession.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('pre()', () => {
	test('should throw an error on invalid scope schema', async () => {
		expect.assertions(1);
		if (pre) {
			try {
				await pre(
					context.session,
					context,
					makeRequest(context, {
						scope: uuidv4(),
					}),
				);
			} catch (error) {
				expect(error.message).toEqual('Invalid schema for session scope');
			}
		}
	});

	test('should throw an error on invalid username', async () => {
		const request = makeRequest(context);
		request.card = uuidv4();

		expect.assertions(1);
		if (pre) {
			try {
				await pre(context.session, context, request);
			} catch (error) {
				expect(error.message).toEqual('Incorrect username or password');
			}
		}
	});

	test('should throw an error on invalid password', async () => {
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				hash: await bcrypt.hash(uuidv4(), BCRYPT_SALT_ROUNDS),
			}),
		);
		const request = makeRequest(context, {
			password: uuidv4(),
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

	test('should return session arguments on success', async () => {
		const plaintext = uuidv4();
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				hash: await bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS),
			}),
		);
		const request = makeRequest(context, {
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
			const result = await pre(context.session, context, request);
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
			await handler(context.session, context, user, makeRequest(context));
		} catch (error) {
			expect(error.message).toEqual(`No such user: ${user.id}`);
		}
	});

	test('should create a session on valid request', async () => {
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				hash: uuidv4(),
			}),
		);

		expect.assertions(1);
		const result = await handler(
			context.session,
			context,
			user,
			makeRequest(context),
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.slug).toMatch(/^session-/);
		}
	});
});
