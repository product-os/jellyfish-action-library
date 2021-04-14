/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import type { ActionFile } from '@balena/jellyfish-plugin-base';

const handler: ActionFile['handler'] = async (
	_session,
	context,
	card,
	request,
) => {
	return context.sync.associate(
		request.arguments.provider,
		card,
		request.arguments.credentials,

		// We need privileged access in order to add the access
		// token data to the user, as the request that will
		// initiate this action is the external service when
		// posting us back the temporart access code.
		context.sync.getActionContext(
			request.arguments.provider,
			context,
			request.context,
			context.privilegedSession,
		),
	);
};

export const actionOAuthAssociate: ActionFile = {
	handler,
	card: {
		slug: 'action-oauth-associate',
		type: 'action@1.0.0',
		data: {
			filter: {
				type: 'object',
				properties: {
					type: {
						type: 'string',
						const: 'user@1.0.0',
					},
				},
				required: ['type'],
			},
			arguments: {
				provider: {
					type: 'string',
					enum: ['outreach', 'balena-api'],
				},
				credentials: {
					type: 'object',
					properties: {
						access_token: {
							type: 'string',
						},
						token_type: {
							type: 'string',
						},
					},
					required: ['access_token', 'token_type'],
				},
			},
		},
	},
};
