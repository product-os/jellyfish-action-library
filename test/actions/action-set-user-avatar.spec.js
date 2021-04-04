/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const _ = require('lodash')
const ava = require('ava')
const md5 = require('blueimp-md5')
const nock = require('nock')
const {
	makeContext,
	makeRequest,
	makeUser,
	session,
	types
} = require('./helpers')
const {
	handler
} = require('../../lib/actions/action-set-user-avatar')

const request = makeRequest()
request.arguments = {
	newPassword: 'foobar'
}

ava('handler() should not set avatar if user has no email', async (test) => {
	const user = makeUser()
	const context = makeContext([
		user
	])

	const result = await handler(session.id, context, user, request)
	test.deepEqual(result, {
		id: user.id,
		slug: user.slug,
		version: user.version,
		type: user.type
	})

	const card = await context.getCardById(session.id, user.id)
	test.true(_.isUndefined(card.data.avatar))
})

ava('handler() should not update avatar if already set', async (test) => {
	const user = makeUser()
	user.data.avatar = 'foobar'
	const context = makeContext([
		user
	])

	const result = await handler(session.id, context, user, request)
	test.deepEqual(result, {
		id: user.id,
		slug: user.slug,
		version: user.version,
		type: user.type
	})

	const card = await context.getCardById(session.id, user.id)
	test.is(card.data.avatar, user.data.avatar)
})

ava('handler() should not set avatar on invalid gravatar URL', async (test) => {
	const user = makeUser()
	user.data.email = 'foobar'
	const context = makeContext([
		types.user,
		user
	])

	nock('https://www.gravatar.com')
		.intercept(`/avatar/${md5(user.data.email.trim())}?d=404`, 'HEAD')
		.reply(404, '')

	const result = await handler(session.id, context, user, request)
	test.deepEqual(result, {
		id: user.id,
		slug: user.slug,
		version: user.version,
		type: user.type
	})

	const card = await context.getCardById(session.id, user.id)
	test.is(card.data.avatar, null)
})

ava('handler() should set avatar on valid gravatar URL', async (test) => {
	const user = makeUser()
	user.data.email = 'user@foo.bar'
	const context = makeContext([
		types.user,
		user
	])

	nock('https://www.gravatar.com')
		.intercept(`/avatar/${md5(user.data.email.trim())}?d=404`, 'HEAD')
		.reply(200, 'OK')

	const result = await handler(session.id, context, user, request)
	test.deepEqual(result, {
		id: user.id,
		slug: user.slug,
		version: user.version,
		type: user.type
	})

	const card = await context.getCardById(session.id, user.id)
	test.is(card.data.avatar, `https://www.gravatar.com/avatar/${md5(user.data.email.trim())}?d=404`)
})

ava('handler() should error out on invalid type', async (test) => {
	const user = makeUser()
	user.data.email = 'user@foo.bar'
	const context = makeContext([
		user
	])

	nock('https://www.gravatar.com')
		.intercept(`/avatar/${md5(user.data.email.trim())}?d=404`, 'HEAD')
		.reply(200, 'OK')

	const error = await test.throwsAsync(handler(session.id, context, user, request))
	test.is(error.message, `No such type: ${types.user.slug}`)
})
