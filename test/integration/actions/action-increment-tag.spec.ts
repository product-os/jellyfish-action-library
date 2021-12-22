import { strict as assert } from 'assert';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import type { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { pick } from 'lodash';
import ActionLibrary from '../../../lib';
import { actionIncrementTag } from '../../../lib/actions/action-increment-tag';

const handler = actionIncrementTag.handler;
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

describe('action-increment-tag', () => {
	test('should increment a tag', async () => {
		const tag = await ctx.createContract(
			ctx.actor.id,
			ctx.session,
			'tag@1.0.0',
			ctx.generateRandomWords(1),
			{
				count: 0,
			},
		);

		const request: any = {
			context: {
				id: `TEST-${ctx.generateRandomID()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.actor.id,
			originator: ctx.generateRandomID(),
			arguments: {
				name: tag.slug.replace(/^tag-/, ''),
			},
		};

		const result = await handler(ctx.session, actionContext, tag, request);
		expect(result).toEqual([pick(tag, ['id', 'type', 'version', 'slug'])]);

		let updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			tag.id,
		);
		assert(updated);
		expect(updated.data.count).toEqual(1);

		await handler(ctx.session, actionContext, tag, request);
		updated = await ctx.kernel.getCardById(ctx.logContext, ctx.session, tag.id);
		assert(updated);
		expect(updated.data.count).toEqual(2);
	});

	test('should create a new tag if one does not exist', async () => {
		const name = `tag-${ctx.generateRandomID()}`;
		const id = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				logContext: ctx.logContext,
				action: 'action-increment-tag@1.0.0',
				card: 'tag@1.0.0',
				type: 'type',
				arguments: {
					reason: null,
					name,
				},
			},
		);
		await ctx.flushAll(ctx.session);
		const result = await ctx.queue.producer.waitResults(ctx.logContext, id);
		expect(result.error).toBe(false);

		const tagContract = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			(result as any).data[0].id,
		);
		assert(tagContract);
		expect(tagContract.type).toBe('tag@1.0.0');
		expect(tagContract.name).toBe(name);
		expect(tagContract.data.count).toBe(1);
	});
});
