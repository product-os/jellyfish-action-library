import { testUtils as coreTestUtils } from '@balena/jellyfish-core';
import { defaultEnvironment } from '@balena/jellyfish-environment';
import {
	testUtils as workerTestUtils,
	WorkerContext,
} from '@balena/jellyfish-worker';
import { isArray, isEmpty } from 'lodash';
import sinon from 'sinon';
import { actionLibrary } from '../../../lib';
import { mirror } from '../../../lib/actions/mirror';
import { makeHandlerRequest } from './helpers';
import { foobarPlugin } from './plugin';

const source = 'foobar';
let supportThread: any;

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
		},
	);
});

afterAll(async () => {
	return workerTestUtils.destroyContext(ctx);
});

beforeEach(() => {
	sinon.restore();
});

describe('mirror()', () => {
	test('should not sync back changes that came from external event', async () => {
		const externalEvent = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'external-event@1.0.0',
			coreTestUtils.generateRandomSlug(),
			{
				source,
				headers: {
					foo: coreTestUtils.generateRandomId(),
				},
				payload: {
					bar: coreTestUtils.generateRandomId(),
				},
				data: {
					baz: coreTestUtils.generateRandomId(),
				},
			},
		);
		const request = makeHandlerRequest(ctx);
		request.originator = externalEvent.id;

		const result = await mirror(
			source,
			ctx.session,
			actionContext,
			supportThread,
			request,
		);
		expect(isArray(result)).toBe(true);
		expect(isEmpty(result)).toBe(true);
	});

	test('should return a list of cards', async () => {
		sinon.stub(defaultEnvironment, 'getIntegration').callsFake(() => {
			return {};
		});

		const result = await mirror(
			source,
			ctx.session,
			actionContext,
			supportThread,
			makeHandlerRequest(ctx),
		);
		expect(isArray(result)).toBe(true);
		if (isArray(result)) {
			expect(Object.keys(result[0])).toEqual(['id', 'type', 'version', 'slug']);
		}
	});
});
