/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const _ = require('lodash')
const ava = require('ava')
const bcrypt = require('bcrypt')
const {
	BCRYPT_SALT_ROUNDS,
	PASSWORDLESS_USER_HASH
} = require('../../lib/actions/constants')
const {
	makeContext,
	makeUser,
	session,
	types,
	makeRequest
} = require('./helpers')
const {
	handler,
	pre
} = require('../../lib/actions/action-set-password')

const request = makeRequest()
request.arguments = {
	newPassword: 'foobar'
}

ava('pre() should set password if first time password', async (test) => {
	const user = makeUser()
	user.data = {
		hash: PASSWORDLESS_USER_HASH
	}
	const req = _.cloneDeep(request)
	req.card = user.id
	request.arguments.currentPassword = null
	const context = makeContext([
		types.user,
		user
	])

	const plaintext = req.arguments.newPassword
	const result = await pre(session.id, context, req)
	test.not(result.newPassword, plaintext)

	const match = await bcrypt.compare(plaintext, result.newPassword)
	test.true(match)
})

ava('pre() should throw an error if current password is incorrect', async (test) => {
	const user = makeUser()
	user.data = {
		hash: await bcrypt.hash('foo', BCRYPT_SALT_ROUNDS)
	}
	const req = _.cloneDeep(request)
	req.card = user.id
	req.arguments.currentPassword = 'bar'
	const context = makeContext([
		types.user,
		user
	])

	const error = await test.throwsAsync(pre(session.id, context, req))
	test.is(error.message, 'Invalid password')
})

ava('pre() should set password if current password is correct', async (test) => {
	const plaintext = 'foo'
	const user = makeUser()
	user.data = {
		hash: await bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS)
	}
	const req = _.cloneDeep(request)
	req.card = user.id
	req.arguments.currentPassword = plaintext
	const context = makeContext([
		types.user,
		user
	])

	const newPassword = req.arguments.newPassword
	const result = await pre(session.id, context, req)
	test.is(result.currentPassword, 'CHECKED IN PRE HOOK')

	const match = await bcrypt.compare(newPassword, result.newPassword)
	test.true(match)
})

ava('handler() should throw an error on invalid type', async (test) => {
	const user = makeUser()
	const context = makeContext()

	const error = await test.throwsAsync(handler(session.id, context, user, request))
	test.is(error.message, `No such type: ${user.type}`)
})

ava('handler() should update current password (first time)', async (test) => {
	const user = makeUser()
	user.data = {
		hash: PASSWORDLESS_USER_HASH
	}
	const context = makeContext([
		types.user,
		user
	])
	const req = _.cloneDeep(request)
	req.card = user.id
	request.arguments.currentPassword = null

	const result = await handler(session.id, context, user, req)
	test.is(result.data.hash, req.arguments.newPassword)
})

ava('handler() should update current password (not first time)', async (test) => {
	const plaintext = 'foo'
	const user = makeUser()
	user.data = {
		hash: await bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS)
	}
	const context = makeContext([
		types.user,
		user
	])
	const req = _.cloneDeep(request)
	req.card = user.id
	request.arguments.currentPassword = plaintext

	const result = await handler(session.id, context, user, req)
	test.is(result.data.hash, req.arguments.newPassword)
})
