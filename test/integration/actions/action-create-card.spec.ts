/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import { v4 as uuidv4 } from 'uuid';
import { actionCreateCard } from '../../../lib/actions/action-create-card';
import {
	after,
	before,
	makeContext,
	makeMessage,
	makeRequest,
} from './helpers';

const handler = actionCreateCard.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('handler()', () => {
	test('should throw an error on when trying to use an action to create an event', async () => {
		const request = makeRequest(context, {
			properties: {
				version: '1.0.0',
				data: {
					timestamp: new Date().toISOString(),
					target: uuidv4(),
					actor: uuidv4(),
				},
			},
		});

		expect.assertions(1);
		try {
			await handler(context.session, context, makeMessage(context), request);
		} catch (error) {
			expect(error.message).toEqual(
				'You may not use card actions to create an event',
			);
		}
	});

	test('should use provided slug', async () => {
		const request = makeRequest(context, {
			properties: makeMessage(context),
		});

		expect.assertions(1);
		const result = await handler(
			context.session,
			context,
			context.cards.message,
			request,
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.slug).toEqual(request.arguments.properties.slug);
		}
	});

	test('should generate a slug when one is not provided', async () => {
		const message = makeMessage(context);
		Reflect.deleteProperty(message, 'slug');
		const request = makeRequest(context, {
			properties: message,
		});

		expect.assertions(1);
		const result = await handler(
			context.session,
			context,
			context.cards.message,
			request,
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.slug).toMatch(/^message-/);
		}
	});
});
