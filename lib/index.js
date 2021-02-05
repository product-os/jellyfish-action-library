/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const {
	JellyfishPluginBase
} = require('@balena/jellyfish-plugin-base')
const actions = require('./actions')
const {
	version
} = require('../package.json')

/**
 * The Action Library Jellyfish plugin.
 */
module.exports = class ProductOsPlugin extends JellyfishPluginBase {
	constructor () {
		super({
			slug: 'action-library',
			name: 'Action Library Plugin',
			version,
			actions
		})
	}
}
