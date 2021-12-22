import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { isArray, isNull } from 'lodash';
import * as integration from './integrations/foobar';
import { FoobarPlugin } from './plugin';
import ActionLibrary from '../../../lib';
import { actionOAuthAssociate } from '../../../lib/actions/action-oauth-associate';

const handler = actionOAuthAssociate.handler;
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
});

afterAll(async () => {
	return integrationHelpers.after(ctx);
});

describe('action-oauth-associate', () => {
	test('should return single user card', async () => {
		const user = await ctx.createContract(
			ctx.actor.id,
			ctx.session,
			'user@1.0.0',
			ctx.generateRandomWords(1),
			{
				hash: ctx.generateRandomID(),
				roles: [],
			},
		);

		const result: any = await handler(ctx.session, actionContext, user, {
			context: {
				id: `TEST-${ctx.generateRandomID()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.actor.id,
			originator: ctx.generateRandomID(),
			arguments: {
				provider: integration['slug'],
			},
		} as any);
		expect(isNull(result)).toBe(false);
		expect(isArray(result)).toBe(false);
		expect(result.type).toEqual('user@1.0.0');
	});
});
