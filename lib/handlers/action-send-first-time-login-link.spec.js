/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const ava = require('ava')
const typedErrors = require('typed-errors')

const {
	handler
} = require('./action-send-first-time-login-link')

ava('should throw an error if the user doesn\'t have an email address', async (test) => {
	const contextStub = {
		getCardBySlug (_session, slug) {
			return {
				slug: 'first-time-login',
				name: 'first-time login',
				type: 'type@1.0.0',
				markers: [],
				data: {
					schema: {
						type: 'object',
						properties: {
							data: {
								type: 'object',
								properties: {
									requestedAt: {
										type: 'string',
										format: 'date-time'
									},
									expiresAt: {
										type: 'string',
										format: 'date-time'
									},
									firstTimeLoginToken: {
										type: 'string',
										format: 'uuid'
									}
								}
							}
						}
					}
				}
			}
		},
		errors: {
			WorkerNoElement: typedErrors.makeTypedError('WorkerNoElement')
		}
	}

	const requestStub = {
		context: {
			id: 'foo'
		}
	}

	const userCard1 = {
		slug: 'user-test',
		active: true,
		data: {}
	}

	const error1 = await test.throwsAsync(handler('foobar', contextStub, userCard1, requestStub))
	test.is(error1.message, `User with slug ${userCard1.slug} does not have an email address`)

	const userCard2 = {
		slug: 'user-foo',
		active: true,
		data: {
			email: []
		}
	}

	const error2 = await test.throwsAsync(handler('foobar', contextStub, userCard2, requestStub))
	test.is(error2.message, `User with slug ${userCard2.slug} does not have an email address`)
})
