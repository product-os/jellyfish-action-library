/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const mirror = require('./mirror')

const handler = async (session, context, card, request) => {
	return mirror('github', session, context, card, request)
}

module.exports = {
	handler,
	card: {
		slug: 'action-integration-github-mirror-event',
		type: 'action@1.0.0',
		data: {
			filter: {
				type: 'object',
				required: [
					'type'
				],
				properties: {
					type: {
						type: 'string',
						enum: [
							'issue@1.0.0',
							'pull-request@1.0.0',
							'message@1.0.0'
						]
					}
				}
			},
			arguments: {}
		}
	}
}
