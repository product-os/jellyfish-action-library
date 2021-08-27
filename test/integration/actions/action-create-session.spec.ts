/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import bcrypt from 'bcrypt';
import Bluebird from 'bluebird';
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

describe('action-create-session', () => {
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
			} catch (error: any) {
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
			} catch (error: any) {
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
			} catch (error: any) {
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

	test('should not store the password in the queue', async () => {
		const userCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'user@latest',
		);

		expect(userCard).not.toBeNull();

		const request1 = await context.worker.pre(context.session, {
			action: 'action-create-user@1.0.0',
			context: context.context,
			card: userCard.id,
			type: userCard.type,
			arguments: {
				email: 'johndoe@example.com',
				username: 'user-johndoe',
				password: 'foobarbaz',
			},
		});

		const createUserRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			request1,
		);

		await context.flush(context.session);
		const result = await context.queue.producer.waitResults(
			context.context,
			createUserRequest,
		);
		expect(result.error).toBe(false);

		const plaintextPassword = 'foobarbaz';

		const request2 = await context.worker.pre(context.session, {
			action: 'action-create-session@1.0.0',
			context: context.context,
			card: (result.data as any).id,
			type: (result.data as any).type,
			arguments: {
				password: plaintextPassword,
			},
		});

		await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			request2,
		);

		await Bluebird.delay(2000);

		const request: any = await context.dequeue();
		expect(request).toBeTruthy();
		expect(request.data.arguments.password).not.toBe(plaintextPassword);
	});

	test('should throw an error on invalid user', async () => {
		const user = makeUser();

		expect.assertions(1);
		try {
			await handler(context.session, context, user, makeRequest(context));
		} catch (error: any) {
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
