import { strict as assert } from 'assert';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { makeRequest } from './helpers';
import ActionLibrary from '../../../lib';
import { actionCreateCard } from '../../../lib/actions/action-create-card';

const handler = actionCreateCard.handler;
let ctx: integrationHelpers.IntegrationTestContext;
let actionContext: WorkerContext;
let guestUser: any;
let guestUserSession: any;

beforeAll(async () => {
	ctx = await integrationHelpers.before([
		DefaultPlugin,
		ActionLibrary,
		ProductOsPlugin,
	]);
	actionContext = ctx.worker.getActionContext({
		id: `test-${ctx.generateRandomID()}`,
	});

	guestUser = await ctx.jellyfish.getCardBySlug(
		ctx.context,
		ctx.session,
		'user-guest@1.0.0',
	);
	assert(guestUser);

	guestUserSession = await ctx.jellyfish.replaceCard(
		ctx.context,
		ctx.session,
		ctx.jellyfish.defaults({
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

describe('action-create-card', () => {
	test('should use provided slug', async () => {
		const request = makeRequest(ctx, {
			properties: {
				id: ctx.generateRandomID(),
				name: ctx.generateRandomWords(3),
				slug: ctx.generateRandomSlug({
					prefix: 'message',
				}),
				type: 'message@1.0.0',
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				created_at: new Date().toISOString(),
				requires: [],
				capabilities: [],
				data: {
					actor: ctx.actor.id,
					payload: {
						message: ctx.generateRandomWords(3),
					},
					timestamp: new Date().toISOString(),
				},
			},
		});

		const result: any = await handler(
			ctx.session,
			actionContext,
			ctx.worker.typeContracts['message@1.0.0'],
			request,
		);
		assert(result);
		expect(result.slug).toEqual(request.arguments.properties.slug);
	});

	test('should generate a slug when one is not provided', async () => {
		const request = makeRequest(ctx, {
			properties: {
				id: ctx.generateRandomID(),
				name: ctx.generateRandomWords(3),
				type: 'message@1.0.0',
				version: '1.0.0',
				active: true,
				links: {},
				tags: [],
				markers: [],
				created_at: new Date().toISOString(),
				requires: [],
				capabilities: [],
				data: {
					actor: ctx.actor.id,
					payload: {
						message: ctx.generateRandomWords(3),
					},
					timestamp: new Date().toISOString(),
				},
			},
		});

		const result: any = await handler(
			ctx.session,
			actionContext,
			ctx.worker.typeContracts['message@1.0.0'],
			request,
		);
		assert(result);
		expect(result.slug).toMatch(/^message-/);
	});

	test('should fail to create an event with an action-create-card', async () => {
		const cardType = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		assert(cardType);

		const typeType = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'type@latest',
		);
		assert(typeType);

		const id = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeType.id,
				type: typeType.type,
				arguments: {
					reason: null,
					properties: {
						slug: 'test-thread',
						version: '1.0.0',
						data: {
							schema: {
								type: 'object',
								properties: {
									type: {
										type: 'string',
										const: 'test-thread@1.0.0',
									},
									data: {
										type: 'object',
										properties: {
											mentions: {
												type: 'array',
												$$formula:
													'AGGREGATE($events, "data.payload.mentions")',
											},
										},
										additionalProperties: true,
									},
								},
								additionalProperties: true,
								required: ['type', 'data'],
							},
						},
					},
				},
			},
		);
		await ctx.flushAll(ctx.session);
		const typeResult = await ctx.queue.producer.waitResults(ctx.context, id);
		expect(typeResult.error).toBe(false);

		const threadId = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: (typeResult.data as any).id,
				type: (typeResult.data as any).type,
				arguments: {
					reason: null,
					properties: {
						version: '1.0.0',
						slug: ctx.generateRandomSlug(),
						data: {
							mentions: [],
						},
					},
				},
			},
		);

		await ctx.flushAll(ctx.session);
		const threadResult = await ctx.queue.producer.waitResults(
			ctx.context,
			threadId,
		);
		expect(threadResult.error).toBe(false);

		await ctx.queue.producer.enqueue(ctx.worker.getId(), ctx.session, {
			action: 'action-create-card@1.0.0',
			card: cardType.id,
			context: ctx.context,
			type: cardType.type,
			arguments: {
				reason: null,
				properties: {
					version: '1.0.0',
					slug: 'bar',
					data: {
						timestamp: '2018-05-05T00:21:02.459Z',
						target: (threadResult.data as any).id,
						actor: ctx.actor.id,
						payload: {
							mentions: ['johndoe'],
						},
					},
				},
			},
		});

		await expect(ctx.flush(ctx.session)).rejects.toThrow(
			'You may not use card actions to create an event',
		);
	});

	test('should create a new card along with a reason', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		assert(typeCard);
		const createRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: 'My new card',
					properties: {
						slug: ctx.generateRandomSlug(),
						version: '1.0.0',
					},
				},
			},
		);
		await ctx.flushAll(ctx.session);
		const createResult = await ctx.queue.producer.waitResults(
			ctx.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const timeline = await ctx.jellyfish.query(ctx.context, ctx.session, {
			type: 'object',
			additionalProperties: true,
			required: ['type', 'data'],
			properties: {
				type: {
					type: 'string',
					const: 'create@1.0.0',
				},
				data: {
					type: 'object',
					required: ['target'],
					additionalProperties: true,
					properties: {
						target: {
							type: 'string',
							const: (createResult.data as any).id,
						},
					},
				},
			},
		});

		expect(timeline.length).toBe(1);
		expect(timeline[0].name).toBe('My new card');
	});

	test('should be able to insert a deeply nested card', async () => {
		const data = {
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

		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		assert(typeCard);
		const slug = ctx.generateRandomSlug();
		const createRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug,
						version: '1.0.0',
						data,
					},
				},
			},
		);
		await ctx.flushAll(ctx.session);
		const createResult = await ctx.queue.producer.waitResults(
			ctx.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			(createResult.data as any).id,
		);
		assert(card);
		expect(card.slug).toBe(slug);
		expect(card.version).toBe('1.0.0');
		expect(card.data).toEqual(data);
	});

	test('a community user cannot create a session that points to another user', async () => {
		const user = await ctx.createUser(ctx.generateRandomID().split('-')[0]);
		expect(user.contract.data.roles).toEqual(['user-community']);

		const otherUser = ctx.generateRandomID();
		assert(user.contract.id !== otherUser);

		await expect(
			handler(
				user.session,
				actionContext,
				ctx.worker.typeContracts['session@1.0.0'],
				{
					context: ctx.context,
					timestamp: new Date().toISOString(),
					actor: user.contract.id,
					originator: ctx.generateRandomID(),
					arguments: {
						reason: null,
						properties: {
							slug: ctx.generateRandomSlug({
								prefix: 'session',
							}),
							data: {
								actor: otherUser,
							},
						},
					},
				} as any,
			),
		).rejects.toThrow(ctx.jellyfish.errors.JellyfishPermissionsError);
	});

	test('creating a role with a community user session should fail', async () => {
		const user = await ctx.createUser(ctx.generateRandomID().split('-')[0]);
		expect(user.contract.data.roles).toEqual(['user-community']);

		await expect(
			handler(
				user.session,
				actionContext,
				ctx.worker.typeContracts['role@1.0.0'],
				{
					context: ctx.context,
					timestamp: new Date().toISOString(),
					actor: user.contract.id,
					originator: ctx.generateRandomID(),
					arguments: {
						reason: null,
						properties: {
							slug: ctx.generateRandomSlug({
								prefix: 'role',
							}),
							data: {
								read: {
									type: 'object',
									additionalProperties: true,
								},
							},
						},
					},
				} as any,
			),
		).rejects.toThrow(ctx.jellyfish.errors.JellyfishUnknownCardType);
	});

	test('creating a role with the guest user session should fail', async () => {
		await expect(
			handler(
				guestUserSession.id,
				actionContext,
				ctx.worker.typeContracts['role@1.0.0'],
				{
					context: ctx.context,
					timestamp: new Date().toISOString(),
					actor: guestUser.id,
					originator: ctx.generateRandomID(),
					arguments: {
						reason: null,
						properties: {
							slug: ctx.generateRandomSlug({
								prefix: 'role',
							}),
							data: {
								read: {
									type: 'object',
									additionalProperties: true,
								},
							},
						},
					},
				} as any,
			),
		).rejects.toThrow(ctx.jellyfish.errors.JellyfishUnknownCardType);
	});

	test('creating a user with the guest user session should fail', async () => {
		await expect(
			handler(
				guestUserSession.id,
				actionContext,
				ctx.worker.typeContracts['user@1.0.0'],
				{
					context: ctx.context,
					timestamp: new Date().toISOString(),
					actor: guestUser.id,
					originator: ctx.generateRandomID(),
					arguments: {
						reason: null,
						properties: {
							slug: ctx.generateRandomSlug({
								prefix: 'user',
							}),
							data: {
								roles: [],
								hash: ctx.generateRandomID(),
							},
						},
					},
				} as any,
			),
		).rejects.toThrow(ctx.jellyfish.errors.JellyfishPermissionsError);
	});

	test('users with no roles should not be able to create sessions for other users', async () => {
		const user = await ctx.createUser(ctx.generateRandomID().split('-')[0]);
		const targetUser = await ctx.createUser(
			ctx.generateRandomID().split('-')[0],
		);

		await ctx.worker.patchCard(
			ctx.context,
			ctx.session,
			ctx.worker.typeContracts[user.contract.type],
			{
				attachEvents: true,
				actor: ctx.actor.id,
			},
			user.contract,
			[
				{
					op: 'replace',
					path: '/data/roles',
					value: [],
				},
			],
		);

		await expect(
			handler(
				user.session,
				actionContext,
				ctx.worker.typeContracts['session@1.0.0'],
				{
					context: ctx.context,
					timestamp: new Date().toISOString(),
					actor: user.contract.id,
					originator: ctx.generateRandomID(),
					arguments: {
						reason: null,
						properties: {
							slug: ctx.generateRandomSlug({
								prefix: 'session',
							}),
							data: {
								actor: targetUser.contract.id,
							},
						},
					},
				} as any,
			),
		).rejects.toThrow(ctx.jellyfish.errors.JellyfishUnknownCardType);
	});

	test('users should not be able to create action requests', async () => {
		const user = await ctx.createUser(ctx.generateRandomID().split('-')[0]);

		await expect(
			handler(
				user.session,
				actionContext,
				ctx.worker.typeContracts['action-request@1.0.0'],
				{
					context: ctx.context,
					timestamp: new Date().toISOString(),
					actor: user.contract.id,
					originator: ctx.generateRandomID(),
					arguments: {
						reason: null,
						properties: {
							slug: ctx.generateRandomSlug({
								prefix: 'action-request',
							}),
							data: {
								epoch: 1559123116431,
								timestamp: '2019-05-29T09:45:16.431Z',
								context: {
									id: 'REQUEST-17.21.6-237c6999-64bb-4df0-ba7f-2f303003a609',
									api: 'SERVER-17.21.6-localhost-e0f6fe9b-60e3-4d41-b575-1e719febe55b',
								},
								actor: ctx.generateRandomID(),
								action: 'action-create-session@1.0.0',
								input: {
									id: ctx.generateRandomID(),
								},
								arguments: {
									password: ctx.generateRandomID(),
								},
							},
						},
					},
				} as any,
			),
		).rejects.toThrow(ctx.jellyfish.errors.JellyfishPermissionsError);
	});
});
