import { defaultEnvironment } from '@balena/jellyfish-environment';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { isArray, isEmpty } from 'lodash';
import sinon from 'sinon';
import { makeRequest } from './helpers';
import { FoobarPlugin } from './plugin';
import ActionLibrary from '../../../lib';
import { mirror } from '../../../lib/actions/mirror';

const source = 'foobar';
let supportThread: any;

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
		},
	);
});

afterAll(async () => {
	return integrationHelpers.after(ctx);
});

beforeEach(() => {
	sinon.restore();
});

describe('mirror()', () => {
	test('should not sync back changes that came from external event', async () => {
		const externalEvent = await ctx.createContract(
			ctx.actor.id,
			ctx.session,
			'external-event@1.0.0',
			ctx.generateRandomWords(3),
			{
				source,
				headers: {
					foo: ctx.generateRandomID(),
				},
				payload: {
					bar: ctx.generateRandomID(),
				},
				data: {
					baz: ctx.generateRandomID(),
				},
			},
		);
		const request = makeRequest(ctx);
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
			makeRequest(ctx),
		);
		expect(isArray(result)).toBe(true);
		if (isArray(result)) {
			expect(Object.keys(result[0])).toEqual(['id', 'type', 'version', 'slug']);
		}
	});
});
