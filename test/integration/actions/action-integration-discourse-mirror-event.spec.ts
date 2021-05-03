/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import { actionIntegrationDiscourseMirrorEvent } from '../../../lib/actions/action-integration-discourse-mirror-event';
import {
	after,
	before,
	makeContext,
	makeMessage,
	makeRequest,
} from './helpers';

const handler = actionIntegrationDiscourseMirrorEvent.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('action-integration-discourse-mirror-event', () => {
	test('should return a list of cards', async () => {
		expect.assertions(1);
		const result = await handler(
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
