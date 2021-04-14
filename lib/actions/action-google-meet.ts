/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as assert from '@balena/jellyfish-assert';
import { defaultEnvironment } from '@balena/jellyfish-environment';
import type { ActionFile } from '@balena/jellyfish-plugin-base';
import add from 'date-fns/add';
import sub from 'date-fns/sub';
import { google } from 'googleapis';
import has from 'lodash/has';
import omit from 'lodash/omit';

const CALENDAR_ID = 'primary';
const GOOGLE_CALENDAR_API_VERSION = 'v3';

const handler: ActionFile['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const credentialsEnvVar =
		defaultEnvironment.integration['google-meet'].credentials;
	if (!credentialsEnvVar) {
		throw new Error(
			'Google Meet credentials environment variable was not found!',
		);
	}
	let credentials = null;
	try {
		credentials = JSON.parse(credentialsEnvVar);
	} catch (error) {
		throw new Error(
			'Failed to parse Google Meet stringified JSON environment variable',
		);
	}

	const auth = new google.auth.GoogleAuth({
		projectId: credentials.project_id,
		credentials: {
			client_email: credentials.client_email,
			private_key: credentials.private_key,
		},
		clientOptions: {
			clientId: credentials.client_id,

			// `subject` required to impersonate real account using service account
			// (neccessary for creating events with meet URLs)
			// Currently using same credentials as Hubot
			subject: 'hubot@balena.io',
		},
		scopes: ['https://www.googleapis.com/auth/calendar'],
	});
	const authClient = await auth.getClient();

	const calendarAPI = google.calendar({
		auth: authClient,
		version: GOOGLE_CALENDAR_API_VERSION,
	});

	// The event meeting time is not particularly important as we'll delete it immediately
	const startTime = sub(new Date(), {
		days: 10,
	});
	const endTime = add(startTime, {
		hours: 1,
	});

	const event = await calendarAPI.events.insert({
		calendarId: CALENDAR_ID,
		conferenceDataVersion: 1,
		requestBody: {
			summary: 'Jellyfish Generated Meet',
			end: {
				dateTime: endTime.toISOString(),
			},
			start: {
				dateTime: startTime.toISOString(),
			},
			conferenceData: {
				createRequest: {
					requestId: startTime.valueOf().toString(),
					conferenceSolutionKey: {
						type: 'hangoutsMeet',
					},
				},
			},
		},
	});

	if (!event.data.hangoutLink) {
		throw new Error("Meet/Hangout Link not found in the event's body");
	}

	if (event.data.id) {
		await calendarAPI.events.delete({
			calendarId: CALENDAR_ID,
			eventId: event.data.id,
		});
	}

	const conferenceUrl = event.data.hangoutLink;

	const typeCard = await context.getCardBySlug(session, `${card.type}@latest`);

	assert.INTERNAL(
		request.context,
		typeCard,
		context.errors.WorkerNoElement,
		`No such type: ${card.type}`,
	);

	const patchResult = await context.patchCard(
		context.privilegedSession,
		typeCard,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		omit(card, ['type']),
		[
			{
				op: has(card, ['data', 'conferenceUrl']) ? 'replace' : 'add',
				path: '/data/conferenceUrl',
				value: conferenceUrl,
			},
		],
	);

	if (!patchResult) {
		return null;
	}

	return {
		id: patchResult.id,
		type: patchResult.type,
		slug: patchResult.slug,
		version: patchResult.version,
		conferenceUrl,
	};
};

export const actionGoogleMeet: ActionFile = {
	handler,
	card: {
		slug: 'action-google-meet',
		type: 'action@1.0.0',
		name: 'Create a Google Meet link',
		data: {
			filter: {
				type: 'object',
			},
			arguments: {},
		},
	},
};
