/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const ava = require('ava')
const environment = require('@balena/jellyfish-environment')
const nock = require('nock')
const uuid = require('uuid')
const {
	actor,
	makeContext,
	makeOrg,
	makeRequest,
	makeUser,
	session,
	types
} = require('./helpers')
const {
	handler
} = require('../../lib/actions/action-send-first-time-login-link')

const request = makeRequest()

const makeFirstTimeLogin = () => {
	return {
		id: uuid.v4(),
		slug: `first-time-login-${uuid.v4()}`,
		type: 'first-time-login@1.0.0',
		version: '1.0.0',
		active: true,
		data: {}
	}
}

ava('handler() should throw an error on invalid type', async (test) => {
	const firstTimeLogin = makeFirstTimeLogin()
	const context = makeContext([
		firstTimeLogin
	])

	const error = await test.throwsAsync(handler(session.id, context, makeUser(), request))
	test.is(error.message, `No such type: ${firstTimeLogin.type.split('@')[0]}`)
})

ava('handler() should throw an error if the user does not have an email address', async (test) => {
	const firstTimeLogin = makeFirstTimeLogin()
	const context = makeContext([
		firstTimeLogin,
		types['first-time-login']
	])

	const user = makeUser()
	let error = await test.throwsAsync(handler(session.id, context, user, request))
	test.is(error.message, `User with slug ${user.slug} does not have an email address`)

	user.data.email = []
	error = await test.throwsAsync(handler(session.id, context, user, request))
	test.is(error.message, `User with slug ${user.slug} does not have an email address`)
})

ava('handler() should throw an error if the user is not active', async (test) => {
	const user = makeUser()
	user.active = false
	const firstTimeLogin = makeFirstTimeLogin()
	const context = makeContext([
		firstTimeLogin,
		types['first-time-login']
	])

	const error = await test.throwsAsync(handler(session.id, context, user, request))
	test.is(error.message, `User with slug ${user.slug} is not active`)
})

ava('handler() should throw an error if the requesting actor does not belong to any orgs', async (test) => {
	const user = makeUser()
	user.data.email = 'user@foo.bar'
	const firstTimeLogin = makeFirstTimeLogin()
	const context = makeContext([
		actor,
		firstTimeLogin,
		types['first-time-login']
	])

	const error = await test.throwsAsync(handler(session.id, context, user, request))
	test.is(error.message, 'You do not belong to an organisation and thus cannot send a first-time login link to any users')
})

ava('handler() should send first time login link on valid request', async (test) => {
	const org = makeOrg()
	const user = makeUser()
	user.data.email = 'user@foo.bar'
	user.data.roles = []
	const firstTimeLogin = makeFirstTimeLogin()
	const context = makeContext([
		actor,
		firstTimeLogin,
		org,
		user,
		types['first-time-login']
	])

	nock(environment.mail.options.baseUrl)
		.intercept(`/${environment.mail.options.domain}/messages`, 'POST')
		.reply(200, 'OK')

	const result = await handler(session.id, context, user, request)
	test.deepEqual(result, {
		id: user.id,
		type: user.type,
		version: user.version,
		slug: user.slug
	})

	// Also check that the 'user-community' role was added to the user.
	const updated = await context.getCardById(session.id, user.id)
	test.true(updated.data.roles.includes('user-community'))
})
