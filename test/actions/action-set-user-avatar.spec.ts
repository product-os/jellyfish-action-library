/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import md5 from 'blueimp-md5';
import nock from 'nock';
import { v4 as uuidv4 } from 'uuid';
import { makeContext, makeRequest, makeUser, session, types } from './helpers';
import { actionSetUserAvatar } from '../../lib/actions/action-set-user-avatar';

const handler = actionSetUserAvatar.handler;

describe('handler()', () => {
	test('should not set avatar if user has no email', async () => {
		const user = makeUser();
		const context = makeContext([user]);

		const result = await handler(session.id, context, user, makeRequest());
		if (!isNull(result) && !isArray(result)) {
			expect(result).toEqual({
				id: user.id,
				slug: user.slug,
				version: user.version,
				type: user.type,
			});
		}

		const updated = await context.getCardById(session.id, user.id);
		expect(updated.data.avatar).toBeUndefined();
	});

	test('should not update avatar if already set', async () => {
		const user = makeUser({
			avatar: uuidv4(),
		});
		const context = makeContext([user]);

		const result = await handler(session.id, context, user, makeRequest());
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await context.getCardById(session.id, user.id);
		expect(updated.data.avatar).toEqual(user.data.avatar);
	});

	test('should not set avatar on invalid gravatar URL', async () => {
		const user = makeUser({
			email: uuidv4(),
		});
		const context = makeContext([types.user, user]);

		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email.trim())}?d=404`, 'HEAD')
			.reply(404, '');

		const result = await handler(session.id, context, user, makeRequest());
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await context.getCardById(session.id, user.id);
		expect(updated.data.avatar).toBeNull();
	});

	test('should set avatar on valid gravatar URL', async () => {
		const user = makeUser({
			email: uuidv4(),
		});
		const context = makeContext([types.user, user]);
		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email.trim())}?d=404`, 'HEAD')
			.reply(200, 'OK');

		const result = await handler(session.id, context, user, makeRequest());
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await context.getCardById(session.id, user.id);
		expect(updated.data.avatar).toEqual(
			`https://www.gravatar.com/avatar/${md5(user.data.email.trim())}?d=404`,
		);
	});

	test('should error out on invalid type', async () => {
		const user = makeUser({
			email: uuidv4(),
		});
		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email.trim())}?d=404`, 'HEAD')
			.reply(200, 'OK');

		expect.assertions(1);
		try {
			await handler(session.id, makeContext([user]), user, makeRequest());
		} catch (error) {
			expect(error.message).toEqual(`No such type: ${types.user.slug}`);
		}
	});
});
