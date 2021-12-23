import { defaultEnvironment } from '@balena/jellyfish-environment';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import type { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { isEmpty, isString } from 'lodash';
import nock from 'nock';
import sinon from 'sinon';
import * as integration from './integrations/foobar';
import { FoobarPlugin } from './plugin';
import { ActionLibrary } from '../../../lib';
import { actionOAuthAuthorize } from '../../../lib/actions/action-oauth-authorize';

const handler = actionOAuthAuthorize.handler;
let ctx: integrationHelpers.IntegrationTestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await integrationHelpers.before({
		plugins: [DefaultPlugin, ActionLibrary, ProductOsPlugin, FoobarPlugin],
	});
	actionContext = ctx.worker.getActionContext({
		id: `test-${ctx.generateRandomID()}`,
	});
});

afterAll(async () => {
	return integrationHelpers.after(ctx);
});

beforeEach(() => {
	sinon.restore();
});

afterEach(() => {
	nock.cleanAll();
});

describe('action-oauth-authorize', () => {
	test('should return token string', async () => {
		nock(integration['OAUTH_BASE_URL'])
			.post('/oauth/token')
			.reply(200, ctx.generateRandomID());

		sinon.stub(defaultEnvironment, 'getIntegration').callsFake(() => {
			return {
				appId: 'foo',
				appSecret: 'bar',
			};
		});

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

		const result = await handler(ctx.session, actionContext, user, {
			context: {
				id: `TEST-${ctx.generateRandomID()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.actor.id,
			originator: ctx.generateRandomID(),
			arguments: {
				provider: integration['slug'],
				code: ctx.generateRandomID(),
				origin: 'http://localhost',
			},
		} as any);
		expect(isString(result)).toBe(true);
		expect(isEmpty(result)).toBe(false);
	});
});
