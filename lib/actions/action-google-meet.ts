import * as assert from '@balena/jellyfish-assert';
import { defaultEnvironment } from '@balena/jellyfish-environment';
import type { ActionFile } from '@balena/jellyfish-plugin-base';
import { TypeContract } from '@balena/jellyfish-types/build/core';
import add from 'date-fns/add';
import sub from 'date-fns/sub';
import { google } from 'googleapis';
import isBase64 from 'is-base64';
import has from 'lodash/has';
import type { GoogleMeetCredentials } from '../../lib/types';

const CALENDAR_ID = 'primary';
const GOOGLE_CALENDAR_API_VERSION = 'v3';

// TODO: Remove non-base64 string support.
/**
 * Get Google Meet credentials from environment variable.
 * Temporarily supports both raw strings and base64 strings
 * while we migrate this variable to base64.
 *
 * @function
 *
 * @returns Parsed Google Meet credentials object
 */
export function getCredentials(): GoogleMeetCredentials {
	const raw = defaultEnvironment.integration['google-meet'].credentials;
	if (!raw) {
		throw new Error(
			'Google Meet credentials environment variable was not found!',
		);
	}
	try {
		const parsed = isBase64(raw)
			? JSON.parse(Buffer.from(raw, 'base64').toString())
			: JSON.parse(raw);
		return parsed;
	} catch (error) {
		throw new Error(
			`Failed to parse Google Meet stringified JSON environment variable: ${error}`,
		);
	}
}

const handler: ActionFile['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const credentials = getCredentials();
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

	const typeCard = (await context.getCardBySlug(
		session,
		`${card.type}@latest`,
	))! as TypeContract;

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
			reason: `Google Meet created: [join here](${conferenceUrl})`,
			attachEvents: true,
		},
		card,
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
