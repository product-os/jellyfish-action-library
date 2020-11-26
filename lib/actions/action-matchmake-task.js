/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

module.exports = {
	slug: 'action-matchmake-task',
	type: 'action@1.0.0',
	version: '1.0.0',
	name: 'Matchmake task to agent',
	markers: [],
	tags: [],
	links: {},
	active: true,
	data: {
		filter: {
			type: 'object',
			properties: {
				type: {
					type: 'string',
					const: 'task@1.0.0'
				}
			},
			required: [
				'type'
			]
		},
		arguments: {}
	},
	requires: [],
	capabilities: []
}
