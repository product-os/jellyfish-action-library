/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import { actionCreateCard } from '../../../lib/actions/action-create-card';
import {
	after,
	before,
	makeContext,
	makeMessage,
	makeRequest,
} from './helpers';

const handler = actionCreateCard.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('action-create-card', () => {
	test('should use provided slug', async () => {
		const request = makeRequest(context, {
			properties: makeMessage(context),
		});

		expect.assertions(1);
		const result = await handler(
			context.session,
			context,
			context.cards.message,
			request,
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.slug).toEqual(request.arguments.properties.slug);
		}
	});

	test('should generate a slug when one is not provided', async () => {
		const message = makeMessage(context);
		Reflect.deleteProperty(message, 'slug');
		const request = makeRequest(context, {
			properties: message,
		});

		expect.assertions(1);
		const result = await handler(
			context.session,
			context,
			context.cards.message,
			request,
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.slug).toMatch(/^message-/);
		}
	});

	test('should fail to create an event with an action-create-card', async () => {
		const cardType = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		const typeType = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'type@latest',
		);

		expect(typeType).not.toBeNull();
		expect(cardType).not.toBeNull();

		const id = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-card@1.0.0',
				context: context.context,
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

		await context.flush(context.session);
		const typeResult = await context.queue.producer.waitResults(
			context.context,
			id,
		);

		expect(typeResult.error).toBe(false);

		const threadId = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-card@1.0.0',
				context: context.context,
				card: (typeResult.data as any).id,
				type: (typeResult.data as any).type,
				arguments: {
					reason: null,
					properties: {
						version: '1.0.0',
						slug: context.generateRandomSlug(),
						data: {
							mentions: [],
						},
					},
				},
			},
		);

		await context.flush(context.session);
		const threadResult = await context.queue.producer.waitResults(
			context.context,
			threadId,
		);
		expect(threadResult.error).toBe(false);

		await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-card@1.0.0',
				card: cardType.id,
				context: context.context,
				type: cardType.type,
				arguments: {
					reason: null,
					properties: {
						version: '1.0.0',
						slug: 'bar',
						data: {
							timestamp: '2018-05-05T00:21:02.459Z',
							target: (threadResult.data as any).id,
							actor: context.actor.id,
							payload: {
								mentions: ['johndoe'],
							},
						},
					},
				},
			},
		);

		await expect(context.flush(context.session)).rejects.toThrow(
			'You may not use card actions to create an event',
		);
	});

	test('should create a new card along with a reason', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		expect(typeCard).not.toBeNull();
		const createRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-card@1.0.0',
				context: context.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: 'My new card',
					properties: {
						slug: context.generateRandomSlug(),
						version: '1.0.0',
					},
				},
			},
		);

		await context.flush(context.session);
		const createResult = await context.queue.producer.waitResults(
			context.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const timeline = await context.jellyfish.query(
			context.context,
			context.session,
			{
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
			},
		);

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

		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);
		expect(typeCard).not.toBeNull();
		const slug = context.generateRandomSlug();
		const createRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-card@1.0.0',
				context: context.context,
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

		await context.flush(context.session);
		const createResult = await context.queue.producer.waitResults(
			context.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			(createResult.data as any).id,
		);

		expect(card).not.toBeNull();
		expect(card.slug).toBe(slug);
		expect(card.version).toBe('1.0.0');
		expect(card.data).toEqual(data);
	});
});
