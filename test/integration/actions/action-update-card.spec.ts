import { strict as assert } from 'assert';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import type { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { isArray, isNull } from 'lodash';
import { makeRequest } from './helpers';
import { ActionLibrary } from '../../../lib';
import { actionUpdateCard } from '../../../lib/actions/action-update-card';

const handler = actionUpdateCard.handler;
let ctx: integrationHelpers.IntegrationTestContext;
let actionContext: WorkerContext;
let guestUser: any;
let guestUserSession: any;

beforeAll(async () => {
	ctx = await integrationHelpers.before({
		plugins: [DefaultPlugin, ActionLibrary, ProductOsPlugin],
	});
	actionContext = ctx.worker.getActionContext({
		id: `test-${ctx.generateRandomID()}`,
	});

	guestUser = await ctx.kernel.getCardBySlug(
		ctx.logContext,
		ctx.session,
		'user-guest@1.0.0',
	);
	assert(guestUser);

	guestUserSession = await ctx.kernel.replaceCard(
		ctx.logContext,
		ctx.session,
		ctx.kernel.defaults({
			slug: 'session-guest',
			version: '1.0.0',
			type: 'session@1.0.0',
			data: {
				actor: guestUser.id,
			},
		}),
	);
	assert(guestUserSession);
});

afterAll(async () => {
	return integrationHelpers.after(ctx);
});

describe('action-update-card', () => {
	test('should throw an error on invalid type', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);
		supportThread.type = 'foobar@1.0.0';

		await expect(
			handler(ctx.session, actionContext, supportThread, makeRequest(ctx)),
		).rejects.toThrow(new Error(`No such type: ${supportThread.type}`));
	});

	test('should patch card', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);
		const request = makeRequest(ctx, {
			patch: [
				{
					op: 'replace',
					path: '/data/status',
					value: 'closed',
				},
			],
		});

		const result = await handler(
			ctx.session,
			actionContext,
			supportThread,
			request,
		);
		expect(isNull(result)).toBe(false);
		expect(isArray(result)).toBe(false);
		expect(result).toEqual({
			id: supportThread.id,
			type: supportThread.type,
			version: supportThread.version,
			slug: supportThread.slug,
		});

		const updated: any = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data.status).toEqual(request.arguments.patch[0].value);
	});

	test('should return contract summary even when nothing is updated', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);

		const request = makeRequest(ctx, {
			patch: [
				{
					op: 'replace',
					path: '/data/status',
					value: 'closed',
				},
			],
		});
		const result = await handler(
			ctx.session,
			actionContext,
			supportThread,
			request,
		);
		expect(isNull(result)).toBe(false);
		expect(isArray(result)).toBe(false);
		expect(result).toEqual({
			id: supportThread.id,
			type: supportThread.type,
			version: supportThread.version,
			slug: supportThread.slug,
		});

		const updated: any = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data.status).toEqual(request.arguments.patch[0].value);
	});

	test('should fail to update a card if the schema does not match', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);

		const request = makeRequest(ctx, {
			patch: [
				{
					op: 'replace',
					path: '/data',
					value: 'test',
				},
			],
		});
		await expect(
			handler(ctx.session, actionContext, supportThread, request),
		).rejects.toThrow(ctx.kernel.errors.JellyfishSchemaMismatch);
	});

	test('should update a card to add an extra property', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);

		const value = 'baz';
		const request = makeRequest(ctx, {
			patch: [
				{
					op: 'add',
					path: '/data/bar',
					value,
				},
			],
		});

		await handler(ctx.session, actionContext, supportThread, request);
		const updated: any = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data.bar).toEqual(value);
	});

	test('should update a card to set active to false', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);

		const request = makeRequest(ctx, {
			patch: [
				{
					op: 'replace',
					path: '/active',
					value: false,
				},
			],
		});
		await handler(ctx.session, actionContext, supportThread, request);
		const updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.active).toBe(false);
	});

	test('should update a card along with a reason', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);

		const reason = 'This card should be inactive';
		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-update-card@1.0.0',
				logContext: ctx.logContext,
				card: supportThread.id,
				type: supportThread.type,
				arguments: {
					reason,
					patch: [
						{
							op: 'replace',
							path: '/active',
							value: false,
						},
					],
				},
			},
		);

		await ctx.flushAll(ctx.session);
		const result: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);
		expect(result.error).toBe(false);

		const timeline = await ctx.kernel.query(ctx.logContext, ctx.session, {
			type: 'object',
			additionalProperties: true,
			required: ['type', 'data'],
			properties: {
				type: {
					type: 'string',
					const: 'update@1.0.0',
				},
				data: {
					type: 'object',
					required: ['target'],
					additionalProperties: true,
					properties: {
						target: {
							type: 'string',
							const: supportThread.id,
						},
					},
				},
			},
		});

		expect(timeline.length).toBe(1);
		expect(timeline[0].name).toBe(reason);
	});

	test('should update a card to set active to false using the card slug as input', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-update-card@1.0.0',
				logContext: ctx.logContext,
				card: supportThread.slug,
				type: supportThread.type,
				arguments: {
					reason: null,
					patch: [
						{
							op: 'replace',
							path: '/active',
							value: false,
						},
					],
				},
			},
		);

		await ctx.flushAll(ctx.session);
		const result: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);
		expect(result.error).toBe(false);

		const updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.active).toBe(false);
	});

	test('should update a card to override an array property', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
				tags: ['foo'],
			},
		);

		const request = makeRequest(ctx, {
			patch: [
				{
					op: 'replace',
					path: '/data/tags',
					value: [],
				},
			],
		});
		await handler(ctx.session, actionContext, supportThread, request);
		const updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data.tags).toEqual([]);
	});

	test('should add an update event if updating a card', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
				foo: 1,
			},
		);

		const request = makeRequest(ctx, {
			patch: [
				{
					op: 'replace',
					path: '/data/foo',
					value: 2,
				},
			],
		});
		await handler(ctx.session, actionContext, supportThread, request);

		const timeline = await ctx.kernel.query(
			ctx.logContext,
			ctx.session,
			{
				type: 'object',
				additionalProperties: true,
				required: ['data'],
				properties: {
					data: {
						type: 'object',
						required: ['target'],
						additionalProperties: true,
						properties: {
							target: {
								type: 'string',
								const: supportThread.id,
							},
						},
					},
				},
			},
			{
				sortBy: 'created_at',
			},
		);

		expect(timeline.length).toEqual(2);
		expect(timeline[0].type).toEqual('create@1.0.0');
		expect((timeline[0].data as any).payload.data.foo).toEqual(1);
		expect(timeline[1].type).toEqual('update@1.0.0');
		expect((timeline[1].data as any).payload[0].value).toEqual(2);
	});

	test("should update the markers of attached events when updating a card's markers ", async () => {
		const marker = 'org-test';
		const typeCard = await ctx.kernel.getCardBySlug(
			ctx.logContext,
			ctx.session,
			'card@latest',
		);
		assert(typeCard);

		const cardRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				logContext: ctx.logContext,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {},
				},
			},
		);
		await ctx.flushAll(ctx.session);
		const cardResult: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			cardRequest,
		);
		expect(cardResult.error).toBe(false);

		const messageRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				logContext: ctx.logContext,
				card: cardResult.data.id,
				type: cardResult.data.type,
				arguments: {
					type: 'message',
					tags: [],
					payload: {
						message: 'johndoe',
					},
				},
			},
		);
		await ctx.flushAll(ctx.session);
		const messageResult: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			messageRequest,
		);
		expect(messageResult.error).toBe(false);

		const updateRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-update-card@1.0.0',
				logContext: ctx.logContext,
				card: cardResult.data.id,
				type: cardResult.data.type,
				arguments: {
					reason: null,
					patch: [
						{
							op: 'replace',
							path: '/markers',
							value: [marker],
						},
					],
				},
			},
		);
		await ctx.flushAll(ctx.session);
		await ctx.queue.producer.waitResults(ctx.logContext, updateRequest);

		const message = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			messageResult.data.id,
		);
		assert(message);
		expect(message.markers).toEqual([marker]);
	});

	test('should be able to upsert a deeply nested card', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);
		const data = {
			status: 'open',
			foo: {
				bar: {
					baz: {
						qux: {
							foo: {
								bar: {
									baz: {
										qux: {
											foo: {
												bar: {
													baz: {
														qux: {
															foo: {
																bar: {
																	baz: {
																		qux: {
																			test: 1,
																		},
																	},
																},
															},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		};

		const request = makeRequest(ctx, {
			patch: [
				{
					op: 'add',
					path: '/data/foo',
					value: {},
				},
				{
					op: 'add',
					path: '/data/foo/bar',
					value: {},
				},
				{
					op: 'add',
					path: '/data/foo/bar/baz',
					value: {},
				},
				{
					op: 'add',
					path: '/data/foo/bar/baz/qux',
					value: {},
				},
				{
					op: 'add',
					path: '/data/foo/bar/baz/qux/foo',
					value: {},
				},
				{
					op: 'add',
					path: '/data/foo/bar/baz/qux/foo/bar',
					value: {},
				},
				{
					op: 'add',
					path: '/data/foo/bar/baz/qux/foo/bar/baz',
					value: {},
				},
				{
					op: 'add',
					path: '/data/foo/bar/baz/qux/foo/bar/baz/qux',
					value: {},
				},
				{
					op: 'add',
					path: '/data/foo/bar/baz/qux/foo/bar/baz/qux/foo',
					value: {},
				},
				{
					op: 'add',
					path: '/data/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar',
					value: {},
				},
				{
					op: 'add',
					path: '/data/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz',
					value: {},
				},
				{
					op: 'add',
					path: '/data/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz/qux',
					value: {},
				},
				{
					op: 'add',
					path: '/data/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz/qux/foo',
					value: {},
				},
				{
					op: 'add',
					path: '/data/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar',
					value: {},
				},
				{
					op: 'add',
					path: '/data/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz',
					value: {},
				},
				{
					op: 'add',
					path: '/data/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz/qux',
					value: {},
				},
				{
					op: 'add',
					path: '/data/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz/qux/foo/bar/baz/qux/test',
					value: 1,
				},
			],
		});
		await handler(ctx.session, actionContext, supportThread, request);
		const updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data).toEqual(data);
	});

	test('users with the "user-community" role should not be able to change other users passwords', async () => {
		const user1 = await ctx.createUser(ctx.generateRandomID().split('-')[0]);
		const user2 = await ctx.createUser(ctx.generateRandomID().split('-')[0]);
		const request = makeRequest(ctx, {
			patch: [
				{
					op: 'replace',
					path: '/data/hash',
					value: ctx.generateRandomID(),
				},
			],
		});

		await expect(
			handler(user1.session, actionContext, user2.contract, request),
		).rejects.toThrowError();
	});

	test('users with the "user-community" role should not be able to change other users roles', async () => {
		const user1 = await ctx.createUser(ctx.generateRandomID().split('-')[0]);
		const user2 = await ctx.createUser(ctx.generateRandomID().split('-')[0]);
		const request = makeRequest(ctx, {
			patch: [
				{
					op: 'replace',
					path: '/data/roles',
					value: ['user-community', 'test'],
				},
			],
		});

		await expect(
			handler(user1.session, actionContext, user2.contract, request),
		).rejects.toThrowError();
	});

	test('users with the "user-community" role should not be able to change the guest users roles', async () => {
		const user = await ctx.createUser(ctx.generateRandomID().split('-')[0]);
		const request = makeRequest(ctx, {
			patch: [
				{
					op: 'replace',
					path: '/data/roles',
					value: ['user-community', 'test'],
				},
			],
		});

		await expect(
			handler(user.session, actionContext, guestUser, request),
		).rejects.toThrowError();
	});

	test('users with the "user-community" role should not be able to change its own roles', async () => {
		const user = await ctx.createUser(ctx.generateRandomID().split('-')[0]);
		const request = makeRequest(ctx, {
			patch: [
				{
					op: 'replace',
					path: '/data/roles',
					value: ['user-community', 'test'],
				},
			],
		});

		await expect(
			handler(user.session, actionContext, user.contract, request),
		).rejects.toThrowError();
	});

	test('users should not be able to expose private data using an invalid update', async () => {
		const targetUser = await ctx.createUser(ctx.generateRandomID());
		const communityUser = await ctx.createUser(ctx.generateRandomID());
		const request = makeRequest(ctx, {
			patch: [
				{
					op: 'add',
					path: '/data/status',
					value: {
						title: 'Foo',
						value: 'Bar',
					},
				},
			],
		});

		await expect(
			handler(
				communityUser.session,
				actionContext,
				targetUser.contract,
				request,
			),
		).rejects.toThrow(
			new ctx.kernel.errors.JellyfishSchemaMismatch(
				'The updated card is invalid',
			),
		);
	});

	test('users should be able to change their own email addresses', async () => {
		const user = await ctx.createUser(ctx.generateRandomID().split('-')[0]);

		const email = `${ctx.generateRandomWords(1)}@foo.bar`;
		const request = makeRequest(ctx, {
			patch: [
				{
					op: 'replace',
					path: '/data/email',
					value: email,
				},
			],
		});
		await handler(user.session, actionContext, user.contract, request);
		const updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			user.contract.id,
		);
		assert(updated);
		expect(updated.data.email).toEqual(email);
	});

	test('the guest user should not be able to add a new role to another user', async () => {
		const targetUser = await ctx.createUser(
			ctx.generateRandomID().split('-')[0],
		);
		expect(targetUser.contract.data.roles).toEqual(['user-community']);

		const request = makeRequest(ctx, {
			patch: [
				{
					op: 'replace',
					path: '/data/roles/1',
					value: 'test',
				},
			],
		});
		await expect(
			handler(guestUserSession.id, actionContext, targetUser.contract, request),
		).rejects.toThrowError();
	});

	test('the guest user should not be able to change its own roles', async () => {
		const request = makeRequest(ctx, {
			patch: [
				{
					op: 'replace',
					path: '/data/roles/1',
					value: ['user-community'],
				},
			],
		});
		await expect(
			handler(guestUserSession.id, actionContext, guestUser, request),
		).rejects.toThrow(ctx.kernel.errors.JellyfishSchemaMismatch);
	});

	test('the guest user should not be able to change other users passwords', async () => {
		const targetUser = await ctx.createUser(
			ctx.generateRandomID().split('-')[0],
		);
		expect(targetUser.contract.data.roles).toEqual(['user-community']);

		const request = makeRequest(ctx, {
			patch: [
				{
					op: 'replace',
					path: '/data/hash',
					value: ctx.generateRandomID(),
				},
			],
		});
		await expect(
			handler(guestUserSession.id, actionContext, targetUser.contract, request),
		).rejects.toThrowError();
	});

	test('when updating a user, inaccessible fields should not be removed', async () => {
		const hash = ctx.generateRandomID();
		const user = await ctx.createUser(
			ctx.generateRandomID().split('-')[0],
			hash,
		);
		expect(user.contract.data.roles).toEqual(['user-community']);

		const email = 'test@example.com';
		const request = makeRequest(ctx, {
			patch: [
				{
					op: 'replace',
					path: '/data/email',
					value: email,
				},
			],
		});
		await handler(ctx.session, actionContext, user.contract, request);

		const updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			user.contract.id,
		);
		assert(updated);
		expect(updated.data.email).toEqual(email);
		expect(updated.data.roles).toEqual(['user-community']);
		expect(updated.data.hash).toEqual(hash);
	});
});
