import { strict as assert } from 'assert';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import type { WorkerContext } from '@balena/jellyfish-types/build/worker';
import ActionLibrary from '../../../lib';
import { actionPing } from '../../../lib/actions/action-ping';

const handler = actionPing.handler;
let ctx: integrationHelpers.IntegrationTestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await integrationHelpers.before({
		plugins: [DefaultPlugin, ActionLibrary, ProductOsPlugin],
	});
	actionContext = ctx.worker.getActionContext({
		id: `test-${ctx.generateRandomID()}`,
	});
});

afterAll(async () => {
	return integrationHelpers.after(ctx);
});

describe('action-ping', () => {
	test('should update specified contract', async () => {
		// Create ping contract
		const ping = await ctx.kernel.insertCard(ctx.logContext, ctx.session, {
			id: ctx.generateRandomID(),
			name: ctx.generateRandomWords(3),
			slug: ctx.generateRandomSlug({
				prefix: 'ping',
			}),
			type: 'ping@1.0.0',
			version: '1.0.0',
			active: true,
			created_at: new Date().toISOString(),
			data: {
				timestamp: new Date().toISOString(),
			},
		});

		// Create request using ping contract
		const request: any = {
			context: {
				id: `TEST-${ctx.generateRandomID()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.actor.id,
			originator: ctx.generateRandomID(),
			arguments: {
				slug: ping.slug,
			},
		};

		// Execute handler and check results
		const typeContract = await ctx.kernel.getCardBySlug(
			ctx.logContext,
			ctx.session,
			'ping@1.0.0',
		);
		assert(typeContract);
		const result = await handler(
			ctx.session,
			actionContext,
			typeContract,
			request,
		);
		expect(result).toEqual({
			id: ping.id,
			type: ping.type,
			version: ping.version,
			slug: ping.slug,
		});

		// Check timestamp of updated contract
		const updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			ping.id,
		);
		assert(updated);
		expect(updated.data.timestamp).toEqual(request.timestamp);
	});
});
