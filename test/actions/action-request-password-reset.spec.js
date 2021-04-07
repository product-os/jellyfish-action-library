/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const _ = require('lodash')
const ava = require('ava')
const environment = require('@balena/jellyfish-environment')
const nock = require('nock')
const {
	PASSWORDLESS_USER_HASH
} = require('../../lib/actions/constants')
const {
	makeUser,
	makeContext,
	makeRequest,
	session
} = require('./helpers')
const {
	handler
} = require('../../lib/actions/action-request-password-reset')

const request = makeRequest()

ava('handler() should not send password reset email on unknown user', async (test) => {
	const user = makeUser()
	const context = makeContext()
	const req = _.cloneDeep(request)
	req.arguments.username = 'foobar'

	const result = await handler(session.id, context, user, req)
	test.deepEqual(result, {
		id: user.id,
		type: user.type,
		version: user.version,
		slug: user.slug
	})
})

ava('handler() should not send password reset email when user has no password hash', async (test) => {
	const user = makeUser()
	user.data.hash = PASSWORDLESS_USER_HASH
	user.data.email = 'user@foo.bar'
	const context = makeContext([
		user
	])
	const req = _.cloneDeep(request)
	req.arguments.username = user.slug.replace('user-', '')

	const result = await handler(session.id, context, user, req)
	test.deepEqual(result, {
		id: user.id,
		type: user.type,
		version: user.version,
		slug: user.slug
	})
})

ava('handler() should send password reset email for valid request', async (test) => {
	const user = makeUser()
	user.data.hash = 'foobar'
	user.data.email = 'user@foo.bar'
	const context = makeContext([
		user
	])
	const req = _.cloneDeep(request)
	req.arguments.username = user.slug.replace('user-', '')

	nock(environment.mail.options.baseUrl)
		.intercept(`/${environment.mail.options.domain}/messages`, 'POST')
		.reply(200, 'OK')

	const result = await handler(session.id, context, user, req)
	test.deepEqual(result, {
		id: user.id,
		type: user.type,
		version: user.version,
		slug: user.slug
	})
})
