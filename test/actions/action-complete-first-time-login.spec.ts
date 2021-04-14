/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { v4 as uuidv4 } from 'uuid';
import {
	makeContext,
	makeFirstTimeLogin,
	makeRequest,
	makeUser,
	session,
	types,
} from './helpers';
import { PASSWORDLESS_USER_HASH } from '../../lib/actions/constants';
import { actionCompleteFirstTimeLogin } from '../../lib/actions/action-complete-first-time-login';

const handler = actionCompleteFirstTimeLogin.handler;

describe('handler()', () => {
	test('should throw on invalid reset token', async () => {
		expect.assertions(1);
		try {
			await handler(session.id, makeContext(), makeUser(), makeRequest());
		} catch (error) {
			expect(error.message).toEqual('First-time login token invalid');
		}
	});

	test('should throw an error when user already has a password', async () => {
		const user = makeUser({
			hash: uuidv4(),
		});
		const firstTimeLogin = makeFirstTimeLogin();
		firstTimeLogin.links['is attached to'] = [user];
		const context = makeContext([firstTimeLogin, user, types.user]);

		expect.assertions(1);
		try {
			await handler(session.id, context, user, makeRequest());
		} catch (error) {
			expect(error.message).toEqual('User already has a password set');
		}
	});

	test('handler() should update password on valid first time login token', async () => {
		const user = makeUser({
			hash: PASSWORDLESS_USER_HASH,
		});
		const firstTimeLogin = makeFirstTimeLogin();
		firstTimeLogin.links['is attached to'] = [user];
		const context = makeContext([firstTimeLogin, user, types.user]);
		const request = makeRequest({
			newPassword: uuidv4(),
		});

		const result = await handler(session.id, context, makeUser(), request);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			type: user.type,
			version: user.version,
			active: user.active,
			links: user.links,
			markers: user.markers,
			requires: user.requires,
			tags: user.tags,
			capabilities: user.capabilities,
			created_at: user.created_at,
			data: {
				hash: request.arguments.newPassword,
			},
		});
	});
});
