/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const _ = require('lodash')
const ava = require('ava')
const actionLibrary = require('./index')

ava('should return a set of actions', (test) => {
	test.truthy(_.isPlainObject(actionLibrary))
	test.truthy(!_.isEmpty(actionLibrary))
})
