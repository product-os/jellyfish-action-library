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
	makeTag,
	session,
	types
} = require('./helpers')
const {
	handler
} = require('../../lib/actions/action-increment-tag')

const request = makeRequest()

ava('handler() should increment a tag', async (test) => {
	const tag = makeTag()
	const context = makeContext([
		tag,
		types.tag
	])
	const req = _.cloneDeep(request)
	req.arguments.name = tag.slug.replace(/^tag-/, '')

	const result = await handler(session.id, context, {}, req)
	test.deepEqual(result, [
		_.pick(tag, [ 'id', 'type', 'version', 'slug' ])
	])

	const updated = await context.getCardById(session.id, tag.id)
	test.is(updated.data.count, 1)
})
