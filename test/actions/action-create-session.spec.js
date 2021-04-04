/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const _ = require('lodash')
const ava = require('ava')
const bcrypt = require('bcrypt')
const {
	makeContext,
	makeRequest,
	makeUser,
	session,
	types
} = require('./helpers')
const {
	BCRYPT_SALT_ROUNDS
} = require('../../lib/actions/constants')
const {
	handler,
	pre
} = require('../../lib/actions/action-create-session')

const request = makeRequest()

ava('pre() should throw an error on invalid scope schema', async (test) => {
	const context = makeContext()
	const req = _.cloneDeep(request)
	req.arguments.scope = 'foobar'

	const error = await test.throwsAsync(pre(session.id, context, req))
	test.is(error.message, 'Invalid schema for session scope')
})

ava('pre() should throw an error on invalid username', async (test) => {
	const context = makeContext()
	const req = _.cloneDeep(request)
	req.card = 'foobar'

	const error = await test.throwsAsync(pre(session.id, context, req))
	test.is(error.message, 'Incorrect username or password')
})

ava('pre() should throw an error on disallowed login', async (test) => {
	const user = makeUser()
	const context = makeContext([
		user
	])
	const req = _.cloneDeep(request)
	req.card = user.id

	const error = await test.throwsAsync(pre(session.id, context, req))
	test.is(error.message, 'Login disallowed')
})

ava('pre() should throw an error on invalid password', async (test) => {
	const user = makeUser()
	user.data.hash = await bcrypt.hash('foo', BCRYPT_SALT_ROUNDS)
	const context = makeContext([
		user
	])
	const req = _.cloneDeep(request)
	req.card = user.id
	req.arguments.password = 'bar'

	const error = await test.throwsAsync(pre(session.id, context, req))
	test.is(error.message, 'Invalid password')
})

ava('pre() should return session arguments on success', async (test) => {
	const plaintext = 'foo'
	const user = makeUser()
	user.data.hash = await bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS)
	const context = makeContext([
		user
	])
	const req = _.cloneDeep(request)
	req.card = user.id
	req.arguments.password = plaintext
	req.arguments.scope = {
		type: 'object',
		properties: {
			slug: {
				type: 'string',
				const: user.slug
			}
		}
	}

	const result = await pre(session.id, context, req)
	test.deepEqual(result, {
		password: 'CHECKED IN PRE HOOK',
		scope: req.arguments.scope
	})
})

ava('handler() should throw an error on invalid user', async (test) => {
	const user = makeUser()
	const context = makeContext()

	const error = await test.throwsAsync(handler(session.id, context, user, request))
	test.is(error.message, `No such user: ${user.id}`)
})

ava('handler() should throw an error on disallowed login', async (test) => {
	const user = makeUser()
	const context = makeContext([
		user
	])

	const error = await test.throwsAsync(handler(session.id, context, user, request))
	test.is(error.message, 'Login disallowed')
})

ava('handler() should throw an error on no session type card', async (test) => {
	const user = makeUser()
	user.data.hash = 'foobar'
	const context = makeContext([
		user
	])

	const error = await test.throwsAsync(handler(session.id, context, user, request))
	test.is(error.message, 'No such type: session')
})

ava('handler() should create a session on valid request', async (test) => {
	const user = makeUser()
	user.data.hash = 'foobar'
	const context = makeContext([
		types.session,
		user
	])

	const result = await handler(session.id, context, user, request)
	test.false(_.isNull(result.slug.match(/^session-/)))
})
