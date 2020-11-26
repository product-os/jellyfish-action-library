/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const _ = require('lodash')
const assert = require('@balena/jellyfish-assert')
const logger = require('@balena/jellyfish-logger').getLogger(__filename)
const skhema = require('skhema')

const handler = async (session, context, card, request) => {
	const typeCard = await context.getCardBySlug(
		session, card.type)

	assert.USER(request.context, typeCard,
		context.errors.WorkerNoElement, `No such type: ${card.type}`)

	const matcher = _.get(card, [ 'data', 'workerFilter', 'schema' ])

	if (matcher) {
		// Find all the agents that match the task
		const agents = await context.query(context.privilegedSession, matcher)

		// Sort the agents by the best match
		const [ bestMatch ] = _.reverse(_.sortBy(agents, (item) => {
			return skhema.scoreMatch(matcher, item)
		}))

		// Assign the task to the agent
		if (bestMatch) {
			const linkTypeCard = await context.getCardBySlug(
				session, 'link@1.0.0')
			assert.INTERNAL(request.context, linkTypeCard,
				context.errors.WorkerNoElement, 'No such type: link')

			await context.insertCard(session, linkTypeCard, {
				timestamp: request.timestamp,
				actor: request.actor,
				originator: request.originator,
				attachEvents: true
			}, {
				slug: await context.getEventSlug('link'),
				type: 'link@1.0.0',
				name: 'owns',
				data: {
					inverseName: 'is owned by',
					from: {
						id: bestMatch.id,
						type: bestMatch.type
					},
					to: {
						id: card.id,
						type: card.type
					}
				}
			})
		} else {
			logger.info(request.context, 'Could not find a matching agent for task', {
				id: card.id,
				slug: card.slug,
				type: card.type
			})
		}
	}

	const result = card

	return {
		id: result.id,
		type: result.type,
		version: result.version,
		slug: result.slug
	}
}

module.exports = {
	handler
}
