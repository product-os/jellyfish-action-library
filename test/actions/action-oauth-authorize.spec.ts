/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isEmpty from 'lodash/isEmpty';
import isString from 'lodash/isString';
import { makeContext, makeRequest, makeUser, session } from './helpers';
import { actionOAuthAuthorize } from '../../lib/actions/action-oauth-authorize';

const handler = actionOAuthAuthorize.handler;

describe('handler()', () => {
	test('should return token string', async () => {
		const request = makeRequest({
			provider: 'front',
		});
		const result = await handler(
			session.id,
			makeContext(),
			makeUser(),
			request,
		);
		expect(isString(result)).toBe(true);
		expect(isEmpty(result)).toBe(false);
	});
});
