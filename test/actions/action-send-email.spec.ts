/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { defaultEnvironment } from '@balena/jellyfish-environment';
import nock from 'nock';
import { makeContext, makeMessage, makeRequest, session } from './helpers';
import { actionSendEmail } from '../../lib/actions/action-send-email';

const handler = actionSendEmail.handler;

describe('handler()', () => {
	test('should send email', async () => {
		const request = makeRequest({
			fromAddress: 'from@foo.bar',
			toAddress: 'to@foo.bar',
			subject: 'Test Subject',
			html: 'Test Body',
		});

		expect.assertions(1);
		if (defaultEnvironment.mail.options) {
			nock(defaultEnvironment.mail.options.baseUrl)
				.intercept(
					`/${defaultEnvironment.mail.options.domain}/messages`,
					'POST',
				)
				.reply(200, 'OK');

			const result = await handler(
				session.id,
				makeContext(),
				makeMessage(),
				request,
			);
			expect(result).toEqual('OK');
		}
	});
});
