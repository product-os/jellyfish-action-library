/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { strict as assert } from 'assert';
import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import ActionLibrary from '../../../lib';
import { actionSetUpdate } from '../../../lib/actions/action-set-update';

const handler = actionSetUpdate.handler;
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

describe('action-set-update', () => {
	test('should update array when property path is an array', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
				tags: ['foo'],
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
				value: ['bar'],
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

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data.tags).toEqual(request.arguments.value);
	});

	test('should update array when property path is a string', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
				tags: ['foo'],
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
				value: ['bar'],
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

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			supportThread.id,
		);
		assert(updated);
		expect(updated.data.tags).toEqual(request.arguments.value);
	});
});
