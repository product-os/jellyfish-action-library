/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import { v4 as uuidv4 } from 'uuid';
import {
	makeContext,
	makeMessage,
	makeRequest,
	session,
	types,
} from './helpers';
import { actionUpdateCard } from '../../lib/actions/action-update-card';

const handler = actionUpdateCard.handler;

describe('handler()', () => {
	test('should throw an error on invalid type', async () => {
		const message = makeMessage();

		expect.assertions(1);
		try {
			await handler(session.id, makeContext(), message, makeRequest());
		} catch (error) {
			expect(error.message).toEqual(`No such type: ${message.type}`);
		}
	});

	test('should patch card', async () => {
		const message = makeMessage({
			actor: session.data.actor,
			payload: {
				message: uuidv4(),
			},
		});
		const context = makeContext([types.message, message]);
		const request = makeRequest({
			patch: [
				{
					op: 'replace',
					path: '/data/payload/message',
					value: uuidv4(),
				},
			],
		});

		expect.assertions(2);
		const result = await handler(session.id, context, message, request);
		if (!isNull(result) && !isArray(result)) {
			expect(result).toEqual({
				id: message.id,
				type: message.type,
				version: message.version,
				slug: message.slug,
			});
		}

		const updated = await context.getCardById(session.id, message.id);
		expect(updated.data.payload.message).toEqual(
			request.arguments.patch[0].value,
		);
	});
});
