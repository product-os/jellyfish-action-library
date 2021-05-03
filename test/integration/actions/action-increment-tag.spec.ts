/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import pick from 'lodash/pick';
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
});
