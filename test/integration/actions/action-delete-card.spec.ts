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
import ActionLibrary from '../../../lib';
import { actionDeleteCard } from '../../../lib/actions/action-delete-card';
import { makeRequest } from './helpers';

const handler = actionDeleteCard.handler;
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

describe('action-delete-card', () => {
	test('should return card if already not active', async () => {
		const supportThread = await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			ctx.worker.typeContracts['support-thread@1.0.0'],
			{
				attachEvents: true,
				actor: ctx.actor.id,
			},
			{
				name: ctx.generateRandomWords(3),
				slug: ctx.generateRandomSlug({
					prefix: 'support-thread',
				}),
				active: false,
				version: '1.0.0',
				data: {
					status: 'open',
				},
			},
		);
		assert(supportThread);

		const result = await handler(
			ctx.session,
			actionContext,
			supportThread,
			makeRequest(ctx),
		);
		expect(result).toEqual({
			id: supportThread.id,
			type: supportThread.type,
			version: supportThread.version,
			slug: supportThread.slug,
		});
	});

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
			await handler(
				ctx.session,
				actionContext,
				supportThread,
				makeRequest(ctx),
			);
		} catch (error: any) {
			expect(error.message).toEqual(`No such type: ${supportThread.type}`);
		}
	});

	test('should delete a card', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-delete-card@1.0.0',
				context: ctx.context,
				card: supportThread.id,
				type: supportThread.type,
				arguments: {},
			},
		);
		await ctx.flushAll(ctx.session);
		const result = await ctx.queue.producer.waitResults(ctx.context, request);
		expect(result.error).toBe(false);

		const card = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			supportThread.id,
		);
		assert(card);
		expect(card.active).toBe(false);
	});
});
