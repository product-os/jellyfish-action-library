import { strict as assert } from 'assert';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import bcrypt from 'bcrypt';
import ActionLibrary from '../../../lib';
import {
	BCRYPT_SALT_ROUNDS,
	PASSWORDLESS_USER_HASH,
} from '../../../lib/actions/constants';

let ctx: integrationHelpers.IntegrationTestContext;

beforeAll(async () => {
	ctx = await integrationHelpers.before([
		DefaultPlugin,
		ActionLibrary,
		ProductOsPlugin,
	]);
});

afterAll(async () => {
	return integrationHelpers.after(ctx);
});

describe('action-set-password', () => {
	test('should not store the passwords in the queue when using action-set-password', async () => {
		const password = ctx.generateRandomID();
		const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
		const user = await ctx.createUser(ctx.generateRandomWords(1), hash);

		const newPassword = ctx.generateRandomID();
		const request = await ctx.worker.pre(ctx.session, {
			action: 'action-set-password@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {
				currentPassword: password,
				newPassword,
			},
		});
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
			ctx.generateRandomWords(1),
			PASSWORDLESS_USER_HASH,
		);

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			await ctx.worker.pre(ctx.session, {
				action: 'action-set-password@1.0.0',
				context: ctx.context,
				card: user.contract.id,
				type: user.contract.type,
				arguments: {
					currentPassword: null,
					newPassword: ctx.generateRandomID(),
				},
			}),
		);
		await ctx.flushAll(ctx.session);
		const resetResult = await ctx.queue.producer.waitResults(
			ctx.context,
			request,
		);
		expect(resetResult.error).toBe(false);

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			user.contract.id,
		);
		assert(updated);
		expect(updated.data.hash).toBeTruthy();
		expect(updated.data.hash).not.toEqual(PASSWORDLESS_USER_HASH);
	});

	test('should change a user password', async () => {
		const password = ctx.generateRandomID();
		const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
		const user = await ctx.createUser(ctx.generateRandomWords(1), hash);

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			await ctx.worker.pre(ctx.session, {
				action: 'action-set-password@1.0.0',
				context: ctx.context,
				card: user.contract.id,
				type: user.contract.type,
				arguments: {
					currentPassword: password,
					newPassword: ctx.generateRandomID(),
				},
			}),
		);
		await ctx.flushAll(ctx.session);
		const result = await ctx.queue.producer.waitResults(ctx.context, request);
		expect(result.error).toBe(false);

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			user.contract.id,
		);
		assert(updated);
		expect(updated.data.hash).toBeTruthy();
		expect(updated.data.hash).not.toEqual(hash);
	});

	test('should not change a user password given invalid current password', async () => {
		const password = ctx.generateRandomID();
		const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
		const user = await ctx.createUser(ctx.generateRandomWords(1), hash);

		await expect(
			ctx.worker.pre(ctx.session, {
				action: 'action-set-password@1.0.0',
				context: ctx.context,
				card: user.contract.id,
				type: user.contract.type,
				arguments: {
					currentPassword: 'xxxxxxxxxxxxxxxxxxxxxx',
					newPassword: ctx.generateRandomID(),
				},
			}),
		).rejects.toThrow(ctx.worker.errors.WorkerAuthenticationError);
	});

	test('should not change a user password given a null current password', async () => {
		const password = ctx.generateRandomID();
		const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
		const user = await ctx.createUser(ctx.generateRandomWords(1), hash);

		await expect(
			ctx.worker.pre(ctx.session, {
				action: 'action-set-password@1.0.0',
				context: ctx.context,
				card: user.contract.id,
				type: user.contract.type,
				arguments: {
					currentPassword: null,
					newPassword: 'new-password',
				},
			}),
		).rejects.toThrow(ctx.worker.errors.WorkerAuthenticationError);
	});

	test('should not store the passwords when using action-set-password on a first time password', async () => {
		const user = await ctx.createUser(
			ctx.generateRandomWords(1),
			PASSWORDLESS_USER_HASH,
		);

		await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			await ctx.worker.pre(ctx.session, {
				action: 'action-set-password@1.0.0',
				context: ctx.context,
				card: user.contract.id,
				type: user.contract.type,
				arguments: {
					currentPassword: null,
					newPassword: ctx.generateRandomID(),
				},
			}),
		);

		const dequeued: any = await ctx.dequeue();
		expect(dequeued.data.arguments.currentPassword).toEqual('');
		expect(dequeued.data.arguments.newPassword).toBeTruthy();
		expect(dequeued.data.arguments.newPassword).not.toBe('new-password');
	});

	test('should not change the password of a password-less user given a password', async () => {
		const user = await ctx.createUser(
			ctx.generateRandomWords(1),
			PASSWORDLESS_USER_HASH,
		);

		await expect(
			ctx.worker.pre(ctx.session, {
				action: 'action-set-password@1.0.0',
				context: ctx.context,
				card: user.contract.id,
				type: user.contract.type,
				arguments: {
					currentPassword: 'xxxxxxxxxxxxxxxxxxxxxx',
					newPassword: 'new-password',
				},
			}),
		).rejects.toThrow(ctx.worker.errors.WorkerAuthenticationError);
	});

	test('a community user should not be able to reset other users passwords', async () => {
		const user = await ctx.createUser(ctx.generateRandomWords(1));
		expect(user.contract.data.roles).toEqual(['user-community']);

		const password = ctx.generateRandomID().split('-')[0];
		const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
		const otherUser = await ctx.createUser(ctx.generateRandomWords(1), hash);
		expect(otherUser.contract.data.hash).toEqual(hash);
		expect(otherUser.contract.data.roles).toEqual(['user-community']);

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			user.session,
			await ctx.worker.pre(ctx.session, {
				action: 'action-set-password@1.0.0',
				context: ctx.context,
				card: otherUser.contract.id,
				type: otherUser.contract.type,
				arguments: {
					currentPassword: password,
					newPassword: 'foobarbaz',
				},
			}),
		);
		await ctx.flushAll(user.session);
		const result = await ctx.queue.producer.waitResults(ctx.context, request);
		expect(result.error).toBe(true);
	});

	test('a community user should not be able to set a first time password for another user', async () => {
		const user = await ctx.createUser(ctx.generateRandomWords(1));
		expect(user.contract.data.roles).toEqual(['user-community']);

		const otherUser = await ctx.createUser(
			ctx.generateRandomWords(1),
			PASSWORDLESS_USER_HASH,
		);
		expect(otherUser.contract.data.hash).toEqual(PASSWORDLESS_USER_HASH);
		expect(otherUser.contract.data.roles).toEqual(['user-community']);

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			user.session,
			await ctx.worker.pre(ctx.session, {
				action: 'action-set-password@1.0.0',
				context: ctx.context,
				card: otherUser.contract.id,
				type: otherUser.contract.type,
				arguments: {
					currentPassword: null,
					newPassword: 'foobarbaz',
				},
			}),
		);
		await ctx.flushAll(user.session);
		const result = await ctx.queue.producer.waitResults(ctx.context, request);
		expect(result.error).toBe(true);
	});
});
