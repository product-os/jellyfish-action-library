/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { defaultEnvironment } from '@balena/jellyfish-environment';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import some from 'lodash/some';
import values from 'lodash/values';
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
const MAIL_OPTIONS: any = defaultEnvironment.mail.options;
const jestTest = some(values(MAIL_OPTIONS), isEmpty) ? test.skip : test;

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('action-send-email', () => {
	jestTest('should send an email', async () => {
		const result = await handler(
			context.session,
			context,
			makeMessage(context),
			makeRequest(context, {
				toAddress: 'test1@balenateam.m8r.co',
				fromAddress: 'hello@balena.io',
				subject: 'sending real email',
				html: 'with real text in the body',
			}),
		);
		expect(get(result, ['data', 'message'])).toEqual('Queued. Thank you.');
	});

	jestTest('should throw an error when the email is invalid', async () => {
		expect.hasAssertions();

		try {
			await handler(
				context.session,
				context,
				makeMessage(context),
				makeRequest(context, {
					toAddress: 'test@test',
					fromAddress: 'hello@balena.io',
					subject: 'sending real email',
					html: 'with real text in the body',
				}),
			);
		} catch (error) {
			expect(get(error, ['response', 'status'])).toEqual(400);
		}
	});
});
