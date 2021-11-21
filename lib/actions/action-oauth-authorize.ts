import { defaultEnvironment } from '@balena/jellyfish-environment';
import type { ActionFile } from '@balena/jellyfish-plugin-base';
import isNull from 'lodash/isNull';

const handler: ActionFile['handler'] = async (
	session,
	context,
	_card,
	request,
) => {
	const syncContextInstance = context.sync.getActionContext(
		request.arguments.provider,
		context,
		request.context,
		session,
	);

	const integrationEnvVars = defaultEnvironment.getIntegration(
		request.arguments.provider as string,
	);
	if (isNull(integrationEnvVars)) {
		throw new Error(
			`Environment variables not found for integration "${request.arguments.provider}"`,
		);
	}

	return context.sync.authorize(
		request.arguments.provider,
		integrationEnvVars,
		syncContextInstance,
		{
			code: request.arguments.code,
			origin: request.arguments.origin,
		},
	);
};

export const actionOAuthAuthorize: ActionFile = {
	handler,
	card: {
		slug: 'action-oauth-authorize',
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
				code: {
					type: 'string',
				},
				origin: {
					type: 'string',
				},
			},
		},
	},
};
