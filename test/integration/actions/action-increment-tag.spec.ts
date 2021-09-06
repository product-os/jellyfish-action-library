/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import pick from 'lodash/pick';
import { v4 as uuidv4 } from 'uuid';
import { actionIncrementTag } from '../../../lib/actions/action-increment-tag';
import {
	after,
	before,
	makeContext,
	makeMessage,
	makeRequest,
	makeTag,
} from './helpers';

const handler = actionIncrementTag.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('action-increment-tag', () => {
	test('should increment a tag', async () => {
		const tag = await context.kernel.insertCard(
			context.context,
			context.session,
			makeTag(),
		);
		const request = makeRequest(context, {
			name: tag.slug.replace(/^tag-/, ''),
		});

		const result = await handler(
			context.session,
			context,
			makeMessage(context),
			request,
		);
		expect(result).toEqual([pick(tag, ['id', 'type', 'version', 'slug'])]);

		let updated = await context.getCardById(context.session, tag.id);
		expect(updated.data.count).toEqual(1);

		await handler(context.session, context, makeMessage(context), request);
		updated = await context.getCardById(context.session, tag.id);
		expect(updated.data.count).toEqual(2);
	});

	test("should create a new tag if one doesn't exist", async () => {
		const name = `tag-${uuidv4()}`;
		const id = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				context: context.context,
				action: 'action-increment-tag@1.0.0',
				card: 'tag@1.0.0',
				type: 'type',
				arguments: {
					reason: null,
					name,
				},
			},
		);

		await context.flush(context.session);

		const result = await context.queue.producer.waitResults(
			context.context,
			id,
		);

		expect(result.error).toBe(false);
		expect(result.data.length).toBe(1);

		const tagContract = await context.jellyfish.getCardById(
			context.context,
			context.session,
			result.data[0].id,
		);

		expect(tagContract.type).toBe('tag@1.0.0');
		expect(tagContract.name).toBe(name);
		expect(tagContract.data.count).toBe(1);
	});
});
