/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import {
	makeContext,
	makePasswordReset,
	makeRequest,
	makeUser,
	session,
	types,
} from './helpers';
import { BCRYPT_SALT_ROUNDS } from '../../lib/actions/constants';
import { actionCompletePasswordReset } from '../../lib/actions/action-complete-password-reset';

const pre = actionCompletePasswordReset.pre;
const handler = actionCompletePasswordReset.handler;

describe('pre()', () => {
	test('should hash new password', async () => {
		const plaintext = uuidv4();
		const request = makeRequest({
			newPassword: plaintext,
		});

		expect.assertions(1);
		if (pre) {
			const result = await pre(session.id, makeContext(), request);
			if (!isNull(result) && !isArray(result)) {
				const match = await bcrypt.compare(plaintext, result.newPassword);
				expect(match).toBe(true);
			}
		}
	});

	test('should throw on invalid reset token', async () => {
		expect.assertions(1);
		try {
			await handler(session.id, makeContext(), makeUser(), makeRequest());
		} catch (error) {
			expect(error.message).toEqual('Reset token invalid');
		}
	});

	test('should update password on valid reset token', async () => {
		const user = makeUser({
			hash: await bcrypt.hash(uuidv4(), BCRYPT_SALT_ROUNDS),
		});
		const passwordReset = makePasswordReset();
		passwordReset.links['is attached to'] = [user];
		const context = makeContext([passwordReset, user, types.user]);
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
			capabilities: user.capabilities,
			created_at: user.created_at,
			markers: user.markers,
			requires: user.requires,
			tags: user.tags,
			data: {
				hash: request.arguments.newPassword,
			},
		});
	});
});
