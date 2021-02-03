/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const _ = require('lodash')

module.exports = {
	handler: _.noop,
	card: {
		slug: 'action-get-gravatar',
		type: 'action@1.0.0',
		name: 'Set the gravatar url for a user',
		data: {
			filter: {
				type: 'object',
				properties: {
					type: {
						type: 'string',
						const: 'user@1.0.0'
					}
				},
				required: [
					'type'
				]
			},
			arguments: {}
		}
	}
}
