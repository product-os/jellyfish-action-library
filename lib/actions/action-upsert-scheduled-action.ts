/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as assert from '@balena/jellyfish-assert';
import type { ActionFile } from '@balena/jellyfish-plugin-base';
import type { TypeContract } from '@balena/jellyfish-types/build/core';
import { parseExpression } from 'cron-parser';
import { v4 as uuidv4 } from 'uuid';

// 1. Check that `scheduled-action` type exists
// 2. Validate that provided action slug exists
// 3. Validate that end date is after start date (if recurring)
// 4. Validate that next execution date is in the future
// 5. Create and return card
const handler: ActionFile['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	console.log('=== handler.context:', context);
	console.log('=== handler.card:', JSON.stringify(card, null, 4));
	console.log('=== handler.request:', JSON.stringify(request, null, 4));

	const typeCardSlug = 'scheduled-action';
	const typeCard = await context.getCardBySlug(
		session,
		`${typeCardSlug}@1.0.0`,
	);
	assert.USER(
		request.context,
		typeCard,
		context.errors.WorkerNoElement,
		`No such type: ${typeCardSlug}`,
	);

	const interval = parseExpression(request.arguments.properties.interval);
	const data = Object.assign({}, request.arguments.properties, {
		count: 0,
		last: '',
		next: interval.next().toISOString(),
		jobs: [],
	});
	if (!data.action.arguments) {
		data.action.arguments = {};
	}

	console.log('=== handler.data:', JSON.stringify(data, null, 4));

	const result = await context.insertCard(
		context.privilegedSession,
		typeCard as TypeContract,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			reason: request.arguments.reason,
			attachEvents: true,
		},
		{
			version: '1.0.0',
			slug: `${typeCardSlug}-${uuidv4()}`,
			data,
		},
	);

	console.log('=== handler.result:', JSON.stringify(result, null, 4));

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

// TODO: Double-check and tidy up data.arguments.properties
export const actionCreateScheduledAction: ActionFile = {
	handler,
	card: {
		slug: 'action-create-scheduled-action',
		type: 'action@1.0.0',
		name: 'Create a new scheduled action',
		data: {
			arguments: {
				reason: {
					type: ['null', 'string'],
				},
				properties: {
					type: 'object',
					required: ['data'],
					properties: {
						data: {
							type: 'object',
							required: ['options', 'schedule'],
							properties: {
								options: {
									type: 'object',
									required: ['action'],
									propertes: {
										action: {
											type: 'string',
											pattern: '^action-[a-z0-9-]+$',
										},
										card: {
											type: 'string',
										},
										type: {
											type: 'string',
										},
										arguments: {
											type: 'object',
										},
										context: {
											type: 'object',
										},
									},
								},
								schedule: {
									title: 'Execution schedule',
									type: 'object',
									oneOf: [
										{
											once: {
												type: 'object',
												required: ['date'],
												properties: {
													date: {
														type: 'string',
														format: 'date-time',
													},
												},
											},
										},
										{
											recurring: {
												type: 'object',
												required: ['start', 'end', 'interval'],
												properties: {
													start: {
														title: 'Execution start date/time',
														type: 'string',
														format: 'date-time',
													},
													end: {
														title: 'Execution end date/time',
														type: 'string',
														format: 'date-time',
													},
													interval: {
														title: 'Execution interval (cron format)',
														type: 'string',
														pattern:
															'^([\\d|/|*|\\-|,]+\\s)?[\\d|/|*|\\-|,]+\\s[\\d|/|*|\\-|,]+\\s[\\d|L|/|*|\\-|,|\\?]+\\s[\\d|/|*|\\-|,]+\\s[\\d|L|/|*|\\-|,|\\?]+$',
													},
												},
											},
										},
									],
								},
							},
						},
					},
				},
			},
		},
	},
};
