/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const skhema = require('skhema')
const uuid = require('@balena/jellyfish-uuid')
const assert = require('@balena/jellyfish-assert')

const slugify = (string) => {
	return string
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-{1,}/g, '-')
}

const handler = async (session, context, card, request) => {
	assert.INTERNAL(request.context,
		!skhema.isValid(context.cards.event.data.schema, request.arguments.properties),
		Error, 'You may not use card actions to create an event')

	if (!request.arguments.properties.slug) {
		const id = await uuid.random()

		// Auto-generate a slug by joining the type, the name, and a uuid
		request.arguments.properties.slug =
			slugify(`${card.slug}-${request.arguments.properties.name || ''}-${id}`)
	}

	const result = await context.insertCard(session, card, {
		timestamp: request.timestamp,
		actor: request.actor,
		originator: request.originator,
		reason: request.arguments.reason,
		attachEvents: true
	}, request.arguments.properties)

	if (!result) {
		return null
	}

	return {
		id: result.id,
		type: result.type,
		version: result.version,
		slug: result.slug
	}
}

module.exports = {
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
						const: 'type@1.0.0'
					}
				},
				required: [
					'type'
				]
			},
			arguments: {
				reason: {
					type: [ 'null', 'string' ]
				},
				properties: {
					type: 'object',
					additionalProperties: false,
					properties: {
						id: {
							type: 'string',
							format: 'uuid'
						},
						version: {
							type: 'string',

							// https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
							// eslint-disable-next-line max-len
							pattern: '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$'
						},
						slug: {
							type: 'string',
							pattern: '^[a-z0-9-]+$'
						},
						name: {
							type: 'string'
						},
						active: {
							type: 'boolean'
						},
						created_at: {
							type: 'string',
							format: 'date-time'
						},
						updated_at: {
							anyOf: [
								{
									type: 'string',
									format: 'date-time'
								},
								{
									type: 'null'
								}
							]
						},
						markers: {
							type: 'array',
							items: {
								type: 'string',
								pattern: '^[a-zA-Z0-9-_/:+]+$'
							}
						},
						tags: {
							type: 'array',
							items: {
								type: 'string'
							}
						},
						links: {
							type: 'object'
						},
						data: {
							type: 'object'
						},
						requires: {
							type: 'array',
							items: {
								type: 'object'
							}
						},
						capabilities: {
							type: 'array',
							items: {
								type: 'object'
							}
						},
						linked_at: {
							type: 'object'
						}
					},
					required: []
				}
			}
		}
	}
}
