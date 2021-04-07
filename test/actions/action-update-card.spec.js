/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

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
} = require('../../lib/actions/action-update-card')

const request = makeRequest()
request.arguments = {
	patch: [
		{
			op: 'replace',
			path: '/data/payload/message',
			value: 'bar'
		}
	]
}

const message = makeMessage()
message.data = {
	actor: session.data.actor,
	payload: {
		message: 'foo'
	}
}

ava('handler() should throw an error on invalid type', async (test) => {
	const context = makeContext()

	const error = await test.throwsAsync(handler(session.id, context, message, request))
	test.is(error.message, `No such type: ${message.type}`)
})

ava('handler() should patch card', async (test) => {
	const context = makeContext([
		types.message,
		message
	])

	await handler(session.id, context, message, request)
	const updated = await context.getCardById(session.id, message.id)
	test.is(updated.data.payload.message, request.arguments.patch[0].value)
})
