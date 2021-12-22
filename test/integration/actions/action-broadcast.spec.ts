import { strict as assert } from 'assert';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import type { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { cloneDeep, isArray, isNull, map, pick, sortBy } from 'lodash';
import ActionLibrary from '../../../lib';
import { actionBroadcast } from '../../../lib/actions/action-broadcast';

const handler = actionBroadcast.handler;
let ctx: integrationHelpers.IntegrationTestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await integrationHelpers.before({
		plugins: [DefaultPlugin, ActionLibrary, ProductOsPlugin],
	});
	actionContext = ctx.worker.getActionContext({
		id: `test-${ctx.generateRandomID()}`,
	});
});

afterAll(async () => {
	return integrationHelpers.after(ctx);
});

describe('action-broadcast', () => {
	test('should return a broadcast card on unmatched message', async () => {
		// Post a message to a thread
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);
		const message = await ctx.createMessage(
			ctx.actor.id,
			ctx.session,
			supportThread,
			ctx.generateRandomWords(3),
		);

		expect.hasAssertions();
		const result = await handler(ctx.session, actionContext, message, {
			context: {
				id: `TEST-${ctx.generateRandomID()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.actor.id,
			originator: ctx.generateRandomID(),
			arguments: {
				message: ctx.generateRandomID(),
			},
		} as any);
		if (!isNull(result) && !isArray(result)) {
			expect(result.slug).toMatch(/^broadcast-/);
		}
	});

	test('should return null on matched message', async () => {
		// Create a thread with a matching message already linked
		const body = ctx.generateRandomWords(3);
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);
		const message = await ctx.createMessage(
			ctx.actor.id,
			ctx.session,
			supportThread,
			body,
		);

		// Execute action and check that no new message was broadcast
		const result = await handler(ctx.session, actionContext, supportThread, {
			context: {
				id: `TEST-${ctx.generateRandomID()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.actor.id,
			originator: ctx.generateRandomID(),
			arguments: {
				message: (message as any).data.payload.message,
			},
		} as any);
		expect(result).toBeNull();
	});

	test('should throw an error on invalid session', async () => {
		const localContext = cloneDeep(actionContext);
		const session = ctx.generateRandomID();
		localContext.privilegedSession = session;

		expect.assertions(1);
		try {
			await handler(
				session,
				localContext,
				ctx.kernel.cards.user as any,
				{
					context: {
						id: `TEST-${ctx.generateRandomID()}`,
					},
					timestamp: new Date().toISOString(),
					actor: ctx.actor.id,
					originator: ctx.generateRandomID(),
					arguments: {},
				} as any,
			);
		} catch (error: any) {
			expect(error.message).toEqual(`Invalid session: ${session}`);
		}
	});

	test('should post a broadcast message to an empty thread', async () => {
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
				action: 'action-broadcast@1.0.0',
				card: supportThread.id,
				type: supportThread.type,
				logContext: ctx.logContext,
				arguments: {
					message: 'Broadcast test',
				},
			},
		);

		await ctx.flushAll(ctx.session);
		const result = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);
		expect(result.error).toBe(false);

		const [threadWithLinks] = await ctx.kernel.query(
			ctx.logContext,
			ctx.session,
			{
				type: 'object',
				$$links: {
					'has attached element': {
						type: 'object',
						additionalProperties: true,
						required: ['type'],
						properties: {
							type: {
								type: 'string',
								const: 'message@1.0.0',
							},
						},
					},
				},
				required: ['id', 'type'],
				additionalProperties: true,
				properties: {
					id: {
						type: 'string',
						const: supportThread.id,
					},
					type: {
						type: 'string',
						const: supportThread.type,
					},
					links: {
						type: 'object',
					},
				},
			},
		);

		expect(threadWithLinks).toBeTruthy();
		assert(threadWithLinks.links);
		const timeline = threadWithLinks.links['has attached element'];
		const sortedTimeline = map(sortBy(timeline, 'data.timestamp'), (card) => {
			return pick(card, ['slug', 'data.payload.message']);
		});
		expect(sortedTimeline[0].slug).toMatch(/^broadcast-message-/);
	});

	test('should post a broadcast message to a non empty thread', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);
		await ctx.createMessage(
			ctx.actor.id,
			ctx.session,
			supportThread,
			ctx.generateRandomWords(3),
		);

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-broadcast@1.0.0',
				card: supportThread.id,
				type: supportThread.type,
				logContext: ctx.logContext,
				arguments: {
					message: 'Broadcast test',
				},
			},
		);
		await ctx.flushAll(ctx.session);
		const result: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request,
		);
		expect(result.error).toBe(false);

		const [threadWithLinks] = await ctx.kernel.query(
			ctx.logContext,
			ctx.session,
			{
				type: 'object',
				$$links: {
					'has attached element': {
						type: 'object',
						additionalProperties: true,
						required: ['type'],
						properties: {
							type: {
								type: 'string',
								const: 'message@1.0.0',
							},
						},
					},
				},
				required: ['id', 'type'],
				additionalProperties: true,
				properties: {
					id: {
						type: 'string',
						const: supportThread.id,
					},
					type: {
						type: 'string',
						const: supportThread.type,
					},
					links: {
						type: 'object',
					},
				},
			},
		);
		expect(threadWithLinks).toBeTruthy();
		assert(threadWithLinks.links);

		const timeline = threadWithLinks.links['has attached element'];
		const sortedTimeline = map(sortBy(timeline, 'data.timestamp'), (card) => {
			return pick(card, ['slug', 'data.payload.message']);
		});
		expect(sortedTimeline.length).toEqual(2);
		expect(sortedTimeline[1].slug).toMatch(/^broadcast-message/);
	});

	test('should not broadcast the same message twice', async () => {
		// Create a new thread
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);

		// Create a broadcast message on the thread
		const request1 = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-broadcast@1.0.0',
				card: supportThread.id,
				type: supportThread.type,
				logContext: ctx.logContext,
				arguments: {
					message: 'Broadcast test',
				},
			},
		);
		await ctx.flushAll(ctx.session);
		const result1: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request1,
		);
		expect(result1.error).toBe(false);

		// Add a normal message to the thread
		await ctx.createMessage(ctx.actor.id, ctx.session, supportThread, 'Foo');

		// Try to create another broadcast message with the same message on the thread
		const request2 = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-broadcast@1.0.0',
				card: supportThread.id,
				type: supportThread.type,
				logContext: ctx.logContext,
				arguments: {
					message: 'Broadcast test',
				},
			},
		);
		await ctx.flushAll(ctx.session);
		const result2 = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request2,
		);
		expect(result2.error).toBe(false);

		const [threadWithLinks] = await ctx.kernel.query(
			ctx.logContext,
			ctx.session,
			{
				type: 'object',
				$$links: {
					'has attached element': {
						type: 'object',
						additionalProperties: true,
						required: ['type'],
						properties: {
							type: {
								type: 'string',
								const: 'message@1.0.0',
							},
						},
					},
				},
				required: ['id', 'type'],
				additionalProperties: true,
				properties: {
					id: {
						type: 'string',
						const: supportThread.id,
					},
					type: {
						type: 'string',
						const: supportThread.type,
					},
					links: {
						type: 'object',
					},
				},
			},
		);

		expect(threadWithLinks).toBeTruthy();
		assert(threadWithLinks.links);

		const timeline = threadWithLinks.links['has attached element'];
		expect(timeline.length).toEqual(2);
		const sortedTimeline = map(sortBy(timeline, 'data.timestamp'), (card) => {
			return pick(card, ['slug']);
		});
		expect(sortedTimeline[0].slug).toMatch(/^broadcast-message/);
	});

	test('should broadcast different messages', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);

		const message1 = 'Broadcast test 1';
		const request1 = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-broadcast@1.0.0',
				card: supportThread.id,
				type: supportThread.type,
				logContext: ctx.logContext,
				arguments: {
					message: message1,
				},
			},
		);
		await ctx.flushAll(ctx.session);
		const result1: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request1,
		);
		expect(result1.error).toBe(false);

		await ctx.createMessage(
			ctx.actor.id,
			ctx.session,
			supportThread,
			ctx.generateRandomWords(3),
		);

		const message2 = 'Broadcast test 2';
		const request2 = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-broadcast@1.0.0',
				card: supportThread.id,
				type: supportThread.type,
				logContext: ctx.logContext,
				arguments: {
					message: message2,
				},
			},
		);
		await ctx.flushAll(ctx.session);
		const result2: any = await ctx.queue.producer.waitResults(
			ctx.logContext,
			request2,
		);
		expect(result2.error).toBe(false);

		const [threadWithLinks] = await ctx.kernel.query(
			ctx.logContext,
			ctx.session,
			{
				type: 'object',
				$$links: {
					'has attached element': {
						type: 'object',
						additionalProperties: true,
						required: ['type'],
						properties: {
							type: {
								type: 'string',
								const: 'message@1.0.0',
							},
						},
					},
				},
				required: ['id', 'type'],
				additionalProperties: true,
				properties: {
					id: {
						type: 'string',
						const: supportThread.id,
					},
					type: {
						type: 'string',
						const: supportThread.type,
					},
					links: {
						type: 'object',
					},
				},
			},
		);

		expect(threadWithLinks).toBeTruthy();
		assert(threadWithLinks.links);

		const timeline = threadWithLinks.links['has attached element'];
		const sortedTimeline = map(sortBy(timeline, 'data.timestamp'), (card) => {
			return pick(card, ['slug', 'data.payload.message']);
		});
		expect(sortedTimeline.length).toEqual(3);
		expect(sortedTimeline[0].slug).toMatch(/^broadcast-message/);
		expect(sortedTimeline[0].data).toEqual({
			payload: {
				message: message1,
			},
		});
		expect(sortedTimeline[2].slug).toMatch(/^broadcast-message/);
		expect(sortedTimeline[2].data).toEqual({
			payload: {
				message: message2,
			},
		});
	});
});
