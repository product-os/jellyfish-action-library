import { testUtils as coreTestUtils } from '@balena/jellyfish-core';
import { defaultEnvironment } from '@balena/jellyfish-environment';
import {
	testUtils as workerTestUtils,
	WorkerContext,
} from '@balena/jellyfish-worker';
import { isEmpty, isString } from 'lodash';
import nock from 'nock';
import sinon from 'sinon';
import { actionLibrary } from '../../../lib';
import { actionOAuthAuthorize } from '../../../lib/actions/action-oauth-authorize';
import * as integration from './integrations/foobar';
import { foobarPlugin } from './plugin';

const handler = actionOAuthAuthorize.handler;
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
			.reply(200, coreTestUtils.generateRandomId());

		sinon.stub(defaultEnvironment, 'getIntegration').callsFake(() => {
			return {
				appId: 'foo',
				appSecret: 'bar',
			};
		});

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

		const result = await handler(ctx.session, actionContext, user, {
			context: {
				id: `TEST-${coreTestUtils.generateRandomId()}`,
			},
			timestamp: new Date().toISOString(),
			actor: ctx.adminUserId,
			originator: coreTestUtils.generateRandomId(),
			arguments: {
				provider: integration['slug'],
				code: coreTestUtils.generateRandomId(),
				origin: 'http://localhost',
			},
		} as any);
		expect(isString(result)).toBe(true);
		expect(isEmpty(result)).toBe(false);
	});
});
