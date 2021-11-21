import { defaultEnvironment } from '@balena/jellyfish-environment';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { WorkerContext } from '@balena/jellyfish-types/build/worker';
import isArray from 'lodash/isArray';
import sinon from 'sinon';
import ActionLibrary from '../../../lib';
import { actionIntegrationImportEvent } from '../../../lib/actions/action-integration-import-event';
import { makeRequest } from './helpers';
import { FoobarPlugin } from './plugin';

const source = 'foobar';
let supportThread: any;

const handler = actionIntegrationImportEvent.handler;
let ctx: integrationHelpers.IntegrationTestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await integrationHelpers.before([
		DefaultPlugin,
		ActionLibrary,
		ProductOsPlugin,
		FoobarPlugin,
	]);
	actionContext = ctx.worker.getActionContext({
		id: `test-${ctx.generateRandomID()}`,
	});

	supportThread = await ctx.createSupportThread(
		ctx.actor.id,
		ctx.session,
		ctx.generateRandomWords(3),
		{
			status: 'open',
			source,
		},
	);
});

afterAll(async () => {
	return integrationHelpers.after(ctx);
});

beforeEach(() => {
	sinon.restore();
});

describe('action-integration-import-event', () => {
	test('should return a list of cards', async () => {
		sinon.stub(defaultEnvironment, 'getIntegration').callsFake(() => {
			return {};
		});

		const result = await handler(
			ctx.session,
			actionContext,
			supportThread,
			makeRequest(ctx),
		);
		expect(isArray(result)).toBe(true);
		if (isArray(result)) {
			expect(Object.keys(result[0])).toEqual(['id', 'type', 'version', 'slug']);
		}
	});
});
