/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const ava = require('ava')
const google = require('googleapis').google
const sinon = require('sinon')
const uuid = require('uuid')
const {
	makeContext,
	makeRequest,
	makeMessage,
	session,
	types
} = require('./helpers')
const {
	handler
} = require('../../lib/actions/action-google-meet')

const conferenceUrl = 'http://foo.bar'
const request = makeRequest()

ava.serial.beforeEach(() => {
	sinon.restore()
})

// Stub Google API
const stub = (data) => {
	sinon.stub(google.auth, 'GoogleAuth').callsFake(() => {
		return {
			getClient: () => {
				return {
					request: () => {
						return {
							data
						}
					}
				}
			}
		}
	})
}

ava.serial('handler() should throw on missing hangout link', async (test) => {
	stub({
		id: uuid.v4()
	})

	const message = makeMessage()
	const error = await test.throwsAsync(handler(session.id, makeContext(), message, request))
	test.is(error.message, 'Meet/Hangout Link not found in the event\'s body')
})

ava.serial('handler() should throw on missing event ID', async (test) => {
	stub({
		hangoutLink: conferenceUrl
	})

	const message = makeMessage()
	const error = await test.throwsAsync(handler(session.id, makeContext(), message, request))
	test.is(error.message, 'Missing required parameters: eventId')
})

ava.serial('handler() should throw on invalid type', async (test) => {
	stub({
		hangoutLink: conferenceUrl,
		id: uuid.v4()
	})

	const message = makeMessage()
	const error = await test.throwsAsync(handler(session.id, makeContext(), message, request))
	test.is(error.message, `No such type: ${message.type}`)
})

ava.serial('handler() should set conferenceUrl on card', async (test) => {
	stub({
		hangoutLink: conferenceUrl,
		id: uuid.v4()
	})

	const message = makeMessage()
	const context = makeContext([
		message,
		types.message
	])
	const result = await handler(session.id, context, message, request)
	test.deepEqual(result, {
		id: message.id,
		type: message.type,
		slug: message.slug,
		version: message.version,
		conferenceUrl
	})
})
