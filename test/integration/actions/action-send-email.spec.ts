import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import type { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { get } from 'lodash';
import { makeRequest } from './helpers';
import { ActionLibrary } from '../../../lib';
import { actionSendEmail } from '../../../lib/actions/action-send-email';

const handler = actionSendEmail.handler;
let ctx: integrationHelpers.IntegrationTestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await integrationHelpers.before({
		plugins: [DefaultPlugin, ActionLibrary, ProductOsPlugin],
	});
	actionContext = ctx.worker.getActionContext({
		id: `test-${ctx.generateRandomID()}`,
	});
});

afterAll(async () => {
	return integrationHelpers.after(ctx);
});

describe('action-send-email', () => {
	test('should send an email', async () => {
		const result = await handler(
			ctx.session,
			actionContext,
			{} as any,
			makeRequest(ctx, {
				toAddress: 'test1@balenateam.m8r.co',
				fromAddress: 'hello@balena.io',
				subject: 'sending real email',
				html: 'with real text in the body',
			}),
		);
		expect(get(result, ['data', 'message'])).toEqual('Queued. Thank you.');
	});

	test('should throw an error when the email is invalid', async () => {
		expect.hasAssertions();

		try {
			await handler(
				ctx.session,
				actionContext,
				{} as any,
				makeRequest(ctx, {
					toAddress: 'foobar',
					fromAddress: 'hello@balena.io',
					subject: 'sending real email',
					html: 'with real text in the body',
				}),
			);
		} catch (error) {
			expect(get(error, ['response', 'status'])).toEqual(400);
		}
	});
});
