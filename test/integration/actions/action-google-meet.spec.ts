import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import type { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { google } from 'googleapis';
import sinon from 'sinon';
import { makeRequest } from './helpers';
import { ActionLibrary } from '../../../lib';
import { actionGoogleMeet } from '../../../lib/actions/action-google-meet';

const handler = actionGoogleMeet.handler;
const conferenceUrl = 'http://foo.bar';
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

beforeEach(() => {
	sinon.restore();
});

/**
 * @summary Stub Google API
 * @function
 *
 * @param data - data to return from Google client request
 */
function stub(data: any): void {
	sinon.stub(google.auth, 'GoogleAuth').callsFake(() => {
		return {
			getClient: () => {
				return {
					request: () => {
						return {
							data,
						};
					},
				};
			},
		};
	});
}

describe('action-google-meet', () => {
	test('should throw on missing hangout link', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);

		stub({
			id: ctx.generateRandomID(),
		});

		const message = await ctx.createMessage(
			ctx.actor.id,
			ctx.session,
			supportThread,
			ctx.generateRandomWords(1),
		);
		await expect(
			handler(ctx.session, actionContext, message, makeRequest(ctx)),
		).rejects.toThrow(
			new Error("Meet/Hangout Link not found in the event's body"),
		);
	});

	test('should throw on invalid type', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);

		stub({
			hangoutLink: conferenceUrl,
			id: ctx.generateRandomID(),
		});

		const message = await ctx.createMessage(
			ctx.actor.id,
			ctx.session,
			supportThread,
			ctx.generateRandomWords(1),
		);
		message.type = 'foobar';
		await expect(
			handler(ctx.session, actionContext, message, makeRequest(ctx)),
		).rejects.toThrow(new Error(`No such type: ${message.type}`));
	});

	test('should return a conference URL', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);

		const result = await ctx.processAction(ctx.session, {
			action: 'action-google-meet@1.0.0',
			logContext: ctx.logContext,
			card: supportThread.id,
			type: supportThread.type,
			arguments: {},
		});

		expect(
			result.data.conferenceUrl.startsWith('https://meet.google.com'),
		).toBe(true);
	});

	test('should update the card with the conference URL', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.actor.id,
			ctx.session,
			ctx.generateRandomWords(3),
			{
				status: 'open',
			},
		);

		await ctx.processAction(ctx.session, {
			action: 'action-google-meet@1.0.0',
			logContext: ctx.logContext,
			card: supportThread.id,
			type: supportThread.type,
			arguments: {},
		});

		const [updatedCard] = await ctx.kernel.query(ctx.logContext, ctx.session, {
			type: 'object',
			required: ['id', 'type'],
			additionalProperties: true,
			properties: {
				type: {
					type: 'string',
					const: supportThread.type,
				},
				id: {
					type: 'string',
					const: supportThread.id,
				},
			},
		});

		expect(
			(updatedCard.data as any).conferenceUrl.startsWith(
				'https://meet.google.com',
			),
		).toBe(true);
	});
});
