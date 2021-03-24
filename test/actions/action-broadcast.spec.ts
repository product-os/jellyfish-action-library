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
import { actionBroadcast } from '../../lib/actions/action-broadcast';

const handler = actionBroadcast.handler;

describe('handler()', () => {
	test('should return a broadcast card on unmatched message', async () => {
		const message = makeMessage({
			actor: session.data.actor,
			payload: {
				message: uuidv4(),
			},
		});

		expect.assertions(1);
		const result = await handler(
			session.id,
			makeContext([types.message, session, message]),
			message,
			makeRequest({
				message: uuidv4(),
			}),
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.slug).toMatch(/^broadcast-/);
		}
	});

	test('should return null on matched message', async () => {
		const request = makeRequest({
			message: uuidv4(),
		});
		const message = makeMessage({
			actor: session.data.actor,
			payload: {
				message: request.arguments.message,
			},
		});

		const result = await handler(
			session.id,
			makeContext([types.message, session, message]),
			message,
			request,
		);
		expect(result).toBeNull();
	});

	test('should throw an error on invalid session', async () => {
		expect.assertions(1);
		try {
			await handler('foobar', makeContext(), makeMessage(), makeRequest());
		} catch (error) {
			expect(error.message).toEqual('Privileged session is invalid');
		}
	});
});
