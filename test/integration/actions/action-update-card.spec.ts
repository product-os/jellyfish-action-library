/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import { v4 as uuidv4 } from 'uuid';
import { actionUpdateCard } from '../../../lib/actions/action-update-card';
import {
	after,
	before,
	makeContext,
	makeMessage,
	makeRequest,
} from './helpers';

const handler = actionUpdateCard.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('action-update-card', () => {
	test('should throw an error on invalid type', async () => {
		const message = makeMessage(context);
		message.type = 'foobar@1.0.0';

		expect.assertions(1);
		try {
			await handler(context.session, context, message, makeRequest(context));
		} catch (error) {
			expect(error.message).toEqual(`No such type: ${message.type}`);
		}
	});

	test('should patch card', async () => {
		const message = await context.kernel.insertCard(
			context.context,
			context.session,
			makeMessage(context),
		);
		const request = makeRequest(context, {
			patch: [
				{
					op: 'replace',
					path: '/data/payload/message',
					value: uuidv4(),
				},
			],
		});

		expect.assertions(2);
		const result = await handler(context.session, context, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result).toEqual({
				id: message.id,
				type: message.type,
				version: message.version,
				slug: message.slug,
			});
		}

		const updated = await context.getCardById(context.session, message.id);
		expect(updated.data.payload.message).toEqual(
			request.arguments.patch[0].value,
		);
	});

	test('should return contract summary even when nothing is updated', async () => {
		const message = await context.kernel.insertCard(
			context.context,
			context.session,
			makeMessage(context),
		);
		const request = makeRequest(context, {
			patch: [
				{
					op: 'replace',
					path: '/data/payload/message',
					value: message.data.payload.message,
				},
			],
		});

		expect.assertions(2);
		const result = await handler(context.session, context, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result).toEqual({
				id: message.id,
				type: message.type,
				version: message.version,
				slug: message.slug,
			});
		}

		const updated = await context.getCardById(context.session, message.id);
		expect(updated.data.payload.message).toEqual(
			request.arguments.patch[0].value,
		);
	});

	test('should fail to update a card if the schema does not match', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		expect(typeCard).not.toBeNull();

		const request = await context.queue.producer.enqueue(
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
						slug: context.generateRandomSlug(),
						version: '1.0.0',
						data: {
							foo: 'bar',
						},
					},
				},
			},
		);

		await context.flush(context.session);
		const result: any = await context.queue.producer.waitResults(
			context.context,
			request,
		);
		expect(result.error).toBe(false);

		await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-update-card@1.0.0',
				context: context.context,
				card: result.data.id,
				type: result.data.type,
				arguments: {
					reason: null,
					patch: [
						{
							op: 'add',
							path: '/foobar',
							value: true,
						},
					],
				},
			},
		);

		await expect(context.flush(context.session)).rejects.toThrow(
			context.jellyfish.errors.JellyfishSchemaMismatch,
		);
	});

	test('should update a card to add an extra property', async () => {
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
						data: {
							foo: 'bar',
						},
					},
				},
			},
		);

		await context.flush(context.session);
		const createResult: any = await context.queue.producer.waitResults(
			context.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const updateRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-update-card@1.0.0',
				context: context.context,
				card: createResult.data.id,
				type: createResult.data.type,
				arguments: {
					reason: null,
					patch: [
						{
							op: 'add',
							path: '/data/bar',
							value: 'baz',
						},
					],
				},
			},
		);

		await context.flush(context.session);
		const updateResult: any = await context.queue.producer.waitResults(
			context.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const updateCard = await context.jellyfish.getCardById(
			context.context,
			context.session,
			updateResult.data.id,
		);

		expect(updateCard).not.toBeNull();

		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			updateResult.data.id,
		);

		expect(card).not.toBeNull();

		expect(card).toEqual(
			context.kernel.defaults({
				created_at: updateCard.created_at,
				updated_at: updateCard.updated_at,
				linked_at: card.linked_at,
				id: updateResult.data.id,
				slug,
				name: null,
				version: '1.0.0',
				type: 'card@1.0.0',
				links: card.links,
				data: {
					foo: 'bar',
					bar: 'baz',
				},
			}),
		);
	});

	test('should update a card to set active to false', async () => {
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
					},
				},
			},
		);

		await context.flush(context.session);
		const createResult: any = await context.queue.producer.waitResults(
			context.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const updateRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-update-card@1.0.0',
				context: context.context,
				card: createResult.data.id,
				type: createResult.data.type,
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

		await context.flush(context.session);
		const updateResult: any = await context.queue.producer.waitResults(
			context.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			updateResult.data.id,
		);

		expect(card).not.toBeNull();
		expect(card).toEqual(
			context.kernel.defaults({
				created_at: card.created_at,
				updated_at: card.updated_at,
				linked_at: card.linked_at,
				id: updateResult.data.id,
				version: '1.0.0',
				name: null,
				slug,
				type: 'card@1.0.0',
				active: false,
				links: card.links,
			}),
		);
	});

	test('should update a card along with a reason', async () => {
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
					reason: null,
					properties: {
						slug: context.generateRandomSlug(),
						version: '1.0.0',
					},
				},
			},
		);

		await context.flush(context.session);
		const createResult: any = await context.queue.producer.waitResults(
			context.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const updateRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-update-card@1.0.0',
				context: context.context,
				card: createResult.data.id,
				type: createResult.data.type,
				arguments: {
					reason: 'This card should have been inactive',
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

		await context.flush(context.session);
		const updateResult: any = await context.queue.producer.waitResults(
			context.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

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
						const: 'update@1.0.0',
					},
					data: {
						type: 'object',
						required: ['target'],
						additionalProperties: true,
						properties: {
							target: {
								type: 'string',
								const: updateResult.data.id,
							},
						},
					},
				},
			},
		);

		expect(timeline.length).toBe(1);
		expect(timeline[0].name).toBe('This card should have been inactive');
	});

	test('should update a card to set active to false using the card slug as input', async () => {
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
					reason: null,
					properties: {
						version: '1.0.0',
						slug: 'foo-bar-baz',
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

		const updateRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-update-card@1.0.0',
				context: context.context,
				card: 'foo-bar-baz',
				type: 'card@1.0.0',
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

		await context.flush(context.session);
		const updateResult: any = await context.queue.producer.waitResults(
			context.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			updateResult.data.id,
		);

		expect(card).not.toBeNull();
		expect(card).toEqual(
			context.kernel.defaults({
				created_at: card.created_at,
				updated_at: card.updated_at,
				linked_at: card.linked_at,
				id: updateResult.data.id,
				type: 'card@1.0.0',
				name: null,
				version: '1.0.0',
				slug: 'foo-bar-baz',
				active: false,
				links: card.links,
			}),
		);
	});

	test('should update a card to override an array property', async () => {
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
						data: {
							roles: ['guest'],
						},
					},
				},
			},
		);

		await context.flush(context.session);
		const createResult: any = await context.queue.producer.waitResults(
			context.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const updateRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-update-card@1.0.0',
				context: context.context,
				card: createResult.data.id,
				type: createResult.data.type,
				arguments: {
					reason: null,
					patch: [
						{
							op: 'replace',
							path: '/data/roles',
							value: [],
						},
					],
				},
			},
		);

		await context.flush(context.session);
		const updateResult: any = await context.queue.producer.waitResults(
			context.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			updateResult.data.id,
		);

		expect(card).not.toBeNull();
		expect(card).toEqual(
			context.kernel.defaults({
				created_at: card.created_at,
				updated_at: card.updated_at,
				linked_at: card.linked_at,
				id: updateResult.data.id,
				type: 'card@1.0.0',
				name: null,
				slug,
				version: '1.0.0',
				links: card.links,
				data: {
					roles: [],
				},
			}),
		);
	});

	test('should add an update event if updating a card', async () => {
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
						data: {
							foo: 1,
						},
					},
				},
			},
		);

		await context.flush(context.session);
		const createResult: any = await context.queue.producer.waitResults(
			context.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const updateRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-update-card@1.0.0',
				context: context.context,
				card: createResult.data.id,
				type: createResult.data.type,
				arguments: {
					reason: null,
					patch: [
						{
							op: 'replace',
							path: '/data/foo',
							value: 2,
						},
					],
				},
			},
		);

		await context.flush(context.session);
		const updateResult = await context.queue.producer.waitResults(
			context.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const timeline = await context.jellyfish.query(
			context.context,
			context.session,
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
								const: createResult.data.id,
							},
						},
					},
				},
			},
			{
				sortBy: 'created_at',
			},
		);

		expect(timeline).toEqual(
			[
				{
					created_at: timeline[0].created_at,
					linked_at: timeline[0].linked_at,
					updated_at: null,
					id: timeline[0].id,
					name: null,
					version: '1.0.0',
					type: 'create@1.0.0',
					slug: timeline[0].slug,
					links: timeline[0].links,
					data: {
						actor: context.actor.id,
						target: createResult.data.id,
						timestamp: timeline[0].data.timestamp,
						payload: {
							slug,
							type: 'card@1.0.0',
							version: '1.0.0',
							data: {
								foo: 1,
							},
						},
					},
				},
				{
					created_at: timeline[1].created_at,
					updated_at: null,
					linked_at: timeline[1].linked_at,
					id: timeline[1].id,
					name: null,
					version: '1.0.0',
					type: 'update@1.0.0',
					slug: timeline[1].slug,
					links: timeline[1].links,
					data: {
						actor: context.actor.id,
						target: createResult.data.id,
						timestamp: timeline[1].data.timestamp,
						payload: [
							{
								op: 'replace',
								path: '/data/foo',
								value: 2,
							},
						],
					},
				},
			].map(context.kernel.defaults),
		);
	});

	test('should delete a card using action-update-card', async () => {
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
					},
				},
			},
		);

		await context.flush(context.session);
		const createResult: any = await context.queue.producer.waitResults(
			context.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const updateRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-update-card@1.0.0',
				context: context.context,
				card: createResult.data.id,
				type: createResult.data.type,
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

		await context.flush(context.session);
		const updateResult: any = await context.queue.producer.waitResults(
			context.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			updateResult.data.id,
		);

		expect(card).not.toBeNull();
		expect(card).toEqual(
			context.kernel.defaults({
				created_at: card.created_at,
				updated_at: card.updated_at,
				linked_at: card.linked_at,
				id: updateResult.data.id,
				name: null,
				type: 'card@1.0.0',
				slug,
				version: '1.0.0',
				active: false,
				links: card.links,
			}),
		);
	});

	test("should update the markers of attached events when updating a card's markers ", async () => {
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

		const updateRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-update-card@1.0.0',
				context: context.context,
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

		await context.flush(context.session);
		await context.queue.producer.waitResults(context.context, updateRequest);

		const message = await context.jellyfish.getCardById(
			context.context,
			context.session,
			messageResult.data.id,
		);

		expect(message).not.toBeNull();
		expect(message.markers).toEqual([marker]);
	});

	test('should be able to upsert a deeply nested card', async () => {
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
						slug: 'foo',
						version: '1.0.0',
						data: {},
					},
				},
			},
		);

		await context.flush(context.session);
		const createResult: any = await context.queue.producer.waitResults(
			context.context,
			createRequest,
		);
		expect(createResult.error).toBe(false);

		const updateRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-update-card@1.0.0',
				context: context.context,
				card: createResult.data.id,
				type: createResult.data.type,
				arguments: {
					reason: null,
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
				},
			},
		);

		await context.flush(context.session);
		const updateResult: any = await context.queue.producer.waitResults(
			context.context,
			updateRequest,
		);
		expect(updateResult.error).toBe(false);

		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			updateResult.data.id,
		);

		expect(card).not.toBeNull();
		expect(card.slug).toBe('foo');
		expect(card.version).toBe('1.0.0');
		expect(card.data).toEqual(data);
	});
});
