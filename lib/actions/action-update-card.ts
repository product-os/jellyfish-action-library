/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as assert from '@balena/jellyfish-assert';
import type { ActionFile } from '@balena/jellyfish-plugin-base';

const handler: ActionFile['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const typeCard = await context.getCardBySlug(session, card.type);

	assert.USER(
		request.context,
		typeCard,
		context.errors.WorkerNoElement,
		`No such type: ${card.type}`,
	);

	const result = await context.patchCard(
		session,
		typeCard,
		{
			timestamp: request.timestamp,
			reason: request.arguments.reason,
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		card,
		request.arguments.patch,
	);

	if (!result) {
		return null;
	}

	return {
		id: result.id,
		type: result.type,
		version: result.version,
		slug: result.slug,
	};
};

export const actionUpdateCard: ActionFile = {
	handler,
	card: {
		slug: 'action-update-card',
		type: 'action@1.0.0',
		name: 'Update properties of a card',
		data: {
			arguments: {
				reason: {
					type: ['null', 'string'],
				},
				patch: {
					type: 'array',
				},
			},
		},
	},
};
