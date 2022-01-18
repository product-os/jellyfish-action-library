import { testUtils as coreTestUtils } from '@balena/jellyfish-core';
import {
	testUtils as workerTestUtils,
	WorkerContext,
} from '@balena/jellyfish-worker';
import { isArray, isNull } from 'lodash';
import { actionLibrary } from '../../../lib';
import { actionOAuthAssociate } from '../../../lib/actions/action-oauth-associate';
import * as integration from './integrations/foobar';
import { foobarPlugin } from './plugin';

const handler = actionOAuthAssociate.handler;
let ctx: workerTestUtils.TestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await workerTestUtils.newContext({
		plugins: [actionLibrary, foobarPlugin],
	});
	actionContext = ctx.worker.getActionContext({
		id: `test-${coreTestUtils.generateRandomId()}`,
	});
});

afterAll(async () => {
	return workerTestUtils.destroyContext(ctx);
});

describe('action-oauth-associate', () => {
	test('should return single user card', async () => {
		const user = await ctx.createContract(
			ctx.adminUserId,
			ctx.session,
			'user@1.0.0',
			coreTestUtils.generateRandomSlug(),
			{
				hash: coreTestUtils.generateRandomId(),
				roles: [],
			},
		);

		const result: any = await handler(ctx.session, actionContext, user, {
			context: {
				id: `TEST-${coreTestUtils.generateRandomId()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.adminUserId,
			originator: coreTestUtils.generateRandomId(),
			arguments: {
				provider: integration['slug'],
			},
		} as any);
		expect(isNull(result)).toBe(false);
		expect(isArray(result)).toBe(false);
		expect(result.type).toEqual('user@1.0.0');
	});
});
