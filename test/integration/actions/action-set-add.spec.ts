/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import { actionSetAdd } from '../../../lib/actions/action-set-add';
import {
	after,
	before,
	makeContext,
	makeMessage,
	makeRequest,
} from './helpers';

const handler = actionSetAdd.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('action-set-add', () => {
	test('should add value to array when property path is an array', async () => {
		const message = await context.kernel.insertCard(
			context.context,
			context.session,
			makeMessage(context, {
				tags: [],
			}),
		);
		const request = makeRequest(context, {
			property: ['data', 'tags'],
			value: 'foo',
		});

		expect.assertions(2);
		const result = await handler(context.session, context, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(message.id);
		}

		const updated = await context.getCardById(context.session, message.id);
		expect(updated.data.tags).toEqual([request.arguments.value]);
	});

	test('should add an array of strings to an array', async () => {
		const message = await context.kernel.insertCard(
			context.context,
			context.session,
			makeMessage(context, {
				tags: [],
			}),
		);
		const request = makeRequest(context, {
			property: ['data', 'tags'],
			value: ['foo', 'bar'],
		});

		expect.assertions(2);
		const result = await handler(context.session, context, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(message.id);
		}

		const updated = await context.getCardById(context.session, message.id);
		expect(updated.data.tags).toEqual(request.arguments.value);
	});

	test('should add value to array when property path is a string', async () => {
		const message = await context.kernel.insertCard(
			context.context,
			context.session,
			makeMessage(context, {
				tags: [],
			}),
		);
		const request = makeRequest(context, {
			property: 'data.tags',
			value: 'foo',
		});

		const result = await handler(context.session, context, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(message.id);
		}

		const updated = await context.getCardById(context.session, message.id);
		expect(updated.data.tags).toEqual([request.arguments.value]);
	});
});
