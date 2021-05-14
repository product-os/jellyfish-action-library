/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { actionPing } from '../../../lib/actions/action-ping';
import { after, before, makeContext, makePing, makeRequest } from './helpers';

const handler = actionPing.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('action-ping', () => {
	test('should update specified card', async () => {
		const ping = await context.kernel.insertCard(
			context.context,
			context.session,
			makePing(),
		);
		const request = makeRequest(context, {
			slug: ping.slug,
		});

		// Execute handler and check results
		const result = await handler(
			context.session,
			context,
			context.cards.ping,
			request,
		);
		expect(result).toEqual({
			id: ping.id,
			type: ping.type,
			version: ping.version,
			slug: ping.slug,
		});

		// Check timestamp of updated contract
		const updated = await context.getCardById(context.session, ping.id);
		expect(updated.data.timestamp).toEqual(request.timestamp);
	});
});
