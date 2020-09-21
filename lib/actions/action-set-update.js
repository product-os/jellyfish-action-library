/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

module.exports = {
	slug: 'action-set-update',
	type: 'action@1.0.0',
	version: '1.0.0',
	name: 'Update a field on a card',
	markers: [],
	tags: [],
	links: {},
	active: true,
	data: {
		filter: {
			type: 'object'
		},
		arguments: {
			property: {
				type: 'string'
			},
			value: {
				type: [
					'string',
					'number',
					'array'
				]
			}
		}
	},
	requires: [],
	capabilities: []
}
