import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { strict as assert } from 'assert';
import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import * as semver from 'semver';
import ActionLibrary from '../../../lib';
import { actionMergeDraftVersion } from '../../../lib/actions/action-merge-draft-version';
import { makeRequest } from './helpers';

const handler = actionMergeDraftVersion.handler;
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

describe('action-merge-draft-version', () => {
	test('should merge draft version contract without an artifact', async () => {
		const targetContract = await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			ctx.worker.typeContracts['card@1.0.0'],
			{
				attachEvents: true,
				actor: ctx.actor.id,
			},
			{
				name: ctx.generateRandomWords(1),
				slug: ctx.generateRandomSlug({
					prefix: 'card',
				}),
				version: '1.0.2-beta1+rev02',
				data: {
					$transformer: {
						artifactReady: false,
					},
				},
			},
		);
		assert(targetContract);

		const result = await handler(
			ctx.session,
			actionContext,
			targetContract,
			makeRequest(ctx),
		);
		if (isNull(result) || isArray(result)) {
			expect(isNull(result) || isArray(result)).toBeFalsy();
			return;
		}
		expect(result.slug).toEqual(targetContract.slug);
		expect(result.type).toEqual(targetContract.type);
		expect(semver.prerelease(result.version)).toBeFalsy();

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			targetContract.id,
		);
		assert(updated);
		expect(updated.data).toEqual(targetContract.data);
	});

	test('should throw an error on invalid type', async () => {
		const targetContract = await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			ctx.worker.typeContracts['card@1.0.0'],
			{
				attachEvents: true,
				actor: ctx.actor.id,
			},
			{
				name: ctx.generateRandomWords(1),
				slug: ctx.generateRandomSlug({
					prefix: 'card',
				}),
				version: '1.0.2-beta1+rev02',
				data: {
					$transformer: {
						artifactReady: false,
					},
				},
			},
		);
		assert(targetContract);
		targetContract.type = 'foobar@1.0.0';

		await expect(
			handler(ctx.session, actionContext, targetContract, makeRequest(ctx)),
		).rejects.toThrow(new Error(`No such type: ${targetContract.type}`));
	});
});
