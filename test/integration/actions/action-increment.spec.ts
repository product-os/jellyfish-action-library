import { strict as assert } from 'assert';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { isArray, isNull } from 'lodash';
import ActionLibrary from '../../../lib';
import { actionIncrement } from '../../../lib/actions/action-increment';

const handler = actionIncrement.handler;
let ctx: integrationHelpers.IntegrationTestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await integrationHelpers.before([
		DefaultPlugin,
		ActionLibrary,
		ProductOsPlugin,
	]);
	actionContext = ctx.worker.getActionContext({
		id: `test-${ctx.generateRandomID()}`,
	});
});

afterAll(async () => {
	return integrationHelpers.after(ctx);
});

describe('action-increment', () => {
	test('should throw an error on invalid type', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);
		supportThread.type = 'foobar@1.0.0';

		expect.assertions(1);
		try {
			await handler(ctx.session, actionContext, supportThread, {
				context: {
					id: `TEST-${ctx.generateRandomID()}`,
				},
				timestamp: new Date().toISOString(),
				actor: ctx.actor.id,
				originator: ctx.generateRandomID(),
				arguments: {},
			} as any);
		} catch (error: any) {
			expect(error.message).toEqual(`No such type: ${supportThread.type}`);
		}
	});

	test('should increment specified path if number', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
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

		let updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data.count).toEqual(1);

		await handler(ctx.session, actionContext, updated, request);
		updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data.count).toEqual(2);
	});

	test('should increment specified path if string', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
				count: 'foobar',
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

		let updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data.count).toEqual(1);

		await handler(ctx.session, actionContext, updated, request);
		updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data.count).toEqual(2);
	});
});
