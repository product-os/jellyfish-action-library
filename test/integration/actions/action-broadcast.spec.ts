/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import cloneDeep from 'lodash/cloneDeep';
import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import map from 'lodash/map';
import pick from 'lodash/pick';
import sortBy from 'lodash/sortBy';
import { v4 as uuidv4 } from 'uuid';
import { actionBroadcast } from '../../../lib/actions/action-broadcast';
import {
	after,
	before,
	createThread,
	makeContext,
	makeMessage,
	makeRequest,
} from './helpers';

const handler = actionBroadcast.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('action-broadcast', () => {
	test('should return a broadcast card on unmatched message', async () => {
		const message = await context.kernel.insertCard(
			context.context,
			context.session,
			makeMessage(context),
		);

		expect.assertions(1);
		const result = await handler(
			context.session,
			context,
			message,
			makeRequest(context, {
				message: uuidv4(),
			}),
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.slug).toMatch(/^broadcast-/);
		}
	});

	test('should return null on matched message', async () => {
		// Create a thread with a matching message already linked
		const { message, thread } = await createThread(context);

		// Execute action and check that no new message was broadcast
		const result = await handler(
			context.session,
			context,
			thread,
			makeRequest(context, {
				message: message.data.payload.message,
			}),
		);
		expect(result).toBeNull();
	});

	test('should throw an error on invalid session', async () => {
		const localContext = cloneDeep(context);
		localContext.session = uuidv4();
		localContext.privilegedSession = localContext.session;
		expect.assertions(1);
		try {
			await handler(
				localContext.session,
				localContext,
				makeMessage(localContext),
				makeRequest(localContext),
			);
		} catch (error: any) {
			expect(error.message).toEqual(
				`Invalid session: ${localContext.privilegedSession}`,
			);
		}
	});

	test('should post a broadcast message to an empty thread', async () => {
		const thread = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: context.generateRandomSlug(),
				data: {},
			},
		);

		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-broadcast@1.0.0',
				card: thread.id,
				type: thread.type,
				context: context.context,
				arguments: {
					message: 'Broadcast test',
				},
			},
		);

		await context.flush(context.session);
		const result = await context.queue.producer.waitResults(
			context.context,
			request,
		);
		expect(result.error).toBe(false);

		const [threadWithLinks] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				$$links: {
					'has attached element': {
						type: 'object',
						additionalProperties: true,
					},
				},
				required: ['id', 'type'],
				additionalProperties: true,
				properties: {
					id: {
						type: 'string',
						const: thread.id,
					},
					type: {
						type: 'string',
						const: thread.type,
					},
					links: {
						type: 'object',
					},
				},
			},
		);

		expect(threadWithLinks).toBeTruthy();
		expect(threadWithLinks.links).toBeTruthy();

		const timeline = threadWithLinks.links['has attached element'];

		expect(result.data).toBeTruthy();
		expect(
			map(timeline, (card) => {
				return pick(card, ['type', 'slug', 'data']);
			}),
		).toEqual([
			{
				type: 'message@1.0.0',
				slug: (result.data as any).slug,
				data: {
					actor: timeline[0].data.actor,
					timestamp: timeline[0].data.timestamp,
					target: thread.id,
					payload: {
						alertsUser: [],
						mentionsUser: [],
						alertsGroup: [],
						mentionsGroup: [],
						message: 'Broadcast test',
					},
				},
			},
		]);
	});

	test('should post a broadcast message to a non empty thread', async () => {
		const thread = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: context.generateRandomSlug(),
				data: {},
			},
		);

		const messageRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-event@1.0.0',
				context: context.context,
				card: thread.id,
				type: thread.type,
				arguments: {
					type: 'message',
					payload: {
						message: 'Foo',
					},
				},
			},
		);

		await context.flush(context.session);
		const messageResult = await context.queue.producer.waitResults(
			context.context,
			messageRequest,
		);
		expect(messageResult.error).toBe(false);

		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-broadcast@1.0.0',
				card: thread.id,
				type: thread.type,
				context: context.context,
				arguments: {
					message: 'Broadcast test',
				},
			},
		);

		await context.flush(context.session);
		const result: any = await context.queue.producer.waitResults(
			context.context,
			request,
		);
		expect(result.error).toBe(false);

		const [threadWithLinks] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				$$links: {
					'has attached element': {
						type: 'object',
						additionalProperties: true,
					},
				},
				required: ['id', 'type'],
				additionalProperties: true,
				properties: {
					id: {
						type: 'string',
						const: thread.id,
					},
					type: {
						type: 'string',
						const: thread.type,
					},
					links: {
						type: 'object',
					},
				},
			},
		);

		expect(threadWithLinks).toBeTruthy();
		expect(threadWithLinks.links).toBeTruthy();

		const timeline = threadWithLinks.links['has attached element'];

		const sortedTimeline = map(sortBy(timeline, 'data.timestamp'), (card) => {
			return pick(card, ['type', 'slug', 'data']);
		});

		expect(sortedTimeline).toEqual([
			{
				type: 'message@1.0.0',
				slug: sortedTimeline[0].slug,
				data: {
					actor: sortedTimeline[0].data.actor,
					timestamp: sortedTimeline[0].data.timestamp,
					target: thread.id,
					payload: {
						message: 'Foo',
					},
				},
			},
			{
				type: 'message@1.0.0',
				slug: result.data.slug,
				data: {
					actor: sortedTimeline[1].data.actor,
					timestamp: sortedTimeline[1].data.timestamp,
					target: thread.id,
					payload: {
						alertsUser: [],
						mentionsUser: [],
						alertsGroup: [],
						mentionsGroup: [],
						message: 'Broadcast test',
					},
				},
			},
		]);
	});

	test('should not broadcast the same message twice', async () => {
		const thread = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: context.generateRandomSlug(),
				data: {},
			},
		);

		const request1 = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-broadcast@1.0.0',
				card: thread.id,
				type: thread.type,
				context: context.context,
				arguments: {
					message: 'Broadcast test',
				},
			},
		);

		await context.flush(context.session);
		const result1: any = await context.queue.producer.waitResults(
			context.context,
			request1,
		);
		expect(result1.error).toBe(false);

		const messageRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-event@1.0.0',
				context: context.context,
				card: thread.id,
				type: thread.type,
				arguments: {
					type: 'message',
					payload: {
						message: 'Foo',
					},
				},
			},
		);

		await context.flush(context.session);
		const messageResult = await context.queue.producer.waitResults(
			context.context,
			messageRequest,
		);
		expect(messageResult.error).toBe(false);

		const request2 = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-broadcast@1.0.0',
				card: thread.id,
				type: thread.type,
				context: context.context,
				arguments: {
					message: 'Broadcast test',
				},
			},
		);

		await context.flush(context.session);
		const result2 = await context.queue.producer.waitResults(
			context.context,
			request2,
		);
		expect(result2.error).toBe(false);

		const [threadWithLinks] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				$$links: {
					'has attached element': {
						type: 'object',
						additionalProperties: true,
					},
				},
				required: ['id', 'type'],
				additionalProperties: true,
				properties: {
					id: {
						type: 'string',
						const: thread.id,
					},
					type: {
						type: 'string',
						const: thread.type,
					},
					links: {
						type: 'object',
					},
				},
			},
		);

		expect(threadWithLinks).toBeTruthy();
		expect(threadWithLinks.links).toBeTruthy();

		const timeline = threadWithLinks.links['has attached element'];

		const sortedTimeline = map(sortBy(timeline, 'data.timestamp'), (card) => {
			return pick(card, ['type', 'slug', 'data']);
		});

		expect(sortedTimeline).toEqual([
			{
				type: 'message@1.0.0',
				slug: result1.data.slug,
				data: {
					actor: sortedTimeline[0].data.actor,
					timestamp: sortedTimeline[0].data.timestamp,
					target: thread.id,
					payload: {
						alertsUser: [],
						mentionsUser: [],
						alertsGroup: [],
						mentionsGroup: [],
						message: 'Broadcast test',
					},
				},
			},
			{
				type: 'message@1.0.0',
				slug: sortedTimeline[1].slug,
				data: {
					actor: sortedTimeline[1].data.actor,
					timestamp: sortedTimeline[1].data.timestamp,
					target: thread.id,
					payload: {
						message: 'Foo',
					},
				},
			},
		]);
	});

	test('should broadcast different messages', async () => {
		const thread = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: context.generateRandomSlug(),
				data: {},
			},
		);

		const request1 = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-broadcast@1.0.0',
				card: thread.id,
				type: thread.type,
				context: context.context,
				arguments: {
					message: 'Broadcast test 1',
				},
			},
		);

		await context.flush(context.session);
		const result1: any = await context.queue.producer.waitResults(
			context.context,
			request1,
		);
		expect(result1.error).toBe(false);

		const messageRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-event@1.0.0',
				context: context.context,
				card: thread.id,
				type: thread.type,
				arguments: {
					type: 'message',
					payload: {
						message: 'Foo',
					},
				},
			},
		);

		await context.flush(context.session);
		const messageResult = await context.queue.producer.waitResults(
			context.context,
			messageRequest,
		);
		expect(messageResult.error).toBe(false);

		const request2 = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-broadcast@1.0.0',
				card: thread.id,
				type: thread.type,
				context: context.context,
				arguments: {
					message: 'Broadcast test 2',
				},
			},
		);

		await context.flush(context.session);
		const result2: any = await context.queue.producer.waitResults(
			context.context,
			request2,
		);
		expect(result2.error).toBe(false);

		const [threadWithLinks] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				$$links: {
					'has attached element': {
						type: 'object',
						additionalProperties: true,
					},
				},
				required: ['id', 'type'],
				additionalProperties: true,
				properties: {
					id: {
						type: 'string',
						const: thread.id,
					},
					type: {
						type: 'string',
						const: thread.type,
					},
					links: {
						type: 'object',
					},
				},
			},
		);

		expect(threadWithLinks).toBeTruthy();
		expect(threadWithLinks.links).toBeTruthy();

		const timeline = threadWithLinks.links['has attached element'];

		const sortedTimeline = map(sortBy(timeline, 'data.timestamp'), (card) => {
			return pick(card, ['type', 'slug', 'data']);
		});

		expect(sortedTimeline).toEqual([
			{
				type: 'message@1.0.0',
				slug: result1.data.slug,
				data: {
					actor: sortedTimeline[0].data.actor,
					timestamp: sortedTimeline[0].data.timestamp,
					target: thread.id,
					payload: {
						alertsUser: [],
						mentionsUser: [],
						alertsGroup: [],
						mentionsGroup: [],
						message: 'Broadcast test 1',
					},
				},
			},
			{
				type: 'message@1.0.0',
				slug: sortedTimeline[1].slug,
				data: {
					actor: sortedTimeline[1].data.actor,
					timestamp: sortedTimeline[1].data.timestamp,
					target: thread.id,
					payload: {
						message: 'Foo',
					},
				},
			},
			{
				type: 'message@1.0.0',
				slug: result2.data.slug,
				data: {
					actor: sortedTimeline[2].data.actor,
					timestamp: sortedTimeline[2].data.timestamp,
					target: thread.id,
					payload: {
						alertsUser: [],
						mentionsUser: [],
						alertsGroup: [],
						mentionsGroup: [],
						message: 'Broadcast test 2',
					},
				},
			},
		]);
	});
});
