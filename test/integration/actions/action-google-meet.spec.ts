/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { google } from 'googleapis';
import sinon from 'sinon';
import { v4 as uuidv4 } from 'uuid';
import { actionGoogleMeet } from '../../../lib/actions/action-google-meet';
import {
	after,
	before,
	makeContext,
	makeMessage,
	makeRequest,
} from './helpers';

const handler = actionGoogleMeet.handler;
const conferenceUrl = 'http://foo.bar';
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

beforeEach(() => {
	sinon.restore();
});

/**
 * @summary Stub Google API
 * @function
 *
 * @param data - data to return from Google client request
 */
function stub(data: any): void {
	sinon.stub(google.auth, 'GoogleAuth').callsFake(() => {
		return {
			getClient: () => {
				return {
					request: () => {
						return {
							data,
						};
					},
				};
			},
		};
	});
}

describe('handler()', () => {
	test('should throw on missing hangout link', async () => {
		stub({
			id: uuidv4(),
		});

		expect.assertions(1);
		const message = makeMessage(context);
		try {
			await handler(context.session, context, message, makeRequest(context));
		} catch (error) {
			expect(error.message).toEqual(
				"Meet/Hangout Link not found in the event's body",
			);
		}
	});

	test('handler() should throw on invalid type', async () => {
		stub({
			hangoutLink: conferenceUrl,
			id: uuidv4(),
		});

		expect.assertions(1);
		const message = makeMessage(context);
		message.type = 'foobar';
		try {
			await handler(context.session, context, message, makeRequest(context));
		} catch (error) {
			expect(error.message).toEqual(`No such type: ${message.type}`);
		}
	});

	test('handler() should set conferenceUrl on card', async () => {
		stub({
			hangoutLink: conferenceUrl,
			id: uuidv4(),
		});

		const message = await context.kernel.insertCard(
			context.context,
			context.session,
			makeMessage(context),
		);
		const result = await handler(
			context.session,
			context,
			message,
			makeRequest(context),
		);
		expect(result).toEqual({
			id: message.id,
			type: message.type,
			slug: message.slug,
			version: message.version,
			conferenceUrl,
		});
	});
});
