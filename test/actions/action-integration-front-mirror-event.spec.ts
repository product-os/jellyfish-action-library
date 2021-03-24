/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import { makeContext, makeMessage, makeRequest, session } from './helpers';
import { actionIntegrationFrontMirrorEvent } from '../../lib/actions/action-integration-front-mirror-event';

const handler = actionIntegrationFrontMirrorEvent.handler;

describe('handler()', () => {
	test('should return a list of cards', async () => {
		expect.assertions(1);
		const result = await handler(
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
