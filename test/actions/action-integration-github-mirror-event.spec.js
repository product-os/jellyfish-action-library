/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const _ = require('lodash')
const ava = require('ava')
const {
	makeContext,
	makeRequest,
	session
} = require('./helpers')
const {
	handler
} = require('../../lib/actions/action-integration-github-mirror-event')

const request = makeRequest()

ava('handler() should return a list of cards', async (test) => {
	const result = await handler(session.id, makeContext(), {}, request)
	test.true(_.isArray(result))
	test.true(result.length > 0)
	test.deepEqual(Object.keys(result[0]), [
		'id',
		'type',
		'version',
		'slug'
	])
})
