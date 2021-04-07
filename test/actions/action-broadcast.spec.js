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
} = require('../../lib/actions/action-broadcast')

const request = makeRequest()
request.arguments = {
	message: 'bar'
}

const message = makeMessage()
message.data = {
	actor: session.data.actor,
	payload: {
		message: request.arguments.message
	}
}

ava('handler() should return broadcast card on unmatched message', async (test) => {
	const msg = _.cloneDeep(message)
	msg.data.payload.message = 'foobar'

	const context = makeContext([
		types.message,
		session,
		msg
	])

	const result = await handler(session.id, context, msg, request)
	test.false(_.isNull(result.slug.match(/^broadcast-/)))
})

ava('handler() should return null on matched message', async (test) => {
	const context = makeContext([
		types.message,
		session,
		message
	])

	const result = await handler(session.id, context, message, request)
	test.true(_.isNull(result))
})

ava('handler() should throw an error on invalid session', async (test) => {
	const context = makeContext()

	const error = await test.throwsAsync(handler('foobar', context, {}, request))
	test.is(error.message, 'Privileged session is invalid')
})
