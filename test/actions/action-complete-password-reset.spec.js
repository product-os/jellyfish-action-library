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
	makePasswordReset,
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
} = require('../../lib/actions/action-complete-password-reset')

const request = makeRequest()

ava('pre() should hash new password', async (test) => {
	const plaintext = 'foo'
	const context = makeContext()
	const req = _.cloneDeep(request)
	req.arguments.newPassword = plaintext

	const result = await pre(session.id, context, req)
	const match = await bcrypt.compare(plaintext, result.newPassword)
	test.true(match)
})

ava('handler() should throw on invalid reset token', async (test) => {
	const context = makeContext()

	const error = await test.throwsAsync(handler(session.id, context, {}, request))
	test.is(error.message, 'Reset token invalid')
})

ava('handler() should update password on valid reset token', async (test) => {
	const user = makeUser()
	user.data.hash = await bcrypt.hash('foo', BCRYPT_SALT_ROUNDS)
	const passwordReset = makePasswordReset()
	passwordReset.links['is attached to'] = [
		user
	]
	const context = makeContext([
		passwordReset,
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
