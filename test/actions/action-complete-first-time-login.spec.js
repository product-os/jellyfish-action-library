/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const _ = require('lodash')
const ava = require('ava')
const {
	makeContext,
	makeFirstTimeLogin,
	makeRequest,
	makeUser,
	session,
	types
} = require('./helpers')
const {
	PASSWORDLESS_USER_HASH
} = require('../../lib/actions/constants')
const {
	handler
} = require('../../lib/actions/action-complete-first-time-login')

const request = makeRequest()

ava('handler() should throw on invalid reset token', async (test) => {
	const context = makeContext()

	const error = await test.throwsAsync(handler(session.id, context, {}, request))
	test.is(error.message, 'First-time login token invalid')
})

ava('handler() should throw an error when user already has a password', async (test) => {
	const user = makeUser()
	user.data.hash = 'foo'
	const firstTimeLogin = makeFirstTimeLogin()
	firstTimeLogin.links['is attached to'] = [
		user
	]
	const context = makeContext([
		firstTimeLogin,
		user,
		types.user
	])

	const error = await test.throwsAsync(handler(session.id, context, {}, request))
	test.is(error.message, 'User already has a password set')
})

ava('handler() should update password on valid first time login token', async (test) => {
	const user = makeUser()
	user.data.hash = PASSWORDLESS_USER_HASH
	const firstTimeLogin = makeFirstTimeLogin()
	firstTimeLogin.links['is attached to'] = [
		user
	]
	const context = makeContext([
		firstTimeLogin,
		user,
		types.user
	])
	const req = _.cloneDeep(request)
	req.arguments.newPassword = 'bar'

	const result = await handler(session.id, context, {}, req)
	test.deepEqual(result, {
		id: user.id,
		slug: user.slug,
		type: user.type,
		version: user.version,
		active: user.active,
		links: user.links,
		data: {
			hash: req.arguments.newPassword
		}
	})
})
