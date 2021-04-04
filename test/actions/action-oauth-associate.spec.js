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
} = require('../../lib/actions/action-oauth-associate')

const request = makeRequest()

ava('handler() should return single user card', async (test) => {
	const result = await handler(session.id, makeContext(), {}, request)
	test.true(_.isObject(result))
	test.is(result.type, 'user@1.0.0')
})
