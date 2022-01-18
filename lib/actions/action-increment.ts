import * as assert from '@balena/jellyfish-assert';
import type { TypeContract } from '@balena/jellyfish-types/build/core';
import {
	ActionDefinition,
	errors as workerErrors,
} from '@balena/jellyfish-worker';
import { get, isNumber, toInteger } from 'lodash';

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const typeCard = (await context.getCardBySlug(
		session,
		card.type,
	))! as TypeContract;

	assert.INTERNAL(
		request.logContext,
		typeCard,
		workerErrors.WorkerNoElement,
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

export const actionIncrement: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-increment',
		version: '1.0.0',
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
