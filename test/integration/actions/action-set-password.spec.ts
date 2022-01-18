import { strict as assert } from 'assert';
import { testUtils as coreTestUtils } from '@balena/jellyfish-core';
import {
	errors as workerErrors,
	testUtils as workerTestUtils,
} from '@balena/jellyfish-worker';
import bcrypt from 'bcrypt';
import { actionLibrary } from '../../../lib';
import {
	BCRYPT_SALT_ROUNDS,
	PASSWORDLESS_USER_HASH,
} from '../../../lib/actions/constants';

let ctx: workerTestUtils.TestContext;

beforeAll(async () => {
	ctx = await workerTestUtils.newContext({
		plugins: [actionLibrary],
	});
});

afterAll(async () => {
	return workerTestUtils.destroyContext(ctx);
});

describe('action-set-password', () => {
	test('should not store the passwords in the queue when using action-set-password', async () => {
		const password = coreTestUtils.generateRandomId();
		const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
		const user = await ctx.createUser(coreTestUtils.generateRandomSlug(), hash);

		const newPassword = coreTestUtils.generateRandomId();
		const request = (await ctx.worker.pre(ctx.session, {
			action: 'action-set-password@1.0.0',
			logContext: ctx.logContext,
			card: user.id,
			type: user.type,
			arguments: {
				currentPassword: password,
				newPassword,
			},
		})) as any;
		request.logContext = request.logContext;
		await ctx.queue.producer.enqueue(ctx.worker.getId(), ctx.session, request);

		const dequeued: any = await ctx.dequeue();
		expect(dequeued.data.arguments.currentPassword).not.toBe(password);
		expect(dequeued.data.arguments.currentPassword).toEqual(
			'CHECKED IN PRE HOOK',
		);
		expect(dequeued.data.arguments.newPassword).toBeTruthy();
		expect(dequeued.data.arguments.newPassword).not.toBe(newPassword);
	});

	test('should change the password of a password-less user given no password', async () => {
		const user = await ctx.createUser(
			coreTestUtils.generateRandomSlug(),
			PASSWORDLESS_USER_HASH,
		);

		// TODO: temporary workaround for context/logContext mismatch
		const options = (await ctx.worker.pre(ctx.session, {
			action: 'action-set-password@1.0.0',
			logContext: ctx.logContext,
			card: user.id,
			type: user.type,
			arguments: {
				currentPassword: null,
				newPassword: coreTestUtils.generateRandomId(),
			},
		})) as any;
		options.logContext = options.context;
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			options,
		);
		await ctx.flushAll(ctx.session);
		const resetResult = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);
		expect(resetResult.error).toBe(false);

		const updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.hash).toBeTruthy();
		expect(updated.data.hash).not.toEqual(PASSWORDLESS_USER_HASH);
	});

	test('should change a user password', async () => {
		const password = coreTestUtils.generateRandomId();
		const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
		const user = await ctx.createUser(coreTestUtils.generateRandomSlug(), hash);

		// TODO: temporary workaround for context/logContext mismatch
		const options = (await ctx.worker.pre(ctx.session, {
			action: 'action-set-password@1.0.0',
			logContext: ctx.logContext,
			card: user.id,
			type: user.type,
			arguments: {
				currentPassword: password,
				newPassword: coreTestUtils.generateRandomId(),
			},
		})) as any;
		options.logContext = options.context;
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			options,
		);
		await ctx.flushAll(ctx.session);
		const result = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);
		expect(result.error).toBe(false);

		const updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.hash).toBeTruthy();
		expect(updated.data.hash).not.toEqual(hash);
	});

	test('should not change a user password given invalid current password', async () => {
		const password = coreTestUtils.generateRandomId();
		const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
		const user = await ctx.createUser(coreTestUtils.generateRandomSlug(), hash);

		await expect(
			ctx.worker.pre(ctx.session, {
				action: 'action-set-password@1.0.0',
				logContext: ctx.logContext,
				card: user.id,
				type: user.type,
				arguments: {
					currentPassword: 'xxxxxxxxxxxxxxxxxxxxxx',
					newPassword: coreTestUtils.generateRandomId(),
				},
			}),
		).rejects.toThrow(workerErrors.WorkerAuthenticationError);
	});

	test('should not change a user password given a null current password', async () => {
		const password = coreTestUtils.generateRandomId();
		const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
		const user = await ctx.createUser(coreTestUtils.generateRandomSlug(), hash);

		await expect(
			ctx.worker.pre(ctx.session, {
				action: 'action-set-password@1.0.0',
				logContext: ctx.logContext,
				card: user.id,
				type: user.type,
				arguments: {
					currentPassword: null,
					newPassword: 'new-password',
				},
			}),
		).rejects.toThrow(workerErrors.WorkerAuthenticationError);
	});

	test('should not store the passwords when using action-set-password on a first time password', async () => {
		const user = await ctx.createUser(
			coreTestUtils.generateRandomSlug(),
			PASSWORDLESS_USER_HASH,
		);

		// TODO: temporary workaround for context/logContext mismatch
		const options = (await ctx.worker.pre(ctx.session, {
			action: 'action-set-password@1.0.0',
			logContext: ctx.logContext,
			card: user.id,
			type: user.type,
			arguments: {
				currentPassword: null,
				newPassword: coreTestUtils.generateRandomId(),
			},
		})) as any;
		options.logContext = options.context;
		await ctx.queue.producer.enqueue(ctx.worker.getId(), ctx.session, options);

		const dequeued: any = await ctx.dequeue();
		expect(dequeued.data.arguments.currentPassword).toEqual('');
		expect(dequeued.data.arguments.newPassword).toBeTruthy();
		expect(dequeued.data.arguments.newPassword).not.toBe('new-password');
	});

	test('should not change the password of a password-less user given a password', async () => {
		const user = await ctx.createUser(
			coreTestUtils.generateRandomSlug(),
			PASSWORDLESS_USER_HASH,
		);

		await expect(
			ctx.worker.pre(ctx.session, {
				action: 'action-set-password@1.0.0',
				logContext: ctx.logContext,
				card: user.id,
				type: user.type,
				arguments: {
					currentPassword: 'xxxxxxxxxxxxxxxxxxxxxx',
					newPassword: 'new-password',
				},
			}),
		).rejects.toThrow(workerErrors.WorkerAuthenticationError);
	});

	test('a community user should not be able to reset other users passwords', async () => {
		const user = await ctx.createUser(coreTestUtils.generateRandomSlug());
		expect(user.data.roles).toEqual(['user-community']);
		const session = await ctx.createSession(user);

		const password = coreTestUtils.generateRandomId().split('-')[0];
		const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
		const otherUser = await ctx.createUser(
			coreTestUtils.generateRandomSlug(),
			hash,
		);
		expect(otherUser.data.hash).toEqual(hash);
		expect(otherUser.data.roles).toEqual(['user-community']);

		// TODO: temporary workaround for context/logContext mismatch
		const options = (await ctx.worker.pre(ctx.session, {
			action: 'action-set-password@1.0.0',
			logContext: ctx.logContext,
			card: otherUser.id,
			type: otherUser.type,
			arguments: {
				currentPassword: password,
				newPassword: 'foobarbaz',
			},
		})) as any;
		options.logContext = options.context;
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			options,
		);
		await ctx.flushAll(session.id);
		const result = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);
		expect(result.error).toBe(true);
	});

	test('a community user should not be able to set a first time password for another user', async () => {
		const user = await ctx.createUser(coreTestUtils.generateRandomSlug());
		expect(user.data.roles).toEqual(['user-community']);
		const session = await ctx.createSession(user);

		const otherUser = await ctx.createUser(
			coreTestUtils.generateRandomSlug(),
			PASSWORDLESS_USER_HASH,
		);
		expect(otherUser.data.hash).toEqual(PASSWORDLESS_USER_HASH);
		expect(otherUser.data.roles).toEqual(['user-community']);

		// TODO: temporary workaround for context/logContext mismatch
		const options = (await ctx.worker.pre(ctx.session, {
			action: 'action-set-password@1.0.0',
			logContext: ctx.logContext,
			card: otherUser.id,
			type: otherUser.type,
			arguments: {
				currentPassword: null,
				newPassword: 'foobarbaz',
			},
		})) as any;
		options.logContext = options.context;
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			options,
		);
		await ctx.flushAll(session.id);
		const result = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);
		expect(result.error).toBe(true);
	});
});
