/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import { makeContext, makeMessage, makeRequest, session } from './helpers';
import { actionSetUpdate } from '../../lib/actions/action-set-update';

const handler = actionSetUpdate.handler;

describe('handler()', () => {
	test('should update array when property path is an array', async () => {
		const message = makeMessage({
			actor: session.data.actor,
			tags: ['foo'],
		});
		const context = makeContext([message]);
		const request = makeRequest({
			property: ['data', 'tags'],
			value: ['bar'],
		});

		expect.assertions(2);
		const result = await handler(session.id, context, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(message.id);
		}

		const updated = await context.getCardById(session.id, message.id);
		expect(updated.data.tags).toEqual(request.arguments.value);
	});

	test('should update array when property path is a string', async () => {
		const message = makeMessage({
			actor: session.data.actor,
			tags: ['foo'],
		});
		const context = makeContext([message]);
		const request = makeRequest({
			property: 'data.tags',
			value: ['bar'],
		});

		expect.assertions(2);
		const result = await handler(session.id, context, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(message.id);
		}

		const updated = await context.getCardById(session.id, message.id);
		expect(updated.data.tags).toEqual(request.arguments.value);
	});
});
