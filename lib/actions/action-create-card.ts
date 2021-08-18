/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as assert from '@balena/jellyfish-assert';
import type { ActionFile } from '@balena/jellyfish-plugin-base';
import { v4 as uuidv4 } from 'uuid';
import skhema from 'skhema';
import { TypeContract } from '@balena/jellyfish-types/build/core';

/**
 * @summary Slugify a given string
 * @function
 *
 * @param value - string to slugify
 *
 * @example
 * ```typescript
 * const result = slugify('MY_STRING');
 * ```
 */
const slugify = (value: string): string => {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-{1,}/g, '-');
};

const handler: ActionFile['handler'] = async (
	session,
	context,
	typeContract,
	request,
) => {
	assert.INTERNAL(
		request.context,
		!skhema.isValid(
			context.cards.event.data.schema as any,
			request.arguments.properties,
		),
		Error,
		'You may not use card actions to create an event',
	);

	if (!request.arguments.properties.slug) {
		const id = uuidv4();

		// Auto-generate a slug by joining the type, the name, and a uuid
		request.arguments.properties.slug = slugify(
			`${typeContract.slug}-${request.arguments.properties.name || ''}-${id}`,
		);
	}

	const result = await context.insertCard(
		session,
		typeContract as TypeContract,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			reason: request.arguments.reason,
			attachEvents: true,
		},
		request.arguments.properties,
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

export const actionCreateCard: ActionFile = {
	handler,
	card: {
		slug: 'action-create-card',
		type: 'action@1.0.0',
		name: 'Create a new card',
		data: {
			filter: {
				type: 'object',
				properties: {
					type: {
						type: 'string',
						const: 'type@1.0.0',
					},
				},
				required: ['type'],
			},
			arguments: {
				reason: {
					type: ['null', 'string'],
				},
				properties: {
					type: 'object',
					additionalProperties: false,
					properties: {
						id: {
							type: 'string',
							format: 'uuid',
						},
						version: {
							type: 'string',

							// https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
							// eslint-disable-next-line max-len
							pattern:
								'^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$',
						},
						slug: {
							type: 'string',
							pattern: '^[a-z0-9-]+$',
						},
						name: {
							type: 'string',
						},
						active: {
							type: 'boolean',
						},
						created_at: {
							type: 'string',
							format: 'date-time',
						},
						updated_at: {
							anyOf: [
								{
									type: 'string',
									format: 'date-time',
								},
								{
									type: 'null',
								},
							],
						},
						markers: {
							type: 'array',
							items: {
								type: 'string',
								pattern: '^[a-zA-Z0-9-_/:+]+$',
							},
						},
						loop: {
							// TODO: Add pattern once the format of loop slugs has been finalized
							type: ['string', 'null'],
						},
						tags: {
							type: 'array',
							items: {
								type: 'string',
							},
						},
						links: {
							type: 'object',
						},
						data: {
							type: 'object',
						},
						requires: {
							type: 'array',
							items: {
								type: 'object',
							},
						},
						capabilities: {
							type: 'array',
							items: {
								type: 'object',
							},
						},
						linked_at: {
							type: 'object',
						},
					},
					required: [],
				},
			},
		},
	},
};
