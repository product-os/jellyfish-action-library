/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const environment = require('@balena/jellyfish-environment')

const handler = async (session, context, card, request) => {
	const syncContextInstance = context.sync.getActionContext(request.arguments.provider,
		context, request.context, session)

	return context.sync.authorize(
		request.arguments.provider,
		environment.integration[request.arguments.provider],
		syncContextInstance,
		{
			code: request.arguments.code,
			origin: request.arguments.origin
		}
	)
}

module.exports = {
	handler
}
