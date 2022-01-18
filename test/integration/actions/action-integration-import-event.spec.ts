import { testUtils as coreTestUtils } from '@balena/jellyfish-core';
import { defaultEnvironment } from '@balena/jellyfish-environment';
import {
	testUtils as workerTestUtils,
	WorkerContext,
} from '@balena/jellyfish-worker';
import { isArray } from 'lodash';
import sinon from 'sinon';
import { actionLibrary } from '../../../lib';
import { actionIntegrationImportEvent } from '../../../lib/actions/action-integration-import-event';
import { makeHandlerRequest } from './helpers';
import { foobarPlugin } from './plugin';

const source = 'foobar';
let supportThread: any;

const handler = actionIntegrationImportEvent.handler;
let ctx: workerTestUtils.TestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await workerTestUtils.newContext({
		plugins: [actionLibrary, foobarPlugin],
	});
	actionContext = ctx.worker.getActionContext({
		id: `test-${coreTestUtils.generateRandomId()}`,
	});

	supportThread = await ctx.createSupportThread(
		ctx.adminUserId,
		ctx.session,
		coreTestUtils.generateRandomSlug(),
		{
			status: 'open',
			source,
		},
	);
});

afterAll(async () => {
	return workerTestUtils.destroyContext(ctx);
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
			makeHandlerRequest(ctx, actionIntegrationImportEvent.contract),
		);
		expect(isArray(result)).toBe(true);
		if (isArray(result)) {
			expect(Object.keys(result[0])).toEqual(['id', 'type', 'version', 'slug']);
		}
	});
});
