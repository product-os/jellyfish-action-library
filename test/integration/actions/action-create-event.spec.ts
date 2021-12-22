import { strict as assert } from 'assert';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { isArray, isNull } from 'lodash';
import ActionLibrary from '../../../lib';
import { actionCreateEvent } from '../../../lib/actions/action-create-event';

const handler = actionCreateEvent.handler;
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

describe('action-create-event', () => {
	test('should throw an error on invalid type', async () => {
		const message = await ctx.createContract(
			ctx.actor.id,
			ctx.session,
			'message@1.0.0',
			ctx.generateRandomWords(3),
			{
				actor: ctx.actor.id,
				payload: {
					message: ctx.generateRandomWords(3),
				},
				timestamp: new Date().toISOString(),
			},
		);
		const request: any = {
			context: {
				id: `TEST-${ctx.generateRandomID()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.actor.id,
			originator: ctx.generateRandomID(),
			arguments: {
				type: 'foobar',
				payload: message.data.payload,
			},
		} as any;

		expect.assertions(1);
		try {
			await handler(ctx.session, actionContext, message, request);
		} catch (error: any) {
			expect(error.message).toEqual(`No such type: ${request.arguments.type}`);
		}
	});

	test('should return event card', async () => {
		const message = await ctx.createContract(
			ctx.actor.id,
			ctx.session,
			'message@1.0.0',
			ctx.generateRandomWords(3),
			{
				actor: ctx.actor.id,
				payload: {
					message: ctx.generateRandomWords(3),
				},
				timestamp: new Date().toISOString(),
			},
		);
		const request: any = {
			context: {
				id: `TEST-${ctx.generateRandomID()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.actor.id,
			originator: ctx.generateRandomID(),
			arguments: {
				type: 'message',
				payload: message.data.payload,
			},
		} as any;

		expect.assertions(1);
		const result = await handler(ctx.session, actionContext, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.slug).toMatch(/^message-/);
		}
	});

	test('should throw an error on attempt to insert existing card', async () => {
		const message = await ctx.createContract(
			ctx.actor.id,
			ctx.session,
			'message@1.0.0',
			ctx.generateRandomWords(3),
			{
				actor: ctx.actor.id,
				payload: {
					message: ctx.generateRandomWords(3),
				},
				timestamp: new Date().toISOString(),
			},
		);
		const request: any = {
			context: {
				id: `TEST-${ctx.generateRandomID()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.actor.id,
			originator: ctx.generateRandomID(),
			arguments: {
				type: 'message',
				slug: message.slug,
				payload: message.data.payload,
			},
		} as any;

		expect.assertions(1);
		try {
			await handler(ctx.session, actionContext, message, request);
		} catch (error: any) {
			expect(error.name).toEqual('JellyfishElementAlreadyExists');
		}
	});

	test('should create a link card', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);

		const messageRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				context: ctx.context,
				card: supportThread.id,
				type: supportThread.type,
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
			ctx.context,
			messageRequest,
		);
		expect(messageResult.error).toBe(false);

		const [link] = await ctx.jellyfish.query(ctx.context, ctx.session, {
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
		});

		expect(link).toEqual(
			ctx.jellyfish.defaults({
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
						id: supportThread.id,
						type: supportThread.type,
					},
				},
			}),
		);
	});

	test('should be able to add an event name', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(1),
			{
				status: 'open',
			},
		);

		const messageRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				context: ctx.context,
				card: supportThread.id,
				type: supportThread.type,
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
		await ctx.flushAll(ctx.session);
		const messageResult: any = await ctx.queue.producer.waitResults(
			ctx.context,
			messageRequest,
		);
		expect(messageResult.error).toBe(false);

		const event = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			messageResult.data.id,
		);
		assert(event);
		expect(event.name).toBe('Hello world');
	});

	test("events should always inherit their parent's markers", async () => {
		const marker = 'org-test';
		const supportThread = await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			ctx.worker.typeContracts['support-thread@1.0.0'],
			{
				attachEvents: true,
				actor: ctx.actor.id,
			},
			{
				name: ctx.generateRandomWords(3),
				slug: ctx.generateRandomSlug({
					prefix: 'support-thread',
				}),
				version: '1.0.0',
				markers: [marker],
				data: {
					status: 'open',
				},
			},
		);
		assert(supportThread);

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				context: ctx.context,
				card: supportThread.id,
				type: supportThread.type,
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
			ctx.context,
			request,
		);
		expect(messageResult.error).toBe(false);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			messageResult.data.id,
		);
		assert(card);
		expect(card.markers).toEqual([marker]);
	});
});
