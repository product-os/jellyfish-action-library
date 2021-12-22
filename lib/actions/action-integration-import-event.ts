import { defaultEnvironment } from '@balena/jellyfish-environment';
import { getLogger } from '@balena/jellyfish-logger';
import { ActionFile } from '@balena/jellyfish-plugin-base';
import { JellyfishError } from '@balena/jellyfish-types';
import { ContractSummary } from '@balena/jellyfish-types/build/core';

const logger = getLogger(__filename);

const handler: ActionFile['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const cards = await context.sync
		.translate(
			card.data.source,
			defaultEnvironment.getIntegration(card.data.source as string),
			card,
			context.sync.getActionContext(
				card.data.source,
				context,
				request.context,
				session,
			),
			{
				actor: request.actor,
				defaultUser: defaultEnvironment.integration.default.user,
				origin: `${defaultEnvironment.oauth.redirectBaseUrl}/oauth/${card.data.source}`,
				timestamp: request.timestamp,
			},
		)
		.catch((error: JellyfishError) => {
			logger.exception(request.context, 'Translate error', error);
			throw error;
		});

	return cards.map((element: ContractSummary) => {
		return {
			id: element.id,
			type: element.type,
			version: element.version,
			slug: element.slug,
		};
	});
};

export const actionIntegrationImportEvent: ActionFile = {
	handler,
	card: {
		slug: 'action-integration-import-event',
		type: 'action@1.0.0',
		data: {
			filter: {
				type: 'object',
				required: ['type', 'data'],
				properties: {
					type: {
						type: 'string',
						const: 'external-event@1.0.0',
					},
					data: {
						type: 'object',
						required: ['source'],
						properties: {
							source: {
								type: 'string',
							},
						},
					},
				},
			},
			arguments: {},
		},
	},
};
