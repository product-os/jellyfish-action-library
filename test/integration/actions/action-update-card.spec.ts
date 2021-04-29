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

describe('handler()', () => {
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
});
