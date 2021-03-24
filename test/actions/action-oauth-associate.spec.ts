/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import { makeContext, makeRequest, makeUser, session } from './helpers';
import { actionOAuthAssociate } from '../../lib/actions/action-oauth-associate';

const handler = actionOAuthAssociate.handler;

describe('handler()', () => {
	test('should return single user card', async () => {
		expect.assertions(1);
		const result = await handler(
			session.id,
			makeContext(),
			makeUser(),
			makeRequest(),
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.type).toEqual('user@1.0.0');
		}
	});
});
