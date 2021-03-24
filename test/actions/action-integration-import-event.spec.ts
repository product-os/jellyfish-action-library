/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import { makeContext, makeMessage, makeRequest, session } from './helpers';
import { actionIntegrationImportEvent } from '../../lib/actions/action-integration-import-event';

const handler = actionIntegrationImportEvent.handler;

describe('handler()', () => {
	test('should return a list of cards', async () => {
		const message = makeMessage({
			source: 'front',
		});
		expect.assertions(1);
		const result = await handler(
			session.id,
			makeContext(),
			message,
			makeRequest(),
		);
		if (isArray(result)) {
			expect(Object.keys(result[0])).toEqual(['id', 'type', 'version', 'slug']);
		}
	});
});
