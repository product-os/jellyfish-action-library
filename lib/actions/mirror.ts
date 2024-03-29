import { defaultEnvironment } from '@balena/jellyfish-environment';
import { getLogger } from '@balena/jellyfish-logger';
import * as metrics from '@balena/jellyfish-metrics';
import type { ContractSummary } from '@balena/jellyfish-types/build/core';
import type { WorkerContext } from '@balena/jellyfish-types/build/worker';
import type { ActionRequest } from '../types';

const logger = getLogger(__filename);

const mirror = async (
	type: string,
	session: string,
	context: WorkerContext,
	card: ContractSummary,
	request: ActionRequest,
) => {
	// Don't sync back changes that came externally
	if (request.originator) {
		const originator = await context.getCardById(
			context.privilegedSession,
			request.originator,
		);
		if (
			originator &&
			originator.type &&
			originator.type.split('@')[0] === 'external-event' &&
			// Only break the chain if we are trying to mirror
			// an external event that came from that same service
			originator.data.source === type
		) {
			logger.info(request.context, 'Not mirroring external event', {
				type,
				request,
			});

			return [];
		}
	}

	const cards = await metrics
		.measureMirror(type, async () => {
			return context.sync.mirror(
				type,
				defaultEnvironment.getIntegration(type),
				card,
				context.sync.getActionContext(type, context, request.context, session),
				{
					actor: request.actor,
					defaultUser: defaultEnvironment.integration.default.user,
					origin: `${defaultEnvironment.oauth.redirectBaseUrl}/oauth/${type}`,
				},
			);
		})
		.catch((error) => {
			logger.exception(request.context, 'Mirror error', error);
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

export { mirror };
