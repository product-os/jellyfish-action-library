/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import { makeContext, makeMessage, makeRequest, session } from './helpers';
import { actionSetAdd } from '../../lib/actions/action-set-add';

const handler = actionSetAdd.handler;

describe('handler()', () => {
	test('should add value to array when property path is an array', async () => {
		const message = makeMessage({
			actor: session.data.actor,
			tags: [],
		});
		const context = makeContext([message]);
		const request = makeRequest({
			property: ['data', 'tags'],
			value: 'foo',
		});

		expect.assertions(2);
		const result = await handler(session.id, context, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(message.id);
		}

		const updated = await context.getCardById(session.id, message.id);
		expect(updated.data.tags).toEqual([request.arguments.value]);
	});

	test('should add an array of strings to an array', async () => {
		const message = makeMessage({
			actor: session.data.actor,
			tags: [],
		});
		const context = makeContext([message]);
		const request = makeRequest({
			property: ['data', 'tags'],
			value: ['foo', 'bar'],
		});

		expect.assertions(2);
		const result = await handler(session.id, context, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(message.id);
		}

		const updated = await context.getCardById(session.id, message.id);
		expect(updated.data.tags).toEqual(request.arguments.value);
	});

	test('should add value to array when property path is a string', async () => {
		const message = makeMessage({
			actor: session.data.actor,
			tags: [],
		});
		const context = makeContext([message]);
		const request = makeRequest({
			property: 'data.tags',
			value: 'foo',
		});

		const result = await handler(session.id, context, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(message.id);
		}

		const updated = await context.getCardById(session.id, message.id);
		expect(updated.data.tags).toEqual([request.arguments.value]);
	});
});
