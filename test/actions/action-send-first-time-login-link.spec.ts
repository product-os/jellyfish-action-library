/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { defaultEnvironment } from '@balena/jellyfish-environment';
import nock from 'nock';
import {
	actor,
	makeContext,
	makeFirstTimeLogin,
	makeOrg,
	makeRequest,
	makeUser,
	session,
	types,
} from './helpers';
import { actionSendFirstTimeLoginLink } from '../../lib/actions/action-send-first-time-login-link';

const handler = actionSendFirstTimeLoginLink.handler;

describe('handler()', () => {
	test('should throw an error on invalid type', async () => {
		const firstTimeLogin = makeFirstTimeLogin();
		const context = makeContext([firstTimeLogin]);

		expect.assertions(1);
		try {
			await handler(session.id, context, makeUser(), makeRequest());
		} catch (error) {
			expect(error.message).toEqual(
				`No such type: ${firstTimeLogin.type.split('@')[0]}`,
			);
		}
	});

	test('should throw an error if the user does not have an email address', async () => {
		const firstTimeLogin = makeFirstTimeLogin();
		const context = makeContext([firstTimeLogin, types['first-time-login']]);
		const request = makeRequest();

		expect.assertions(2);
		const user = makeUser();
		try {
			await handler(session.id, context, user, request);
		} catch (error) {
			expect(error.message).toEqual(
				`User with slug ${user.slug} does not have an email address`,
			);
		}

		try {
			user.data.email = [];
			await handler(session.id, context, user, request);
		} catch (error) {
			expect(error.message).toEqual(
				`User with slug ${user.slug} does not have an email address`,
			);
		}
	});

	test('should throw an error if the user is not active', async () => {
		const user = makeUser();
		user.active = false;
		const firstTimeLogin = makeFirstTimeLogin();
		const context = makeContext([firstTimeLogin, types['first-time-login']]);

		expect.assertions(1);
		try {
			await handler(session.id, context, user, makeRequest());
		} catch (error) {
			expect(error.message).toEqual(
				`User with slug ${user.slug} is not active`,
			);
		}
	});

	test('should throw an error if the requesting actor does not belong to any orgs', async () => {
		const user = makeUser({
			email: 'user@foo.bar',
		});
		const firstTimeLogin = makeFirstTimeLogin();
		const context = makeContext([
			actor,
			firstTimeLogin,
			types['first-time-login'],
		]);

		expect.assertions(1);
		try {
			await handler(session.id, context, user, makeRequest());
		} catch (error) {
			expect(error.message).toEqual(
				'You do not belong to an organisation and thus cannot send a first-time login link to any users',
			);
		}
	});

	test('should send first time login link on valid request', async () => {
		const org = makeOrg();
		const user = makeUser({
			email: 'user@foo.bar',
			roles: [],
		});
		const firstTimeLogin = makeFirstTimeLogin();
		const context = makeContext([
			actor,
			firstTimeLogin,
			org,
			user,
			types['first-time-login'],
		]);

		expect.assertions(2);
		if (defaultEnvironment.mail.options) {
			nock(defaultEnvironment.mail.options.baseUrl)
				.intercept(
					`/${defaultEnvironment.mail.options.domain}/messages`,
					'POST',
				)
				.reply(200, 'OK');

			const result = await handler(session.id, context, user, makeRequest());
			expect(result).toEqual({
				id: user.id,
				type: user.type,
				version: user.version,
				slug: user.slug,
			});

			// Also check that the 'user-community' role was added to the user.
			const updated = await context.getCardById(session.id, user.id);
			expect(updated.data.roles).toContain('user-community');
		}
	});
});
