/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { after, before, makeContext } from './helpers';

const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('action-set-password', () => {
	test('should not store the passwords in the queue when using action-set-password', async () => {
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
				username: context.generateRandomSlug({
					prefix: 'user',
				}),
				password: 'foobarbaz',
			},
		});

		const createUserRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			request1,
		);

		await context.flush(context.session);
		const result: any = await context.queue.producer.waitResults(
			context.context,
			createUserRequest,
		);
		expect(result.error).toBe(false);

		const plaintextPassword = 'foobarbaz';

		const request2 = await context.worker.pre(context.session, {
			action: 'action-set-password@1.0.0',
			context: context.context,
			card: result.data.id,
			type: result.data.type,
			arguments: {
				currentPassword: plaintextPassword,
				newPassword: 'new-password',
			},
		});

		await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			request2,
		);

		const request: any = await context.dequeue();

		expect(request).toBeTruthy();
		expect(request.data.arguments.currentPassword).toBeTruthy();
		expect(request.data.arguments.newPassword).toBeTruthy();
		expect(request.data.arguments.currentPassword).not.toBe(plaintextPassword);
		expect(request.data.arguments.newPassword).not.toBe('new-password');
	});

	test('should change the password of a password-less user given no password', async () => {
		const userCard = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				slug: context.generateRandomSlug({
					prefix: 'user',
				}),
				type: 'user@1.0.0',
				data: {
					email: 'johndoe@example.com',
					hash: 'PASSWORDLESS',
					roles: ['user-community'],
				},
			},
		);

		const resetRequestPre = await context.worker.pre(context.session, {
			action: 'action-set-password@1.0.0',
			context: context.context,
			card: userCard.id,
			type: userCard.type,
			arguments: {
				currentPassword: null,
				newPassword: 'new-password',
			},
		});

		const resetRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			resetRequestPre,
		);
		await context.flush(context.session);
		const resetResult = await context.queue.producer.waitResults(
			context.context,
			resetRequest,
		);
		expect(resetResult.error).toBe(false);

		const loginRequestPre = await context.worker.pre(context.session, {
			action: 'action-create-session@1.0.0',
			card: userCard.id,
			context: context.context,
			type: userCard.type,
			arguments: {
				password: 'new-password',
			},
		});

		const loginRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			loginRequestPre,
		);
		await context.flush(context.session);
		const loginResult = await context.queue.producer.waitResults(
			context.context,
			loginRequest,
		);
		expect(loginResult.error).toBe(false);

		const user = await context.jellyfish.getCardById(
			context.context,
			context.session,
			userCard.id,
		);

		expect(user).not.toBeNull();
		expect(user.data.hash).not.toBe('new-password');
	});

	test('should change a user password', async () => {
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
				username: context.generateRandomSlug({
					prefix: 'user',
				}),
				password: 'foobarbaz',
			},
		});

		const createUserRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			request1,
		);

		await context.flush(context.session);
		const signupResult: any = await context.queue.producer.waitResults(
			context.context,
			createUserRequest,
		);
		expect(signupResult.error).toBe(false);

		const plaintextPassword = 'foobarbaz';

		const request2 = await context.worker.pre(context.session, {
			action: 'action-set-password@1.0.0',
			context: context.context,
			card: signupResult.data.id,
			type: signupResult.data.type,
			arguments: {
				currentPassword: plaintextPassword,
				newPassword: 'new-password',
			},
		});

		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			request2,
		);
		await context.flush(context.session);
		const result = await context.queue.producer.waitResults(
			context.context,
			request,
		);
		expect(result.error).toBe(false);

		await expect(
			context.worker.pre(context.session, {
				action: 'action-create-session@1.0.0',
				card: signupResult.data.id,
				context: context.context,
				type: signupResult.data.type,
				arguments: {
					password: plaintextPassword,
				},
			}),
		).rejects.toThrow(context.worker.errors.WorkerAuthenticationError);

		const request3 = await context.worker.pre(context.session, {
			action: 'action-create-session@1.0.0',
			card: signupResult.data.id,
			context: context.context,
			type: signupResult.data.type,
			arguments: {
				password: 'new-password',
			},
		});

		const loginRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			request3,
		);
		await context.flush(context.session);
		const loginResult = await context.queue.producer.waitResults(
			context.context,
			loginRequest,
		);
		expect(loginResult.error).toBe(false);
	});

	test('should not change a user password given invalid current password', async () => {
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
				username: context.generateRandomSlug({
					prefix: 'user',
				}),
				password: 'foobarbaz',
			},
		});

		const createUserRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			request1,
		);

		await context.flush(context.session);
		const signupResult: any = await context.queue.producer.waitResults(
			context.context,
			createUserRequest,
		);
		expect(signupResult.error).toBe(false);

		await expect(
			context.worker.pre(context.session, {
				action: 'action-set-password@1.0.0',
				context: context.context,
				card: signupResult.data.id,
				type: signupResult.data.type,
				arguments: {
					currentPassword: 'xxxxxxxxxxxxxxxxxxxxxx',
					newPassword: 'new-password',
				},
			}),
		).rejects.toThrow(context.worker.errors.WorkerAuthenticationError);
	});

	test('should not change a user password given a null current password', async () => {
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
				username: context.generateRandomSlug({
					prefix: 'user',
				}),
				password: 'foobarbaz',
			},
		});

		const createUserRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			request1,
		);

		await context.flush(context.session);
		const signupResult: any = await context.queue.producer.waitResults(
			context.context,
			createUserRequest,
		);
		expect(signupResult.error).toBe(false);

		await expect(
			context.worker.pre(context.session, {
				action: 'action-set-password@1.0.0',
				context: context.context,
				card: signupResult.data.id,
				type: signupResult.data.type,
				arguments: {
					currentPassword: null,
					newPassword: 'new-password',
				},
			}),
		).rejects.toThrow(context.worker.errors.WorkerAuthenticationError);
	});

	test('should change the hash when updating a user password', async () => {
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
		const signupResult: any = await context.queue.producer.waitResults(
			context.context,
			createUserRequest,
		);
		expect(signupResult.error).toBe(false);

		const userBefore = await context.jellyfish.getCardById(
			context.context,
			context.session,
			signupResult.data.id,
		);

		const plaintextPassword = 'foobarbaz';

		const request2 = await context.worker.pre(context.session, {
			action: 'action-set-password@1.0.0',
			context: context.context,
			card: signupResult.data.id,
			type: signupResult.data.type,
			arguments: {
				currentPassword: plaintextPassword,
				newPassword: 'new-password',
			},
		});

		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			request2,
		);
		await context.flush(context.session);
		const result = await context.queue.producer.waitResults(
			context.context,
			request,
		);
		expect(result.error).toBe(false);

		const userAfter = await context.jellyfish.getCardById(
			context.context,
			context.session,
			signupResult.data.id,
		);

		expect(userBefore).not.toBeNull();
		expect(userAfter).not.toBeNull();
		expect(userBefore.data.hash).toBeTruthy();
		expect(userAfter.data.hash).toBeTruthy();
		expect(userBefore.data.hash).not.toBe(userAfter.data.hash);
	});

	test('should not store the passwords when using action-set-password on a first time password', async () => {
		const userCard = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				slug: context.generateRandomSlug({
					prefix: 'user',
				}),
				type: 'user@1.0.0',
				data: {
					email: 'johndoe@example.com',
					hash: 'PASSWORDLESS',
					roles: ['user-community'],
				},
			},
		);

		const resetRequest = await context.worker.pre(context.session, {
			action: 'action-set-password@1.0.0',
			context: context.context,
			card: userCard.id,
			type: userCard.type,
			arguments: {
				currentPassword: null,
				newPassword: 'new-password',
			},
		});

		await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			resetRequest,
		);

		const request: any = await context.dequeue();

		expect(request).toBeTruthy();
		expect(request.data.arguments.currentPassword).toBeFalsy();
		expect(request.data.arguments.newPassword).toBeTruthy();
		expect(request.data.arguments.newPassword).not.toBe('new-password');
	});

	test('should not change the password of a password-less user given a password', async () => {
		const userCard = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				slug: context.generateRandomSlug({
					prefix: 'user',
				}),
				type: 'user@1.0.0',
				data: {
					email: 'johndoe@example.com',
					hash: 'PASSWORDLESS',
					roles: ['user-community'],
				},
			},
		);

		await expect(
			context.worker.pre(context.session, {
				action: 'action-set-password@1.0.0',
				context: context.context,
				card: userCard.id,
				type: userCard.type,
				arguments: {
					currentPassword: 'xxxxxxxxxxxxxxxxxxxxxx',
					newPassword: 'new-password',
				},
			}),
		).rejects.toThrow(context.worker.errors.WorkerAuthenticationError);
	});
});
