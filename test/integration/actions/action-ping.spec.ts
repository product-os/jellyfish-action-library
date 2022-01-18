import { strict as assert } from 'assert';
import { testUtils as coreTestUtils } from '@balena/jellyfish-core';
import {
	testUtils as workerTestUtils,
	WorkerContext,
} from '@balena/jellyfish-worker';
import { actionLibrary } from '../../../lib';
import { actionPing } from '../../../lib/actions/action-ping';

const handler = actionPing.handler;
let ctx: workerTestUtils.TestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await workerTestUtils.newContext({
		plugins: [actionLibrary],
	});
	actionContext = ctx.worker.getActionContext({
		id: `test-${coreTestUtils.generateRandomId()}`,
	});
});

afterAll(async () => {
	return workerTestUtils.destroyContext(ctx);
});

describe('action-ping', () => {
	test('should update specified contract', async () => {
		// Create ping contract
		const ping = await ctx.kernel.insertCard(ctx.logContext, ctx.session, {
			id: coreTestUtils.generateRandomId(),
			name: coreTestUtils.generateRandomSlug(),
			slug: coreTestUtils.generateRandomSlug({
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
				id: `TEST-${coreTestUtils.generateRandomId()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.adminUserId,
			originator: coreTestUtils.generateRandomId(),
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
