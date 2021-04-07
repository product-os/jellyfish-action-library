/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const _ = require('lodash')
const ava = require('ava')
const {
	makeContext,
	makeMessage,
	makeRequest,
	session,
	types
} = require('./helpers')
const {
	handler
} = require('../../lib/actions/action-create-event')

const request = makeRequest()
request.arguments = {
	type: 'message'
}

const message = makeMessage()
message.data = {
	actor: session.data.actor,
	payload: {
		message: request.arguments.message
	}
}

ava('handler() should throw an error on invalid type', async (test) => {
	const context = makeContext()

	const error = await test.throwsAsync(handler(session.id, context, message, request))
	test.is(error.message, `No such type: ${request.arguments.type}`)
})

ava('handler() should return event card', async (test) => {
	const context = makeContext([
		types.message,
		message
	])

	const result = await handler(session.id, context, message, request)
	test.false(_.isNull(result.slug.match(/^message-/)))
})

ava('handler() should throw an error on attempt to insert existing card', async (test) => {
	const context = makeContext([
		types.message,
		message
	])
	const req = _.cloneDeep(request)
	req.arguments.slug = message.slug

	const error = await test.throwsAsync(handler(session.id, context, message, req))
	test.is(error.message, `${message.slug} already exists`)
})
