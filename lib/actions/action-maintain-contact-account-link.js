/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

module.exports = {
	slug: 'action-maintain-contact-account-link',
	type: 'action@1.0.0',
	version: '1.0.0',
	name: 'Maintaining link between contact and account',
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
					const: 'account@1.0.0'
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
