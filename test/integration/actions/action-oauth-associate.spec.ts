/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import { actionOAuthAssociate } from '../../../lib/actions/action-oauth-associate';
import { after, before, makeContext, makeRequest, makeUser } from './helpers';

const handler = actionOAuthAssociate.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('handler()', () => {
	test('should return single user card', async () => {
		expect.assertions(1);
		const result = await handler(
			context.session,
			context,
			makeUser(),
			makeRequest(context),
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.type).toEqual('user@1.0.0');
		}
	});
});
