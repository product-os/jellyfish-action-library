/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import {
	makeContext,
	makeMessage,
	makeRequest,
	session,
	types,
} from './helpers';
import { actionIncrement } from '../../lib/actions/action-increment';

const handler = actionIncrement.handler;

describe('handler()', () => {
	test('should throw an error on invalid type', async () => {
		const message = makeMessage();

		expect.assertions(1);
		try {
			await handler(session.id, makeContext(), message, makeRequest());
		} catch (error) {
			expect(error.message).toEqual(`No such type: ${message.type}`);
		}
	});

	test('should increment specified path if number', async () => {
		const message = makeMessage({
			actor: session.data.actor,
			count: 0,
		});
		const context = makeContext([types.message, message]);
		const request = makeRequest({
			path: ['data', 'count'],
		});

		expect.assertions(3);
		const result = await handler(session.id, context, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(message.id);
		}

		let updated = await context.getCardById(session.id, message.id);
		expect(updated.data.count).toEqual(1);

		await handler(session.id, context, updated, request);
		updated = await context.getCardById(session.id, message.id);
		expect(updated.data.count).toEqual(2);
	});

	test('should increment specified path if string', async () => {
		const message = makeMessage({
			actor: session.data.actor,
			count: 'foobar',
		});
		const context = makeContext([types.message, message]);
		const request = makeRequest({
			path: ['data', 'count'],
		});

		expect.assertions(3);
		const result = await handler(session.id, context, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(message.id);
		}

		let updated = await context.getCardById(session.id, message.id);
		expect(updated.data.count).toEqual(1);

		await handler(session.id, context, updated, request);
		updated = await context.getCardById(session.id, message.id);
		expect(updated.data.count).toEqual(2);
	});
});
