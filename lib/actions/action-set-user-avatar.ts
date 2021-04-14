/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as assert from '@balena/jellyfish-assert';
import { getLogger } from '@balena/jellyfish-logger';
import type { ActionFile } from '@balena/jellyfish-plugin-base';
import md5 from 'blueimp-md5';
import get from 'lodash/get';
import has from 'lodash/has';
import requestP from 'request-promise';

const logger = getLogger(__filename);

const handler: ActionFile['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const email = get(card, ['data', 'email']);

	// If a gravatar value is already set or the user has no email, exit early
	if (!email || has(card, ['data', 'avatar'])) {
		return {
			id: card.id,
			slug: card.slug,
			version: card.version,
			type: card.type,
		};
	}

	const gravatarEmail = Array.isArray(email) ? email[0] : email;
	const GRAVATAR_URL = 'https://www.gravatar.com/avatar/';
	const avatarUrl = `${GRAVATAR_URL + md5(gravatarEmail.trim())}?d=404`;

	const patch = [];

	try {
		// Send a HEAD request to see if the avatar is available *without*
		// downloading it. If the request is successful, assume the avatar
		// exists
		await requestP.head(avatarUrl);

		patch.push({
			op: 'add',
			path: '/data/avatar',
			value: avatarUrl,
		});
	} catch (error) {
		// If there is an error, assume the gravatar doesn't exist and set the
		// value to null
		patch.push({
			op: 'add',
			path: '/data/avatar',
			value: null,
		});
	}

	const typeCard = await context.getCardBySlug(session, 'user@1.0.0');

	assert.INTERNAL(
		request.context,
		typeCard,
		context.errors.WorkerNoElement,
		'No such type: user',
	);

	logger.info(request.context, 'Patching user avatar', {
		slug: card.slug,
		patch,
	});

	await context.patchCard(
		session,
		typeCard,
		{
			timestamp: request.timestamp,
			reason: 'Updated user avatar',
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		card,
		patch,
	);

	return {
		id: card.id,
		slug: card.slug,
		version: card.version,
		type: card.type,
	};
};

export const actionSetUserAvatar: ActionFile = {
	handler,
	card: {
		slug: 'action-set-user-avatar',
		type: 'action@1.0.0',
		name: 'Set the avatar url for a user',
		data: {
			filter: {
				type: 'object',
				properties: {
					type: {
						type: 'string',
						const: 'user@1.0.0',
					},
				},
				required: ['type'],
			},
			arguments: {},
		},
	},
};
