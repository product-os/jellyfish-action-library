/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { defaultEnvironment } from '@balena/jellyfish-environment';
import nock from 'nock';
import { actionSendFirstTimeLoginLink } from '../../../lib/actions/action-send-first-time-login-link';
import {
	after,
	before,
	makeContext,
	makeFirstTimeLogin,
	makeOrg,
	makeRequest,
	makeUser,
} from './helpers';

const handler = actionSendFirstTimeLoginLink.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('handler()', () => {
	test('should throw an error if the user does not have an email address', async () => {
		await context.kernel.insertCard(
			context.context,
			context.session,
			makeFirstTimeLogin(),
		);
		const request = makeRequest(context);

		expect.assertions(2);
		const user = makeUser();
		try {
			await handler(context.session, context, user, request);
		} catch (error) {
			expect(error.message).toEqual(
				`User with slug ${user.slug} does not have an email address`,
			);
		}

		try {
			user.data.email = [];
			await handler(context.session, context, user, request);
		} catch (error) {
			expect(error.message).toEqual(
				`User with slug ${user.slug} does not have an email address`,
			);
		}
	});

	test('should throw an error if the user is not active', async () => {
		const user = makeUser();
		user.active = false;
		await context.kernel.insertCard(
			context.context,
			context.session,
			makeFirstTimeLogin(),
		);

		expect.assertions(1);
		try {
			await handler(context.session, context, user, makeRequest(context));
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
		context.kernel.insertCard(
			context.context,
			context.session,
			makeFirstTimeLogin(),
		);

		expect.assertions(1);
		try {
			await handler(context.session, context, user, makeRequest(context));
		} catch (error) {
			expect(error.message).toEqual(
				'You do not belong to an organisation and thus cannot send a first-time login link to any users',
			);
		}
	});

	test('should send first time login link on valid request', async () => {
		const org = await context.kernel.insertCard(
			context.context,
			context.session,
			makeOrg(),
		);
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				email: 'user@foo.bar',
				roles: [],
			}),
		);
		await context.kernel.insertCard(context.context, context.session, {
			slug: `link-${org.slug}-has-member-${user.slug}`,
			type: 'link@1.0.0',
			name: 'has member',
			data: {
				inverseName: 'is member of',
				from: {
					id: org.id,
					type: org.type,
				},
				to: {
					id: user.id,
					type: user.type,
				},
			},
		});
		const request = makeRequest(context);
		request.actor = user.id;

		expect.assertions(2);
		if (defaultEnvironment.mail.options) {
			nock(defaultEnvironment.mail.options.baseUrl)
				.intercept(
					`/${defaultEnvironment.mail.options.domain}/messages`,
					'POST',
				)
				.reply(200, 'OK');

			const result = await handler(context.session, context, user, request);
			expect(result).toEqual({
				id: user.id,
				type: user.type,
				version: user.version,
				slug: user.slug,
			});

			// Also check that the 'user-community' role was added to the user.
			const updated = await context.getCardById(context.session, user.id);
			expect(updated.data.roles).toContain('user-community');
		}
	});
});
