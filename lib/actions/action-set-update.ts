/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import type { ActionFile } from '@balena/jellyfish-plugin-base';
import { TypeContract } from '@balena/jellyfish-types/build/core';
import get from 'lodash/get';
import isString from 'lodash/isString';

const handler: ActionFile['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const typeCard = (await context.getCardBySlug(
		session,
		card.type,
	))! as TypeContract;

	const path = isString(request.arguments.property)
		? `/${request.arguments.property.replace(/\./g, '/')}`
		: `/${request.arguments.property.join('/')}`;

	const current = get(card, request.arguments.property);

	const result = await context.patchCard(
		session,
		typeCard,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		card,
		[
			{
				op: current ? 'replace' : 'add',
				path,
				value: request.arguments.value,
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

export const actionSetUpdate: ActionFile = {
	handler,
	card: {
		slug: 'action-set-update',
		type: 'action@1.0.0',
		name: 'Update a field on a card',
		data: {
			filter: {
				type: 'object',
			},
			arguments: {
				property: {
					type: 'string',
				},
				value: {
					type: ['string', 'number', 'array'],
				},
			},
		},
	},
};
