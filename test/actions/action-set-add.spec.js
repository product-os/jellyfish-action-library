/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const _ = require('lodash')
const ava = require('ava')
const uuid = require('uuid')
const {
	makeContext,
	makeMessage,
	makeRequest,
	session
} = require('./helpers')
const {
	handler
} = require('../../lib/actions/action-set-add')

const request = makeRequest()
const message = makeMessage()
message.data = {
	actor: session.data.actor,
	tags: []
}

ava('handler() should add value to array when property path is an array', async (test) => {
	const msg = _.cloneDeep(message)
	msg.id = uuid.v4()
	const context = makeContext([
		msg
	])
	const req = _.cloneDeep(request)
	req.arguments = {
		property: [ 'data', 'tags' ],
		value: 'foo'
	}

	const result = await handler(session.id, context, msg, req)
	test.is(result.id, msg.id)

	const updated = await context.getCardById(session.id, msg.id)
	test.deepEqual(updated.data.tags, [
		req.arguments.value
	])
})

ava('handler() should add an array of strings to an array', async (test) => {
	const msg = _.cloneDeep(message)
	msg.id = uuid.v4()
	const context = makeContext([
		msg
	])
	const req = _.cloneDeep(request)
	req.arguments = {
		property: [ 'data', 'tags' ],
		value: [
			'foo',
			'bar'
		]
	}

	const result = await handler(session.id, context, msg, req)
	test.is(result.id, msg.id)

	const updated = await context.getCardById(session.id, msg.id)
	test.deepEqual(updated.data.tags, req.arguments.value)
})

ava('handler() should add value to array when property path is a string', async (test) => {
	const msg = _.cloneDeep(message)
	msg.id = uuid.v4()
	const context = makeContext([
		msg
	])
	const req = _.cloneDeep(request)
	req.arguments = {
		property: 'data.tags',
		value: 'foo'
	}

	const result = await handler(session.id, context, msg, req)
	test.is(result.id, msg.id)

	const updated = await context.getCardById(session.id, msg.id)
	test.deepEqual(updated.data.tags, [
		req.arguments.value
	])
})
