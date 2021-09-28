/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { QueueInvalidAction } from '@balena/jellyfish-queue/build/errors';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { strict as assert } from 'assert';
import bcrypt from 'bcrypt';
import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import ActionLibrary from '../../../lib';
import { actionCreateUser } from '../../../lib/actions/action-create-user';
import { PASSWORDLESS_USER_HASH } from '../../../lib/actions/constants';
import { makeRequest } from './helpers';

const pre = actionCreateUser.pre;
const handler = actionCreateUser.handler;
let ctx: integrationHelpers.IntegrationTestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await integrationHelpers.before([
		DefaultPlugin,
		ActionLibrary,
		ProductOsPlugin,
	]);
	actionContext = ctx.worker.getActionContext({
		id: `test-${ctx.generateRandomID()}`,
	});
});

afterAll(async () => {
	return integrationHelpers.after(ctx);
});

describe('action-create-user', () => {
	test('sets password-less user hash when no password argument is set', async () => {
		const request = makeRequest(ctx, {
			username: `user-${ctx.generateRandomID()}`,
			email: 'user@foo.bar',
		});

		expect.assertions(1);
		if (pre) {
			const result = await pre(ctx.session, actionContext, request);
			expect(result).toEqual({
				...request.arguments,
				password: PASSWORDLESS_USER_HASH,
			});
		}
	});

	test('hashes provided plaintext password', async () => {
		const request = makeRequest(ctx, {
			username: `user-${ctx.generateRandomID()}`,
			email: 'user@foo.bar',
			password: ctx.generateRandomID(),
		});
		const plaintext = request.arguments.password;

		expect.assertions(1);
		if (pre) {
			const result = await pre(ctx.session, actionContext, request);
			if (!isNull(result) && !isArray(result)) {
				const match = await bcrypt.compare(plaintext, result.password);
				expect(match).toBe(true);
			}
		}
	});

	test('should throw an error on attempt to insert existing card', async () => {
		const user = await ctx.createUser(ctx.generateRandomWords(1));
		const request = makeRequest(ctx, {
			username: user.contract.slug,
			email: 'user@foo.bar',
			password: ctx.generateRandomID(),
		});

		await expect(
			handler(
				ctx.session,
				actionContext,
				ctx.worker.typeContracts['user@1.0.0'],
				request,
			),
		).rejects.toThrow(ctx.jellyfish.errors.JellyfishElementAlreadyExists);
	});

	test('should create a new user card', async () => {
		const request = makeRequest(ctx, {
			username: `user-${ctx.generateRandomID()}`,
			email: 'user@foo.bar',
			password: 'baz',
		});

		const result: any = await handler(
			ctx.session,
			actionContext,
			ctx.worker.typeContracts['user@1.0.0'],
			request,
		);
		assert(result);
		expect(result.slug).toEqual(request.arguments.username);
	});

	test('should not store the password in the queue when using action-create-user', async () => {
		const password = 'foobar';

		const request = await ctx.worker.pre(ctx.session, {
			action: 'action-create-user@1.0.0',
			context: ctx.context,
			card: ctx.worker.typeContracts['user@1.0.0'].id,
			type: ctx.worker.typeContracts['user@1.0.0'].type,
			arguments: {
				email: 'johndoe@example.com',
				username: 'user-johndoe',
				password,
			},
		});

		const createUserRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			request,
		);
		expect((createUserRequest.data.arguments.password as any).string).not.toBe(
			password,
		);

		await ctx.flushAll(ctx.session);
		const result = await ctx.queue.producer.waitResults(
			ctx.context,
			createUserRequest,
		);
		expect(result.error).toBe(false);
	});

	test('should use the PASSWORDLESS_USER_HASH when the supplied password is an empty string', async () => {
		const request = await ctx.worker.pre(ctx.session, {
			action: 'action-create-user@1.0.0',
			context: ctx.context,
			card: ctx.worker.typeContracts['user@1.0.0'].id,
			type: ctx.worker.typeContracts['user@1.0.0'].type,
			arguments: {
				email: 'johndoe@example.com',
				username: 'user-johndoe',
				password: '',
			},
		});
		const enqueued = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			request,
		);
		expect(enqueued.data.arguments.password).toBe('PASSWORDLESS');
	});

	test('creating a user with a community user session should fail', async () => {
		const user = await ctx.createUser(ctx.generateRandomID().split('-')[0]);

		const username = ctx.generateRandomID().split('-')[0];
		await expect(
			ctx.queue.producer.enqueue(
				ctx.worker.getId(),
				user.session,
				await ctx.worker.pre(ctx.session, {
					action: 'action-create-user@1.0.0',
					context: ctx.context,
					card: ctx.worker.typeContracts['user@1.0.0'].id,
					type: ctx.worker.typeContracts['user@1.0.0'].type,
					arguments: {
						email: `${username}@foo.bar`,
						username: `user-${username}`,
						password: ctx.generateRandomID().split('-')[0],
					},
				}),
			),
		).rejects.toThrow(QueueInvalidAction);
	});
});
