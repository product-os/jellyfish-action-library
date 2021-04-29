/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import cloneDeep from 'lodash/cloneDeep';
import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import { v4 as uuidv4 } from 'uuid';
import { actionBroadcast } from '../../../lib/actions/action-broadcast';
import {
	after,
	before,
	createThread,
	makeContext,
	makeMessage,
	makeRequest,
} from './helpers';

const handler = actionBroadcast.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('handler()', () => {
	test('should return a broadcast card on unmatched message', async () => {
		const message = await context.kernel.insertCard(
			context.context,
			context.session,
			makeMessage(context),
		);

		expect.assertions(1);
		const result = await handler(
			context.session,
			context,
			message,
			makeRequest(context, {
				message: uuidv4(),
			}),
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.slug).toMatch(/^broadcast-/);
		}
	});

	test('should return null on matched message', async () => {
		// Create a thread with a matching message already linked
		const { message, thread } = await createThread(context);

		// Execute action and check that no new message was broadcast
		const result = await handler(
			context.session,
			context,
			thread,
			makeRequest(context, {
				message: message.data.payload.message,
			}),
		);
		expect(result).toBeNull();
	});

	test('should throw an error on invalid session', async () => {
		const localContext = cloneDeep(context);
		localContext.session = uuidv4();
		localContext.privilegedSession = localContext.session;
		expect.assertions(1);
		try {
			await handler(
				localContext.session,
				localContext,
				makeMessage(localContext),
				makeRequest(localContext),
			);
		} catch (error) {
			expect(error.message).toEqual(
				`Invalid session: ${localContext.privilegedSession}`,
			);
		}
	});
});
