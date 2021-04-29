/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import type { ActionFile } from '@balena/jellyfish-plugin-base';
import clone from 'lodash/clone';
import get from 'lodash/get';
import includes from 'lodash/includes';
import isArray from 'lodash/isArray';
import isString from 'lodash/isString';

const handler: ActionFile['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const current = get(card, request.arguments.property);
	const source = clone(current) || [];
	const initialLength = source.length;
	const input = isArray(request.arguments.value)
		? request.arguments.value
		: [request.arguments.value];

	for (const element of input) {
		if (!includes(source, element)) {
			source.push(element);
		}
	}

	if (initialLength === source.length) {
		return {
			id: card.id,
			type: card.type,
			version: card.version,
			slug: card.slug,
		};
	}

	const typeCard = await context.getCardBySlug(session, card.type);

	const path = isString(request.arguments.property)
		? `/${request.arguments.property.replace(/\./g, '/')}`
		: `/${request.arguments.property.join('/')}`;

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
				value: source,
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

export const actionSetAdd: ActionFile = {
	handler,
	card: {
		slug: 'action-set-add',
		type: 'action@1.0.0',
		name: 'Add an element to a set',
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
