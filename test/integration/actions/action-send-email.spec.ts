/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { defaultEnvironment } from '@balena/jellyfish-environment';
import nock from 'nock';
import { actionSendEmail } from '../../../lib/actions/action-send-email';
import {
	after,
	before,
	makeContext,
	makeMessage,
	makeRequest,
} from './helpers';

const handler = actionSendEmail.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('handler()', () => {
	test('should send email', async () => {
		const request = makeRequest(context, {
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
				context.session,
				context,
				makeMessage(context),
				request,
			);
			expect(result).toEqual('OK');
		}
	});
});
