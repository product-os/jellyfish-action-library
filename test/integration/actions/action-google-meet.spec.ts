import { testUtils as coreTestUtils } from '@balena/jellyfish-core';
import {
	testUtils as workerTestUtils,
	WorkerContext,
} from '@balena/jellyfish-worker';
import { google } from 'googleapis';
import sinon from 'sinon';
import { actionLibrary } from '../../../lib';
import { actionGoogleMeet } from '../../../lib/actions/action-google-meet';
import { makeHandlerRequest } from './helpers';

const handler = actionGoogleMeet.handler;
const conferenceUrl = 'http://foo.bar';
let ctx: workerTestUtils.TestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await workerTestUtils.newContext({
		plugins: [actionLibrary],
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
			ctx.adminUserId,
			ctx.session,
			coreTestUtils.generateRandomSlug(),
			{
				status: 'open',
			},
		);

		stub({
			id: coreTestUtils.generateRandomId(),
		});

		const message = await ctx.createMessage(
			ctx.adminUserId,
			ctx.session,
			supportThread,
			coreTestUtils.generateRandomSlug(),
		);
		await expect(
			handler(
				ctx.session,
				actionContext,
				message,
				makeHandlerRequest(ctx, actionGoogleMeet.contract),
			),
		).rejects.toThrow(
			new Error("Meet/Hangout Link not found in the event's body"),
		);
	});

	test('should throw on invalid type', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.adminUserId,
			ctx.session,
			coreTestUtils.generateRandomSlug(),
			{
				status: 'open',
			},
		);

		stub({
			hangoutLink: conferenceUrl,
			id: coreTestUtils.generateRandomId(),
		});

		const message = await ctx.createMessage(
			ctx.adminUserId,
			ctx.session,
			supportThread,
			coreTestUtils.generateRandomSlug(),
		);
		message.type = 'foobar';
		await expect(
			handler(
				ctx.session,
				actionContext,
				message,
				makeHandlerRequest(ctx, actionGoogleMeet.contract),
			),
		).rejects.toThrow(new Error(`No such type: ${message.type}`));
	});

	test('should return a conference URL', async () => {
		const supportThread = await ctx.createSupportThread(
			ctx.adminUserId,
			ctx.session,
			coreTestUtils.generateRandomSlug(),
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
			ctx.adminUserId,
			ctx.session,
			coreTestUtils.generateRandomSlug(),
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
