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
} = require('../../lib/actions/action-increment')

const request = makeRequest()
request.arguments = {
	path: [ 'data', 'count' ]
}

const message = makeMessage()
message.data = {
	actor: session.data.actor,
	count: 0,
	foo: 'bar'
}

ava('handler() should throw an error on invalid type', async (test) => {
	const context = makeContext()

	const error = await test.throwsAsync(handler(session.id, context, message, request))
	test.is(error.message, `No such type: ${message.type}`)
})

ava('handler() should increment specified path if number', async (test) => {
	const context = makeContext([
		types.message,
		message
	])

	const result = await handler(session.id, context, message, request)
	test.is(result.id, message.id)

	const updated = await context.getCardById(session.id, message.id)
	test.is(updated.data.count, 1)
})

ava('handler() should increment specified path if string', async (test) => {
	const context = makeContext([
		types.message,
		message
	])
	const req = _.cloneDeep(request)
	req.arguments.path = [ 'data', 'foo' ]

	const result = await handler(session.id, context, message, req)
	test.is(result.id, message.id)

	const updated = await context.getCardById(session.id, message.id)
	test.is(updated.data.foo, `${message.data.foo}1`)
})
