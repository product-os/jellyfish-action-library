/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const _ = require('lodash')
const ava = require('ava')
const bcrypt = require('bcrypt')
const uuid = require('uuid')
const {
	makeContext,
	makeRequest,
	makeUser,
	session,
	types
} = require('./helpers')
const {
	PASSWORDLESS_USER_HASH
} = require('../../lib/actions/constants')
const {
	handler,
	pre
} = require('../../lib/actions/action-create-user')

const user = makeUser()
const request = makeRequest()
request.arguments = {
	username: `user-${uuid.v4()}`,
	email: 'user@foo.bar',
	password: 'baz'
}

ava('pre() sets password-less user hash when no password argument is set', async (test) => {
	const req = _.cloneDeep(request)
	Reflect.deleteProperty(req.arguments, 'password')

	const result = await pre(session.id, {}, req)
	test.deepEqual(result, {
		...req.arguments,
		password: PASSWORDLESS_USER_HASH
	})
})

ava('pre() hashes provided plaintext password', async (test) => {
	const plaintext = request.arguments.password
	const result = await pre(session.id, {}, request)
	const match = await bcrypt.compare(plaintext, result.password)
	test.true(match)
})

ava('handler() should throw an error on attempt to insert existing card', async (test) => {
	const context = makeContext([
		types.user,
		user
	])
	const req = _.cloneDeep(request)
	req.arguments.username = user.slug

	const error = await test.throwsAsync(handler(session.id, context, user, req))
	test.is(error.message, `${user.slug} already exists`)
})

ava('handler() should create a new user card', async (test) => {
	const context = makeContext([
		types.user,
		user
	])

	const result = await handler(session.id, context, user, request)
	test.is(result.slug, request.arguments.username)
})
