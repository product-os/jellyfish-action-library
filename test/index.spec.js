/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const _ = require('lodash')
const ava = require('ava')
const ActionLibrary = require('../lib/index')

const context = {
	id: 'jellyfish-action-library-test'
}

ava.beforeEach((test) => {
	test.context.actionLibrary = new ActionLibrary()
})

ava('should return a set of actions', (test) => {
	const {
		actionLibrary
	} = test.context
	const actions = actionLibrary.getActions(context)
	test.truthy(_.isPlainObject(actions))
	test.truthy(!_.isEmpty(actions))
	test.is(typeof actions['action-create-card'].handler, 'function')
})
