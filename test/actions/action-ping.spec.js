/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const ava = require('ava')
const {
	makeContext,
	makeRequest,
	makeUser,
	session
} = require('./helpers')
const {
	handler
} = require('../../lib/actions/action-ping')

const user = makeUser()
const request = makeRequest()
request.arguments = {
	slug: user.slug
}

ava('handler() should update specified card', async (test) => {
	const context = makeContext([
		session,
		user
	])

	const result = await handler(session.id, context, user, request)
	test.deepEqual(result, {
		id: user.id,
		type: user.type,
		version: user.version,
		slug: user.slug
	})

	const updated = await context.getCardById(session.id, user.id)
	test.is(updated.data.timestamp, request.timestamp)
})
