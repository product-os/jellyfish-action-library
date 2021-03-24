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
import { actionCreateEvent } from '../../lib/actions/action-create-event';

const handler = actionCreateEvent.handler;

describe('handler()', () => {
	test('should throw an error on invalid type', async () => {
		const request = makeRequest({
			type: 'message',
		});

		expect.assertions(1);
		try {
			await handler(session.id, makeContext(), makeMessage(), request);
		} catch (error) {
			expect(error.message).toEqual(`No such type: ${request.arguments.type}`);
		}
	});

	test('should return event card', async () => {
		const message = makeMessage();
		const context = makeContext([types.message, message]);
		const request = makeRequest({
			type: 'message',
		});

		expect.assertions(1);
		const result = await handler(session.id, context, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.slug).toMatch(/^message-/);
		}
	});

	test('should throw an error on attempt to insert existing card', async () => {
		const message = makeMessage();
		const context = makeContext([types.message, message]);
		const request = makeRequest({
			type: 'message',
			slug: message.slug,
		});

		expect.assertions(1);
		try {
			await handler(session.id, context, message, request);
		} catch (error) {
			expect(error.name).toEqual('JellyfishElementAlreadyExists');
		}
	});
});
