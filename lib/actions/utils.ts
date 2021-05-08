/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import type { Contract } from '@balena/jellyfish-types/build/core';
import type { ActionRequest, Context } from '../types';

/**
 * @summary Add link between user card and another card
 * @function
 *
 * @param context - execution context
 * @param request - action request
 * @param fromCard - card to link from
 * @param userCard - user card to link to
 */
export async function addLinkCard(
	context: Context,
	request: ActionRequest,
	fromCard: Contract,
	userCard: Contract,
): Promise<void> {
	const linkTypeCard = await context.getCardBySlug(
		context.privilegedSession,
		'link@1.0.0',
	);
	await context.insertCard(
		context.privilegedSession,
		linkTypeCard,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: false,
		},
		{
			slug: await context.getEventSlug('link'),
			type: 'link@1.0.0',
			name: 'is attached to',
			data: {
				inverseName: 'has requested',
				from: {
					id: fromCard.id,
					type: fromCard.type,
				},
				to: {
					id: userCard.id,
					type: userCard.type,
				},
			},
		},
	);
}