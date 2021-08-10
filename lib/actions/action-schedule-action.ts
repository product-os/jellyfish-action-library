/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as assert from '@balena/jellyfish-assert';
import type { ActionFile } from '@balena/jellyfish-plugin-base';
import { TypeContract } from '@balena/jellyfish-types/build/core';
import { strict } from 'assert';

const handler: ActionFile['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	// Check that type contract exists
	const typeCardSlug = 'scheduled-action';
	const typeCard = (await context.getCardBySlug(
		session,
		`${typeCardSlug}@1.0.0`,
	)) as TypeContract;
	assert.USER(
		request.context,
		typeCard,
		context.errors.WorkerNoElement,
		`No such type: ${typeCardSlug}`,
	);

	// Check that provided card has a schedule configuration
	strict(card.data.schedule, 'Schedule configuration not provided');

	// Enqueue specified action as a new job in the queue
	// TODO: Replace any with ScheduledActionContract
	await context.enqueueAction(session, {
		context: request.context,
		action: (card as any).data.options.action,
		card: (card as any).data.options.card,
		type: (card as any).data.options.type,
		arguments: request.arguments,
		schedule: card.id,
	});

	return {
		id: card.id,
		type: card.type,
		version: card.version,
		slug: card.slug,
	};
};

// TODO: Add filter requiring scheduled-actions and flesh out arguments
export const actionScheduleAction: ActionFile = {
	handler,
	card: {
		slug: 'action-schedule-action',
		type: 'action@1.0.0',
		name: 'Schedule action for future execution',
		data: {
			arguments: {
				reason: {
					type: ['null', 'string'],
				},
				properties: {
					type: 'object',
				},
			},
		},
	},
};
