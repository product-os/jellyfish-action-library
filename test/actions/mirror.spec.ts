/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isEmpty from 'lodash/isEmpty';
import { mirror } from '../../lib/actions/mirror';
import {
	makeContext,
	makeExternalEvent,
	makeMessage,
	makeRequest,
	session,
} from './helpers';

describe('mirror()', () => {
	test('should not sync back changes that came from external event', async () => {
		const externalEvent = makeExternalEvent();
		const context = makeContext([externalEvent]);
		const request = makeRequest();
		request.originator = externalEvent.id;

		const result = await mirror(
			externalEvent.data.source,
			session.id,
			context,
			makeMessage(),
			request,
		);
		expect(isArray(result)).toBe(true);
		expect(isEmpty(result)).toBe(true);
	});

	test('should return a list of cards', async () => {
		expect.assertions(1);
		const result = await mirror(
			'front',
			session.id,
			makeContext(),
			makeMessage(),
			makeRequest(),
		);
		if (isArray(result)) {
			expect(Object.keys(result[0])).toEqual(['id', 'type', 'version', 'slug']);
		}
	});
});
