/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import type { ActionFile } from '@balena/jellyfish-plugin-base';
import { mirror } from './mirror';

const handler: ActionFile['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	return mirror('github', session, context, card, request);
};

export const actionIntegrationGitHubMirrorEvent: ActionFile = {
	handler,
	card: {
		slug: 'action-integration-github-mirror-event',
		type: 'action@1.0.0',
		data: {
			filter: {
				type: 'object',
				required: ['type'],
				properties: {
					type: {
						type: 'string',
						enum: ['issue@1.0.0', 'pull-request@1.0.0', 'message@1.0.0'],
					},
				},
			},
			arguments: {},
		},
	},
};
