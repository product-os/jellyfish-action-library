import { strict as assert } from 'assert';
import { testUtils as coreTestUtils } from '@balena/jellyfish-core';
import {
	testUtils as workerTestUtils,
	WorkerContext,
} from '@balena/jellyfish-worker';
import { isArray, isNull } from 'lodash';
import { actionLibrary } from '../../../lib';
import { actionIncrement } from '../../../lib/actions/action-increment';

const handler = actionIncrement.handler;
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

describe('action-increment', () => {
	test('should throw an error on invalid type', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.adminUserId,
			ctx.session,
			coreTestUtils.generateRandomSlug(),
			{
				status: 'open',
			},
		);
		supportThread.type = 'foobar@1.0.0';

		expect.assertions(1);
		try {
			await handler(ctx.session, actionContext, supportThread, {
				context: {
					id: `TEST-${coreTestUtils.generateRandomId()}`,
				},
				timestamp: new Date().toISOString(),
				actor: ctx.adminUserId,
				originator: coreTestUtils.generateRandomId(),
				arguments: {},
			} as any);
		} catch (error: any) {
			expect(error.message).toEqual(`No such type: ${supportThread.type}`);
		}
	});

	test('should increment specified path if number', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.adminUserId,
			ctx.session,
			coreTestUtils.generateRandomSlug(),
			{
				status: 'open',
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
				path: ['data', 'count'],
			},
		};

		expect.assertions(3);
		const result = await handler(
			ctx.session,
			actionContext,
			supportThread,
			request,
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(supportThread.id);
		}

		let updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data.count).toEqual(1);

		await handler(ctx.session, actionContext, updated, request);
		updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data.count).toEqual(2);
	});

	test('should increment specified path if string', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.adminUserId,
			ctx.session,
			coreTestUtils.generateRandomSlug(),
			{
				status: 'open',
				count: 'foobar',
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
				path: ['data', 'count'],
			},
		};

		expect.assertions(3);
		const result = await handler(
			ctx.session,
			actionContext,
			supportThread,
			request,
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(supportThread.id);
		}

		let updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data.count).toEqual(1);

		await handler(ctx.session, actionContext, updated, request);
		updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data.count).toEqual(2);
	});
});
