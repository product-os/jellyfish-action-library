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
} = require('../../lib/actions/action-delete-card')

const request = makeRequest()
const message = makeMessage()
message.data = {
	actor: session.data.actor
}

ava('handler() should return card if already not active', async (test) => {
	const context = makeContext([
		session
	])
	const msg = _.cloneDeep(message)
	msg.active = false

	const result = await handler(session.id, context, msg, request)
	test.deepEqual(result, {
		id: msg.id,
		type: msg.type,
		version: msg.version,
		slug: msg.slug
	})
})

ava('handler() should throw an error on invalid type', async (test) => {
	const context = makeContext([
		session
	])

	const error = await test.throwsAsync(handler(session.id, context, message, request))
	test.is(error.message, `No such type: ${message.type}`)
})

ava('handler() should soft delete an active card', async (test) => {
	const context = makeContext([
		types.message,
		message
	])

	const result = await handler(session.id, context, message, request)
	test.deepEqual(result, {
		id: message.id,
		type: message.type,
		version: message.version,
		slug: message.slug
	})

	const updated = await context.getCardById(session.id, message.id)
	test.false(updated.active)
})
