/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const ava = require('ava')
const environment = require('@balena/jellyfish-environment')
const nock = require('nock')
const {
	makeContext,
	makeRequest,
	session
} = require('./helpers')
const {
	handler
} = require('../../lib/actions/action-send-email')

const request = makeRequest()
request.arguments = {
	fromAddress: 'from@foo.bar',
	toAddress: 'to@foo.bar',
	subject: 'Test Subject',
	html: 'Test Body'
}

ava('handler() should send email', async (test) => {
	const context = makeContext()

	nock(environment.mail.options.baseUrl)
		.intercept(`/${environment.mail.options.domain}/messages`, 'POST')
		.reply(200, 'OK')

	const result = await handler(session.id, context, {}, request)
	test.is(result, 'OK')
})
