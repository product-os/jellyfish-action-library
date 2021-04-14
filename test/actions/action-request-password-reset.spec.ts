/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import { defaultEnvironment } from '@balena/jellyfish-environment';
import nock from 'nock';
import { v4 as uuidv4 } from 'uuid';
import { PASSWORDLESS_USER_HASH } from '../../lib/actions/constants';
import { makeUser, makeContext, makeRequest, session } from './helpers';
import { actionRequestPasswordReset } from '../../lib/actions/action-request-password-reset';

const handler = actionRequestPasswordReset.handler;

describe('handler()', () => {
	test('should not send password reset email on unknown user', async () => {
		const user = makeUser();
		const request = makeRequest({
			username: uuidv4(),
		});

		expect.assertions(1);
		const result = await handler(session.id, makeContext(), user, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result).toEqual({
				id: user.id,
				type: user.type,
				version: user.version,
				slug: user.slug,
			});
		}
	});

	test('should not send password reset email when user has no password hash', async () => {
		const user = makeUser({
			hash: PASSWORDLESS_USER_HASH,
			email: 'user@foo.bar',
		});
		const context = makeContext([user]);
		const request = makeRequest({
			username: user.slug.replace('user-', ''),
		});

		expect.assertions(1);
		const result = await handler(session.id, context, user, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result).toEqual({
				id: user.id,
				type: user.type,
				version: user.version,
				slug: user.slug,
			});
		}
	});

	test('should send password reset email for valid request', async () => {
		const user = makeUser({
			hash: uuidv4(),
			email: 'user@foo.bar',
		});
		const context = makeContext([user]);
		const request = makeRequest({
			username: user.slug.replace('user-', ''),
		});

		expect.assertions(1);
		if (defaultEnvironment.mail.options) {
			nock(defaultEnvironment.mail.options.baseUrl)
				.intercept(
					`/${defaultEnvironment.mail.options.domain}/messages`,
					'POST',
				)
				.reply(200, 'OK');

			const result = await handler(session.id, context, user, request);
			expect(result).toEqual({
				id: user.id,
				type: user.type,
				version: user.version,
				slug: user.slug,
			});
		}
	});
});
