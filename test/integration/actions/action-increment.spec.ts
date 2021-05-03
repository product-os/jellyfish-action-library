/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import { actionIncrement } from '../../../lib/actions/action-increment';
import {
	after,
	before,
	makeContext,
	makeMessage,
	makeRequest,
} from './helpers';

const handler = actionIncrement.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('action-increment', () => {
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

	test('should increment specified path if number', async () => {
		const message = await context.kernel.insertCard(
			context.context,
			context.session,
			makeMessage(context, {
				count: 0,
			}),
		);
		const request = makeRequest(context, {
			path: ['data', 'count'],
		});

		expect.assertions(3);
		const result = await handler(context.session, context, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(message.id);
		}

		let updated = await context.getCardById(context.session, message.id);
		expect(updated.data.count).toEqual(1);

		await handler(context.session, context, updated, request);
		updated = await context.getCardById(context.session, message.id);
		expect(updated.data.count).toEqual(2);
	});

	test('should increment specified path if string', async () => {
		const message = await context.kernel.insertCard(
			context.context,
			context.session,
			makeMessage(context, {
				count: 'foobar',
			}),
		);
		const request = makeRequest(context, {
			path: ['data', 'count'],
		});

		expect.assertions(3);
		const result = await handler(context.session, context, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(message.id);
		}

		let updated = await context.getCardById(context.session, message.id);
		expect(updated.data.count).toEqual(1);

		await handler(context.session, context, updated, request);
		updated = await context.getCardById(context.session, message.id);
		expect(updated.data.count).toEqual(2);
	});
});
