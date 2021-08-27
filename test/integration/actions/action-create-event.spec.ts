/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import { actionCreateEvent } from '../../../lib/actions/action-create-event';
import {
	after,
	before,
	makeContext,
	makeMessage,
	makeRequest,
} from './helpers';

const handler = actionCreateEvent.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('action-create-event', () => {
	test('should throw an error on invalid type', async () => {
		const message = await context.kernel.insertCard(
			context.context,
			context.session,
			makeMessage(context),
		);
		const request = makeRequest(context, {
			type: 'foobar',
			payload: message.data.payload,
		});

		expect.assertions(1);
		try {
			await handler(context.session, context, message, request);
		} catch (error: any) {
			expect(error.message).toEqual(`No such type: ${request.arguments.type}`);
		}
	});

	test('should return event card', async () => {
		const message = await context.kernel.insertCard(
			context.context,
			context.session,
			makeMessage(context),
		);
		const request = makeRequest(context, {
			type: 'message',
			payload: message.data.payload,
		});

		expect.assertions(1);
		const result = await handler(context.session, context, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.slug).toMatch(/^message-/);
		}
	});

	test('should throw an error on attempt to insert existing card', async () => {
		const message = await context.kernel.insertCard(
			context.context,
			context.session,
			makeMessage(context),
		);
		const request = makeRequest(context, {
			type: 'message',
			slug: message.slug,
			payload: message.data.payload,
		});

		expect.assertions(1);
		try {
			await handler(context.session, context, message, request);
		} catch (error: any) {
			expect(error.name).toEqual('JellyfishElementAlreadyExists');
		}
	});

	test('should create a link card', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		expect(typeCard).not.toBeNull();

		const cardRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-card@1.0.0',
				context: context.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {},
				},
			},
		);

		await context.flush(context.session);
		const cardResult: any = await context.queue.producer.waitResults(
			context.context,
			cardRequest,
		);
		expect(cardResult.error).toBe(false);

		const messageRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-event@1.0.0',
				context: context.context,
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

		await context.flush(context.session);
		const messageResult: any = await context.queue.producer.waitResults(
			context.context,
			messageRequest,
		);
		expect(messageResult.error).toBe(false);

		const [link] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				properties: {
					type: {
						type: 'string',
						const: 'link@1.0.0',
					},
					data: {
						type: 'object',
						properties: {
							from: {
								type: 'object',
								properties: {
									id: {
										type: 'string',
										const: messageResult.data.id,
									},
								},
								required: ['id'],
							},
						},
						required: ['from'],
					},
				},
				required: ['type', 'data'],
				additionalProperties: true,
			},
		);

		expect(link).toEqual(
			context.jellyfish.defaults({
				created_at: link.created_at,
				id: link.id,
				slug: link.slug,
				name: 'is attached to',
				type: 'link@1.0.0',
				data: {
					inverseName: 'has attached element',
					from: {
						id: messageResult.data.id,
						type: 'message@1.0.0',
					},
					to: {
						id: cardResult.data.id,
						type: 'card@1.0.0',
					},
				},
			}),
		);
	});

	test('should be able to add an event name', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		expect(typeCard).not.toBeNull();

		const cardRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-card@1.0.0',
				context: context.context,
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {},
				},
			},
		);

		await context.flush(context.session);
		const cardResult: any = await context.queue.producer.waitResults(
			context.context,
			cardRequest,
		);
		expect(cardResult.error).toBe(false);

		const messageRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-event@1.0.0',
				context: context.context,
				card: cardResult.data.id,
				type: cardResult.data.type,
				arguments: {
					type: 'message',
					name: 'Hello world',
					tags: [],
					payload: {
						message: 'johndoe',
					},
				},
			},
		);

		await context.flush(context.session);
		const messageResult: any = await context.queue.producer.waitResults(
			context.context,
			messageRequest,
		);
		expect(messageResult.error).toBe(false);

		const event = await context.jellyfish.getCardById(
			context.context,
			context.session,
			messageResult.data.id,
		);

		expect(event).not.toBeNull();

		expect(event.name).toBe('Hello world');
	});

	test("events should always inherit their parent's markers", async () => {
		const marker = 'org-test';
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		expect(typeCard).not.toBeNull();

		const cardRequest = await context.queue.producer.enqueue(
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
						markers: [marker],
					},
				},
			},
		);

		await context.flush(context.session);
		const cardResult: any = await context.queue.producer.waitResults(
			context.context,
			cardRequest,
		);
		expect(cardResult.error).toBe(false);

		const messageRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-event@1.0.0',
				context: context.context,
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

		await context.flush(context.session);
		const messageResult: any = await context.queue.producer.waitResults(
			context.context,
			messageRequest,
		);
		expect(messageResult.error).toBe(false);

		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			messageResult.data.id,
		);

		expect(card).not.toBeNull();
		expect(card.markers).toEqual([marker]);
	});
});
