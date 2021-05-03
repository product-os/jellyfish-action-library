/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import bcrypt from 'bcrypt';
import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import { v4 as uuidv4 } from 'uuid';
import { actionCreateUser } from '../../../lib/actions/action-create-user';
import { PASSWORDLESS_USER_HASH } from '../../../lib/actions/constants';
import { after, before, makeContext, makeRequest, makeUser } from './helpers';

const pre = actionCreateUser.pre;
const handler = actionCreateUser.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('pre()', () => {
	test('sets password-less user hash when no password argument is set', async () => {
		const request = makeRequest(context, {
			username: `user-${uuidv4()}`,
			email: 'user@foo.bar',
		});

		expect.assertions(1);
		if (pre) {
			const result = await pre(context.session, context, request);
			expect(result).toEqual({
				...request.arguments,
				password: PASSWORDLESS_USER_HASH,
			});
		}
	});

	test('hashes provided plaintext password', async () => {
		const request = makeRequest(context, {
			username: `user-${uuidv4()}`,
			email: 'user@foo.bar',
			password: uuidv4(),
		});
		const plaintext = request.arguments.password;

		expect.assertions(1);
		if (pre) {
			const result = await pre(context.session, context, request);
			if (!isNull(result) && !isArray(result)) {
				const match = await bcrypt.compare(plaintext, result.password);
				expect(match).toBe(true);
			}
		}
	});
});

describe('handler()', () => {
	test('should throw an error on attempt to insert existing card', async () => {
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser(),
		);
		const request = makeRequest(context, {
			username: user.slug,
			email: 'user@foo.bar',
			password: uuidv4(),
		});

		expect.assertions(1);
		try {
			await handler(
				context.session,
				context,
				context.jellyfish.cards.user,
				request,
			);
		} catch (error) {
			expect(error.name).toEqual('JellyfishElementAlreadyExists');
		}
	});

	test('should create a new user card', async () => {
		const request = makeRequest(context, {
			username: `user-${uuidv4()}`,
			email: 'user@foo.bar',
			password: 'baz',
		});

		expect.assertions(1);
		const result = await handler(
			context.session,
			context,
			context.jellyfish.cards.user,
			request,
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.slug).toEqual(request.arguments.username);
		}
	});
});
