/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const mirror = require('./mirror')

const handler = async (session, context, card, request) => {
	return mirror('front', session, context, card, request)
}

module.exports = {
	handler,
	card: {
		slug: 'action-integration-front-mirror-event',
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
							'support-thread@1.0.0',
							'message@1.0.0',
							'whisper@1.0.0'
						]
					}
				}
			},
			arguments: {}
		}
	}
}
