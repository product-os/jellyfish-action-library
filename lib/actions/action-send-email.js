/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const Mail = require('@balena/jellyfish-mail')
const environment = require('@balena/jellyfish-environment')

const handler = async (session, context, card, request) => {
	const {
		fromAddress,
		toAddress,
		subject,
		html
	} = request.arguments

	const mail = new Mail(environment.mail.options)

	const response = await mail.sendEmail({
		toAddress,
		fromAddress,
		subject,
		html
	})

	return response
}

module.exports = {
	handler,
	card: {
		slug: 'action-send-email',
		type: 'action@1.0.0',
		name: 'Send email',
		data: {
			arguments: {
				toAddress: {
					type: 'string',
					format: 'email'
				},
				fromAddress: {
					type: 'string',
					format: 'email'
				},
				subject: {
					type: 'string'
				},
				html: {
					type: 'string'
				}
			}
		}
	}
}
