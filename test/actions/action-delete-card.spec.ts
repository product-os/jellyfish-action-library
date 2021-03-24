/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import {
	makeContext,
	makeMessage,
	makeRequest,
	session,
	types,
} from './helpers';
import { actionDeleteCard } from '../../lib/actions/action-delete-card';

const handler = actionDeleteCard.handler;

describe('handler()', () => {
	test('should return card if already not active', async () => {
		const message = makeMessage({
			actor: session.data.actor,
		});
		message.active = false;
		const context = makeContext([session]);

		const result = await handler(session.id, context, message, makeRequest());
		expect(result).toEqual({
			id: message.id,
			type: message.type,
			version: message.version,
			slug: message.slug,
		});
	});

	test('should throw an error on invalid type', async () => {
		const message = makeMessage({
			actor: session.data.actor,
		});
		const context = makeContext([session]);

		expect.assertions(1);
		try {
			await handler(session.id, context, message, makeRequest());
		} catch (error) {
			expect(error.message).toEqual(`No such type: ${message.type}`);
		}
	});

	test('should soft delete an active card', async () => {
		const message = makeMessage({
			actor: session.data.actor,
		});
		const context = makeContext([types.message, message]);

		const result = await handler(session.id, context, message, makeRequest());
		expect(result).toEqual({
			id: message.id,
			type: message.type,
			version: message.version,
			slug: message.slug,
		});

		const updated = await context.getCardById(session.id, message.id);
		expect(updated.active).toBe(false);
	});
});
