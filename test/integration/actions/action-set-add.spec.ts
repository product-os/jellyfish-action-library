import { strict as assert } from 'assert';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import type { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { isArray, isNull } from 'lodash';
import { ActionLibrary } from '../../../lib';
import { actionSetAdd } from '../../../lib/actions/action-set-add';

const handler = actionSetAdd.handler;
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

describe('action-set-add', () => {
	test('should add value to array when property path is an array', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
				tags: [],
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
				property: ['data', 'tags'],
				value: 'foo',
			},
		};

		expect.assertions(2);
		const result = await handler(
			ctx.session,
			actionContext,
			supportThread,
			request,
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(supportThread.id);
		}

		const updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data.tags).toEqual([request.arguments.value]);
	});

	test('should add an array of strings to an array', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
				tags: [],
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
				property: ['data', 'tags'],
				value: ['foo', 'bar'],
			},
		};

		expect.assertions(2);
		const result = await handler(
			ctx.session,
			actionContext,
			supportThread,
			request,
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(supportThread.id);
		}

		const updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data.tags).toEqual(request.arguments.value);
	});

	test('should add value to array when property path is a string', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
				tags: [],
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
				property: 'data.tags',
				value: 'foo',
			},
		};

		const result = await handler(
			ctx.session,
			actionContext,
			supportThread,
			request,
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.id).toEqual(supportThread.id);
		}

		const updated = await ctx.kernel.getCardById(
			ctx.logContext,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data.tags).toEqual([request.arguments.value]);
	});
});
