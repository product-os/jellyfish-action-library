/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as assert from '@balena/jellyfish-assert';
import type { ActionFile } from '@balena/jellyfish-plugin-base';
import get from 'lodash/get';
import isNumber from 'lodash/isNumber';
import toInteger from 'lodash/toInteger';

const handler: ActionFile['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const typeCard = await context.getCardBySlug(session, card.type);

	assert.INTERNAL(
		request.context,
		typeCard,
		context.errors.WorkerNoElement,
		`No such type: ${card.type}`,
	);

	const current = get(card, request.arguments.path);
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
		[
			{
				op: isNumber(current) ? 'replace' : 'add',
				path: `/${request.arguments.path.join('/')}`,
				value: (toInteger(current) || 0) + 1,
			},
		],
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

export const actionIncrement: ActionFile = {
	handler,
	card: {
		slug: 'action-increment',
		type: 'action@1.0.0',
		name: 'Increment a field on a card',
		data: {
			arguments: {
				reason: {
					type: ['null', 'string'],
				},
				path: {
					type: 'array',
					items: {
						type: 'string',
					},
				},
			},
		},
	},
};
