/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import { actionCreateEvent } from '../../../lib/actions/action-create-event';
import {
	after,
	before,
	makeContext,
	makeMessage,
	makeRequest,
} from './helpers';

const handler = actionCreateEvent.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('handler()', () => {
	test('should throw an error on invalid type', async () => {
		const message = await context.kernel.insertCard(
			context.context,
			context.session,
			makeMessage(context),
		);
		const request = makeRequest(context, {
			type: 'foobar',
			payload: message.data.payload,
		});

		expect.assertions(1);
		try {
			await handler(context.session, context, message, request);
		} catch (error) {
			expect(error.message).toEqual(`No such type: ${request.arguments.type}`);
		}
	});

	test('should return event card', async () => {
		const message = await context.kernel.insertCard(
			context.context,
			context.session,
			makeMessage(context),
		);
		const request = makeRequest(context, {
			type: 'message',
			payload: message.data.payload,
		});

		expect.assertions(1);
		const result = await handler(context.session, context, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result.slug).toMatch(/^message-/);
		}
	});

	test('should throw an error on attempt to insert existing card', async () => {
		const message = await context.kernel.insertCard(
			context.context,
			context.session,
			makeMessage(context),
		);
		const request = makeRequest(context, {
			type: 'message',
			slug: message.slug,
			payload: message.data.payload,
		});

		expect.assertions(1);
		try {
			await handler(context.session, context, message, request);
		} catch (error) {
			expect(error.name).toEqual('JellyfishElementAlreadyExists');
		}
	});
});
