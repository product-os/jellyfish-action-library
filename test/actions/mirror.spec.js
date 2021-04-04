/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const _ = require('lodash')
const ava = require('ava')
const mirror = require('../../lib/actions/mirror')
const {
	makeContext,
	makeExternalEvent,
	makeRequest,
	session
} = require('./helpers')

const request = makeRequest()

ava('mirror() should not sync back changes that came from external event', async (test) => {
	const externalEvent = makeExternalEvent()
	externalEvent.data = {
		source: 'foobar'
	}
	const context = makeContext([
		externalEvent
	])
	const req = _.cloneDeep(request)
	req.originator = externalEvent.id

	const result = await mirror(externalEvent.data.source, session.id, context, {}, req)
	test.deepEqual(result, [])
})

ava('mirror() should return a list of cards', async (test) => {
	const result = await mirror('foobar', session.id, makeContext(), {}, request)
	test.true(_.isArray(result))
	test.true(result.length > 0)
	test.deepEqual(Object.keys(result[0]), [
		'id',
		'type',
		'version',
		'slug'
	])
})
