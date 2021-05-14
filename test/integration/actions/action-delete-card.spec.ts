/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { actionDeleteCard } from '../../../lib/actions/action-delete-card';
import {
	after,
	before,
	makeContext,
	makeMessage,
	makeRequest,
} from './helpers';

const handler = actionDeleteCard.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('action-delete-card', () => {
	test('should return card if already not active', async () => {
		const message = makeMessage(context);
		message.active = false;
		const inserted = await context.kernel.insertCard(
			context.context,
			context.session,
			message,
		);

		const result = await handler(
			context.session,
			context,
			inserted,
			makeRequest(context),
		);
		expect(result).toEqual({
			id: message.id,
			type: message.type,
			version: message.version,
			slug: message.slug,
		});
	});

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

	test('should delete a card', async () => {
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

		const deleteRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-delete-card@1.0.0',
				context: context.context,
				card: (createResult.data as any).id,
				type: (createResult.data as any).type,
				arguments: {},
			},
		);

		await context.flush(context.session);
		const deleteResult = await context.queue.producer.waitResults(
			context.context,
			deleteRequest,
		);
		expect(deleteResult.error).toBe(false);

		const card = await context.jellyfish.getCardById(
			context.context,
			context.session,
			(deleteResult.data as any).id,
		);
		expect(card).not.toBeNull();
		expect(card).toEqual(
			context.kernel.defaults({
				created_at: card.created_at,
				updated_at: card.updated_at,
				linked_at: card.linked_at,
				id: (deleteResult.data as any).id,
				name: null,
				version: '1.0.0',
				slug: 'foo',
				type: 'card@1.0.0',
				active: false,
				links: card.links,
			}),
		);
	});
});
