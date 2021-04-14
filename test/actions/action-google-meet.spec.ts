/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { google } from 'googleapis';
import sinon from 'sinon';
import { v4 as uuidv4 } from 'uuid';
import {
	makeContext,
	makeRequest,
	makeMessage,
	session,
	types,
} from './helpers';
import { actionGoogleMeet } from '../../lib/actions/action-google-meet';

const handler = actionGoogleMeet.handler;
const conferenceUrl = 'http://foo.bar';

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
		const message = makeMessage();
		try {
			await handler(session.id, makeContext(), message, makeRequest());
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
		const message = makeMessage();
		try {
			await handler(session.id, makeContext(), message, makeRequest());
		} catch (error) {
			expect(error.message).toEqual(`No such type: ${message.type}`);
		}
	});

	test('handler() should set conferenceUrl on card', async () => {
		stub({
			hangoutLink: conferenceUrl,
			id: uuidv4(),
		});

		const message = makeMessage();
		const context = makeContext([message, types.message]);
		const result = await handler(session.id, context, message, makeRequest());
		expect(result).toEqual({
			id: message.id,
			type: message.type,
			slug: message.slug,
			version: message.version,
			conferenceUrl,
		});
	});
});
