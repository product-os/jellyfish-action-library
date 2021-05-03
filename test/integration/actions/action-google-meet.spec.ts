/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { defaultEnvironment as environment } from '@balena/jellyfish-environment';
import { google } from 'googleapis';
import isEmpty from 'lodash/isEmpty';
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

const hasCredentials = () => {
	try {
		const cred = JSON.parse(environment.integration['google-meet'].credentials);
		return !isEmpty(cred);
	} catch (err) {
		return false;
	}
};

// Skip tests if there are no credentials
const jestTest =
	!hasCredentials() || environment.test.integration.skip ? test.skip : test;

beforeAll(async () => {
	await before(context);

	// Create a card that we'll add a conferenceUrl to
	context.card = await context.jellyfish.insertCard(
		context.context,
		context.session,
		{
			type: 'card@1.0.0',
			slug: `card-${uuidv4()}`,
			version: '1.0.0',
			data: {},
		},
	);
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

describe('action-google-meet', () => {
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

	test('should throw on invalid type', async () => {
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

	jestTest('should return a conference URL', async () => {
		const result = await context.processAction(context.session, {
			action: 'action-google-meet@1.0.0',
			context: context.context,
			card: context.card.id,
			type: context.card.type,
			arguments: {},
		});

		expect(
			result.data.conferenceUrl.startsWith('https://meet.google.com'),
		).toBe(true);
	});

	jestTest('should update the card with the conference URL', async () => {
		await context.processAction(context.session, {
			action: 'action-google-meet@1.0.0',
			context: context.context,
			card: context.card.id,
			type: context.card.type,
			arguments: {},
		});

		const [updatedCard] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				required: ['id', 'type'],
				additionalProperties: true,
				properties: {
					type: {
						type: 'string',
						const: context.card.type,
					},
					id: {
						type: 'string',
						const: context.card.id,
					},
				},
			},
		);

		expect(
			(updatedCard.data as any).conferenceUrl.startsWith(
				'https://meet.google.com',
			),
		).toBe(true);
	});
});
