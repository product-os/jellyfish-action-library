/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import type { ActionFile } from '@balena/jellyfish-plugin-base';
import bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS, PASSWORDLESS_USER_HASH } from './constants';

const pre: ActionFile['pre'] = async (_session, _context, request) => {
	const password = request.arguments.password;

	if (!password) {
		return {
			...request.arguments,
			password: PASSWORDLESS_USER_HASH,
		};
	}

	// Convert the plaintext password into a hash so that we don't have
	// a plain password stored in the DB
	request.arguments.password = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

	return request.arguments;
};

const handler: ActionFile['handler'] = async (
	_session,
	context,
	card,
	request,
) => {
	try {
		const result = await context.insertCard(
			context.privilegedSession,
			card,
			{
				timestamp: request.timestamp,
				actor: request.actor,
				originator: request.originator,
				attachEvents: true,
			},
			{
				slug: request.arguments.username,
				version: '1.0.0',
				data: {
					email: request.arguments.email,
					roles: ['user-community'],
					hash: request.arguments.password,
				},
			},
		);

		if (!result) {
			return null;
		}

		return {
			id: result.id,
			type: result.type,
			version: result.version,
			slug: result.slug,
		};
	} catch (error) {
		if (
			error.name === 'JellyfishElementAlreadyExists' &&
			error.slug === request.arguments.username
		) {
			error.expected = true;
		}

		throw error;
	}
};

export const actionCreateUser: ActionFile = {
	pre,
	handler,
	card: {
		slug: 'action-create-user',
		type: 'action@1.0.0',
		name: 'Create a user',
		data: {
			filter: {
				type: 'object',
				properties: {
					slug: {
						type: 'string',
						const: 'user',
					},
					type: {
						type: 'string',
						const: 'type@1.0.0',
					},
				},
				required: ['slug', 'type'],
			},
			arguments: {
				username: {
					type: 'string',
					pattern: '^user-[a-zA-Z0-9-]{4,}$',
				},
				email: {
					type: 'string',
					format: 'email',
				},
				password: {
					type: 'string',
				},
			},
		},
	},
};
