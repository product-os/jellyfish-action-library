/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { actionDeleteCard } from '../../../lib/actions/action-delete-card';
import {
	after,
	before,
	makeContext,
	makeMessage,
	makeRequest,
} from './helpers';

const handler = actionDeleteCard.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('handler()', () => {
	test('should return card if already not active', async () => {
		const message = makeMessage(context);
		message.active = false;
		const inserted = await context.kernel.insertCard(
			context.context,
			context.session,
			message,
		);

		const result = await handler(
			context.session,
			context,
			inserted,
			makeRequest(context),
		);
		expect(result).toEqual({
			id: message.id,
			type: message.type,
			version: message.version,
			slug: message.slug,
		});
	});

	test('should throw an error on invalid type', async () => {
		const message = makeMessage(context);
		message.type = 'foobar@1.0.0';

		expect.assertions(1);
		try {
			await handler(context.session, context, message, makeRequest(context));
		} catch (error) {
			expect(error.message).toEqual(`No such type: ${message.type}`);
		}
	});

	test('should soft delete an active card', async () => {
		const message = await context.kernel.insertCard(
			context.context,
			context.session,
			makeMessage(context),
		);

		const result = await handler(
			context.session,
			context,
			message,
			makeRequest(context),
		);
		expect(result).toEqual({
			id: message.id,
			type: message.type,
			version: message.version,
			slug: message.slug,
		});

		const updated = await context.getCardById(context.session, message.id);
		expect(updated.active).toBe(false);
	});
});
