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
} = require('../../lib/actions/action-create-card')

const request = makeRequest()
request.arguments = {
	reason: 'test',
	properties: {}
}

const message = makeMessage()
message.data = {
	actor: session.data.actor,
	payload: {
		message: 'foo'
	}
}

ava('handler() should throw an error on when trying to use an action to create an event', async (test) => {
	const context = makeContext()
	const req = _.cloneDeep(request)
	req.arguments.properties = {
		version: '1.0.0',
		data: {
			timestamp: '2021-04-05T07:25:56.952Z',
			target: uuid.v4(),
			actor: uuid.v4()
		}
	}

	const error = await test.throwsAsync(handler(session.id, context, message, req))
	test.is(error.message, 'You may not use card actions to create an event')
})

ava('handler() should use provided slug', async (test) => {
	const context = makeContext()
	const req = _.cloneDeep(request)
	req.arguments.properties = {
		slug: `foobar-${uuid.v4()}`
	}

	const result = await handler(session.id, context, message, req)
	test.is(result.slug, req.arguments.properties.slug)
})

ava('handler() should generate a slug when one is not provided', async (test) => {
	const context = makeContext()

	const result = await handler(session.id, context, message, request)
	test.false(_.isNull(result.slug.match(/^message-/)))
})
