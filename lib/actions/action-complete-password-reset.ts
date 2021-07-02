/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as assert from '@balena/jellyfish-assert';
import type { ActionFile } from '@balena/jellyfish-plugin-base';
import type { core, JellyfishError } from '@balena/jellyfish-types';
import bcrypt from 'bcrypt';
import type { ActionRequest } from '../types';
import { BCRYPT_SALT_ROUNDS } from './constants';

const pre: ActionFile['pre'] = async (_session, _context, request) => {
	// Convert the plaintext password into a hash so that we don't have a plain password stored in the DB
	request.arguments.newPassword = await bcrypt.hash(
		request.arguments.newPassword,
		BCRYPT_SALT_ROUNDS,
	);
	return request.arguments;
};

/**
 * @summary Get a password reset card from the backend
 * @function
 *
 * @param context - execution context
 * @param request - action request
 * @returns password reset card
 */
export async function getPasswordResetCard(
	context: core.Context,
	request: ActionRequest,
): Promise<core.Contract> {
	const [passwordResetCard] = await context.query(
		context.privilegedSession,
		{
			$$links: {
				'is attached to': {
					type: 'object',
					properties: {
						active: {
							type: 'boolean',
							const: true,
						},
					},
				},
			},
			type: 'object',
			required: ['type', 'links', 'data'],
			additionalProperties: true,
			properties: {
				type: {
					type: 'string',
					const: 'password-reset@1.0.0',
				},
				active: {
					type: 'boolean',
					const: true,
				},
				links: {
					type: 'object',
					additionalProperties: true,
				},
				data: {
					type: 'object',
					properties: {
						resetToken: {
							type: 'string',
							const: request.arguments.resetToken,
						},
					},
					required: ['resetToken'],
				},
			},
		},
		{
			limit: 1,
		},
	);
	return passwordResetCard;
}

/**
 * @summary Invalidate a password reset card
 * @function
 *
 * @param context - execution context
 * @param session - user session
 * @param request - action request
 * @param passwordResetCard - password reset card
 * @returns invalidated password reset card
 */
export async function invalidatePasswordReset(
	context: core.Context,
	session: string,
	request: ActionRequest,
	passwordResetCard: core.Contract,
): Promise<core.Contract> {
	const typeCard = await context.getCardBySlug(session, 'password-reset@1.0.0');
	return context.patchCard(
		session,
		typeCard,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		passwordResetCard,
		[
			{
				op: 'replace',
				path: '/active',
				value: false,
			},
		],
	);
}

const handler: ActionFile['handler'] = async (
	session,
	context,
	_card,
	request,
) => {
	const passwordReset = await getPasswordResetCard(context, request);
	assert.USER(
		request.context,
		passwordReset,
		context.errors.WorkerAuthenticationError,
		'Reset token invalid',
	);

	await invalidatePasswordReset(context, session, request, passwordReset);

	const [user] =
		passwordReset.links && passwordReset.links['is attached to']
			? passwordReset.links['is attached to']
			: [null];

	assert.USER(
		request.context,
		user,
		context.WorkerAuthenticationError,
		'Reset token invalid',
	);

	const hasExpired =
		new Date(passwordReset.data.expiresAt as string) < new Date();
	if (hasExpired) {
		const newError = new context.errors.WorkerAuthenticationError(
			'Password reset token has expired',
		);
		newError.expected = true;
		throw newError;
	}

	const userTypeCard = await context.getCardBySlug(session, 'user@latest');

	return context
		.patchCard(
			context.privilegedSession,
			userTypeCard,
			{
				timestamp: request.timestamp,
				actor: request.actor,
				originator: request.originator,
				attachEvents: false,
			},
			user,
			[
				{
					op: 'replace',
					path: '/data/hash',
					value: request.arguments.newPassword,
				},
			],
		)
		.catch((error: JellyfishError) => {
			// A schema mismatch here means that the patch could
			// not be applied to the card due to permissions.
			if (error.name === 'JellyfishSchemaMismatch') {
				// TS-TODO: Ensure this error is what is expected with Context type
				const newError = new context.errors.WorkerAuthenticationError(
					'Password change not allowed',
				);
				newError.expected = true;
				throw newError;
			}

			throw error;
		});
};

export const actionCompletePasswordReset: ActionFile = {
	pre,
	handler,
	card: {
		slug: 'action-complete-password-reset',
		type: 'action@1.0.0',
		name: 'Complete password reset',
		data: {
			arguments: {
				newPassword: {
					type: 'string',
				},
				resetToken: {
					type: 'string',
					pattern: '^[0-9a-fA-F]{64}$',
				},
			},
		},
	},
};

export { pre };
