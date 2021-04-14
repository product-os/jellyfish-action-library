/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { makeContext, makeRequest, makeUser, session } from './helpers';
import { actionPing } from '../../lib/actions/action-ping';

const handler = actionPing.handler;

describe('handler()', () => {
	test('should update specified card', async () => {
		const user = makeUser();
		const context = makeContext([session, user]);
		const request = makeRequest({
			slug: user.slug,
		});

		const result = await handler(session.id, context, user, request);
		expect(result).toEqual({
			id: user.id,
			type: user.type,
			version: user.version,
			slug: user.slug,
		});

		const updated = await context.getCardById(session.id, user.id);
		expect(updated.data.timestamp).toEqual(request.timestamp);
	});
});
