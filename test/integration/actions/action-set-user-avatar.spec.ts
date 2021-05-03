/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import md5 from 'blueimp-md5';
import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import nock from 'nock';
import { v4 as uuidv4 } from 'uuid';
import { actionSetUserAvatar } from '../../../lib/actions/action-set-user-avatar';
import { after, before, makeContext, makeRequest, makeUser } from './helpers';

const handler = actionSetUserAvatar.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

afterEach(() => {
	nock.cleanAll();
});

/**
 * Generate random email address
 * @function
 *
 * @returns random email address
 */
function genEmail(): string {
	return `${uuidv4()}@foo.bar`;
}

describe('action-set-user-avatar', () => {
	test('should not set avatar if user has no email', async () => {
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser(),
		);

		const result = await handler(
			context.session,
			context,
			user,
			makeRequest(context),
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result).toEqual({
				id: user.id,
				slug: user.slug,
				version: user.version,
				type: user.type,
			});
		}

		const updated = await context.getCardById(context.session, user.id);
		expect(updated.data.avatar).toBeUndefined();
	});

	test('should not update avatar if already set', async () => {
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				avatar: uuidv4(),
			}),
		);

		const result = await handler(
			context.session,
			context,
			user,
			makeRequest(context),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await context.getCardById(context.session, user.id);
		expect(updated.data.avatar).toEqual(user.data.avatar);
	});

	test('should set avatar to null on invalid gravatar URL (single email)', async () => {
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				email: genEmail(),
			}),
		);

		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email.trim())}?d=404`, 'HEAD')
			.reply(404, '');

		const result = await handler(
			context.session,
			context,
			user,
			makeRequest(context),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await context.getCardById(context.session, user.id);
		expect(updated.data.avatar).toBeNull();
	});

	test('should set avatar to null on invalid gravatar URL (email array)', async () => {
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				email: [genEmail(), genEmail()],
			}),
		);

		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email[0].trim())}?d=404`, 'HEAD')
			.reply(404, '');
		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email[1].trim())}?d=404`, 'HEAD')
			.reply(404, '');

		const result = await handler(
			context.session,
			context,
			user,
			makeRequest(context),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await context.getCardById(context.session, user.id);
		expect(updated.data.avatar).toBeNull();
	});

	test('should set avatar on valid gravatar URL (single email)', async () => {
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				email: genEmail(),
			}),
		);
		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email.trim())}?d=404`, 'HEAD')
			.reply(200, 'OK');

		const result = await handler(
			context.session,
			context,
			user,
			makeRequest(context),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await context.getCardById(context.session, user.id);
		expect(updated.data.avatar).toEqual(
			`https://www.gravatar.com/avatar/${md5(user.data.email.trim())}?d=404`,
		);
	});

	test('should set avatar on valid gravatar URL (first email in array)', async () => {
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				email: [genEmail(), genEmail()],
			}),
		);
		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email[0].trim())}?d=404`, 'HEAD')
			.reply(200, 'OK');
		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email[1].trim())}?d=404`, 'HEAD')
			.reply(404, '');

		const result = await handler(
			context.session,
			context,
			user,
			makeRequest(context),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await context.getCardById(context.session, user.id);
		expect(updated.data.avatar).toEqual(
			`https://www.gravatar.com/avatar/${md5(user.data.email[0].trim())}?d=404`,
		);
	});

	test('should set avatar on valid gravatar URL (second email in array)', async () => {
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				email: [genEmail(), genEmail()],
			}),
		);
		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email[0].trim())}?d=404`, 'HEAD')
			.reply(404, '');
		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email[1].trim())}?d=404`, 'HEAD')
			.reply(200, 'OK');

		const result = await handler(
			context.session,
			context,
			user,
			makeRequest(context),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await context.getCardById(context.session, user.id);
		expect(updated.data.avatar).toEqual(
			`https://www.gravatar.com/avatar/${md5(user.data.email[1].trim())}?d=404`,
		);
	});

	test('should set avatar when current data.avatar is null', async () => {
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				email: genEmail(),
				avatar: null,
			}),
		);

		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email.trim())}?d=404`, 'HEAD')
			.reply(200, 'OK');

		const result = await handler(
			context.session,
			context,
			user,
			makeRequest(context),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await context.getCardById(context.session, user.id);
		expect(updated.data.avatar).toEqual(
			`https://www.gravatar.com/avatar/${md5(user.data.email.trim())}?d=404`,
		);
	});
});
