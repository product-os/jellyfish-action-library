import { strict as assert } from 'assert';
import { testUtils as coreTestUtils } from '@balena/jellyfish-core';
import {
	testUtils as workerTestUtils,
	WorkerContext,
} from '@balena/jellyfish-worker';
import { pick } from 'lodash';
import { actionLibrary } from '../../../lib';
import { actionIncrementTag } from '../../../lib/actions/action-increment-tag';

const handler = actionIncrementTag.handler;
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

describe('action-increment-tag', () => {
	test('should increment a tag', async () => {
		const tag = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'tag@1.0.0',
			coreTestUtils.generateRandomSlug(),
			{
				count: 0,
			},
		);

		const request: any = {
			context: {
				id: `TEST-${coreTestUtils.generateRandomId()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.adminUserId,
			originator: coreTestUtils.generateRandomId(),
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
		const name = `tag-${coreTestUtils.generateRandomId()}`;
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
