/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isEmpty from 'lodash/isEmpty';
import { mirror } from '../../../lib/actions/mirror';
import {
	after,
	before,
	makeContext,
	makeExternalEvent,
	makeMessage,
	makeRequest,
} from './helpers';

const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('mirror()', () => {
	test('should not sync back changes that came from external event', async () => {
		const externalEvent = await context.kernel.insertCard(
			context.context,
			context.session,
			makeExternalEvent(),
		);
		const request = makeRequest(context);
		request.originator = externalEvent.id;

		const result = await mirror(
			externalEvent.data.source,
			context.session,
			context,
			makeMessage(context),
			request,
		);
		expect(isArray(result)).toBe(true);
		expect(isEmpty(result)).toBe(true);
	});

	test('should return a list of cards', async () => {
		expect.assertions(1);
		const result = await mirror(
			'front',
			context.session,
			context,
			makeMessage(context),
			makeRequest(context),
		);
		if (isArray(result)) {
			expect(Object.keys(result[0])).toEqual(['id', 'type', 'version', 'slug']);
		}
	});
});
