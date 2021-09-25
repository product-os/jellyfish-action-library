/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { strict as assert } from 'assert';
import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import ActionLibrary from '../../../lib';
import { actionUpdateCard } from '../../../lib/actions/action-update-card';
import { makeRequest } from './helpers';

const handler = actionUpdateCard.handler;
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

		const updated: any = await ctx.jellyfish.getCardById(
			ctx.context,
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

		const updated: any = await ctx.jellyfish.getCardById(
			ctx.context,
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
		).rejects.toThrow(ctx.jellyfish.errors.JellyfishSchemaMismatch);
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
		const updated: any = await ctx.jellyfish.getCardById(
			ctx.context,
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
		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
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
				context: ctx.context,
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
			ctx.context,
			request,
		);
		expect(result.error).toBe(false);

		const timeline = await ctx.jellyfish.query(ctx.context, ctx.session, {
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
				context: ctx.context,
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
			ctx.context,
			request,
		);
		expect(result.error).toBe(false);

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
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
		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
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

		const timeline = await ctx.jellyfish.query(
			ctx.context,
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
		const typeCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'card@latest',
		);
		assert(typeCard);

		const cardRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-card@1.0.0',
				context: ctx.context,
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
			ctx.context,
			cardRequest,
		);
		expect(cardResult.error).toBe(false);

		const messageRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-create-event@1.0.0',
				context: ctx.context,
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
			ctx.context,
			messageRequest,
		);
		expect(messageResult.error).toBe(false);

		const updateRequest = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-update-card@1.0.0',
				context: ctx.context,
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
		await ctx.queue.producer.waitResults(ctx.context, updateRequest);

		const message = await ctx.jellyfish.getCardById(
			ctx.context,
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
		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data).toEqual(data);
	});
});
