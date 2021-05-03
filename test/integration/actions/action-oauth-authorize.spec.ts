/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isEmpty from 'lodash/isEmpty';
import isString from 'lodash/isString';
import { actionOAuthAuthorize } from '../../../lib/actions/action-oauth-authorize';
import { after, before, makeContext, makeRequest, makeUser } from './helpers';

const handler = actionOAuthAuthorize.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('action-oauth-authorize', () => {
	test('should return token string', async () => {
		const request = makeRequest(context, {
			provider: 'front',
		});
		const result = await handler(context.session, context, makeUser(), request);
		expect(isString(result)).toBe(true);
		expect(isEmpty(result)).toBe(false);
	});
});
