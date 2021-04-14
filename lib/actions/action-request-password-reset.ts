/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { defaultEnvironment } from '@balena/jellyfish-environment';
import { getLogger } from '@balena/jellyfish-logger';
import type { ActionFile } from '@balena/jellyfish-plugin-base';
import type { Contract } from '@balena/jellyfish-types/build/core';
import Bluebird from 'bluebird';
import crypto from 'crypto';
import type { ActionRequest, Context } from '../types';
import { actionSendEmail, buildSendEmailOptions } from './action-send-email';
import { PASSWORDLESS_USER_HASH } from './constants';
import { addLinkCard } from './utils';

const logger = getLogger(__filename);
const sendEmailHandler = actionSendEmail.handler;

const ACTIONS = defaultEnvironment.actions;

/**
 * @summary Get user card by slug
 * @function
 *
 * @param session - user session
 * @param query - query function
 * @param username - username
 * @returns user card
 */
export async function getUserBySlug(
	session: string,
	query: (
		session: string,
		query: object,
		options: object,
	) => Promise<Contract[]>,
	username: string,
): Promise<Contract> {
	const [user] = await query(
		session,
		{
			type: 'object',
			required: ['id', 'type', 'active', 'data'],
			additionalProperties: false,
			properties: {
				id: {
					type: 'string',
				},
				type: {
					type: 'string',
					const: 'user@1.0.0',
				},
				active: {
					type: 'boolean',
					const: true,
				},
				slug: {
					type: 'string',
					const: `user-${username}`,
				},
				data: {
					type: 'object',
					required: ['hash', 'email'],
					additionalProperties: false,
					properties: {
						hash: {
							type: 'string',
						},
						email: {
							anyOf: [
								{
									type: 'array',
									contains: {
										type: 'string',
									},
								},
								{
									type: 'string',
								},
							],
						},
					},
				},
			},
		},
		{
			limit: 1,
		},
	);
	return user;
}

/**
 * @summary Invalidate previous password reset cards for a user
 * @function
 *
 * @param context - execution context
 * @param userId - user ID
 * @param request - action request
 * @param typeCard - type card
 */
export async function invalidatePreviousPasswordResets(
	context: Context,
	userId: string,
	request: ActionRequest,
	typeCard: Contract,
): Promise<void> {
	const previousPasswordResets = await context.query(
		context.privilegedSession,
		{
			type: 'object',
			required: ['type', 'id'],
			additionalProperties: true,
			properties: {
				id: {
					type: 'string',
				},
				type: {
					type: 'string',
					const: 'password-reset@1.0.0',
				},
			},
			$$links: {
				'is attached to': {
					type: 'object',
					properties: {
						id: {
							type: 'string',
							const: userId,
						},
					},
				},
			},
		},
	);

	if (previousPasswordResets.length > 0) {
		await Bluebird.all(
			previousPasswordResets.map((passwordReset: Contract) => {
				return context.patchCard(
					context.privilegedSession,
					typeCard,
					{
						timestamp: request.timestamp,
						actor: request.actor,
						originator: request.originator,
						attachEvents: true,
					},
					passwordReset,
					[
						{
							op: 'replace',
							path: '/active',
							value: false,
						},
					],
				);
			}),
		);
	}
}

/**
 * @summary Create password reset card for a user
 * @function
 *
 * @param context - execution context
 * @param user - user for whom the password reset card is for
 * @param request - action request
 * @param typeCard - type card
 * @returns created password reset card
 */
export async function addPasswordResetCard(
	context: Context,
	user: Contract,
	request: ActionRequest,
	typeCard: Contract,
): Promise<Contract> {
	const resetToken = crypto
		.createHmac('sha256', ACTIONS.resetPasswordSecretToken)
		.update(user.data.hash as crypto.BinaryLike)
		.digest('hex');
	const requestedAt = new Date();
	const hourInFuture = requestedAt.setHours(requestedAt.getHours() + 1);
	const expiresAt = new Date(hourInFuture);
	return context.insertCard(
		context.privilegedSession,
		typeCard,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		{
			version: '1.0.0',
			slug: await context.getEventSlug('password-reset'),
			data: {
				expiresAt: expiresAt.toISOString(),
				requestedAt: requestedAt.toISOString(),
				resetToken,
			},
		},
	);
}

/**
 * @summary Send password reset email to user
 * @function
 *
 * @param context - execution context
 * @param userCard - user card
 * @param resetToken - reset token
 * @returns send email request response
 */
export async function sendEmail(
	context: Context,
	userCard: Contract,
	resetToken: string,
) {
	const username = userCard.slug.replace(/^user-/g, '');
	const url = `https://jel.ly.fish/password_reset/${resetToken}/${username}`;
	const html = `<p>Hello,</p><p>We have received a password reset request for the Jellyfish account attached to this email.</p><p>Please use the link below to reset your password:</p><a href="${url}">${url}</a><p>Cheers</p><p>Jellyfish Team</p><a href="https://jel.ly.fish">https://jel.ly.fish</a>`;

	return sendEmailHandler(context.privilegedSession, context, userCard, {
		arguments: buildSendEmailOptions(
			userCard,
			'Jellyfish Password Reset',
			html,
		),
	});
}

const handler: ActionFile['handler'] = async (
	_session,
	context,
	card,
	request,
) => {
	const username = request.arguments.username;
	const response = {
		id: card.id,
		type: card.type,
		version: card.version,
		slug: card.slug,
	};

	const user = await getUserBySlug(
		context.privilegedSession,
		context.query,
		username,
	);
	if (!user) {
		logger.warn(
			request.context,
			`Could not find user with username ${username}`,
		);
		return response;
	}

	if (!user.data || !user.data.hash) {
		logger.warn(
			request.context,
			`Session does not have the correct permissions to request the hash of the user with username ${username}`,
			{
				queryReturned: user,
			},
		);
		return response;
	}

	if (user.data.hash === PASSWORDLESS_USER_HASH) {
		logger.warn(
			request.context,
			`User with username ${username} has no hash set`,
		);
		return response;
	}

	try {
		const typeCard = await context.getCardBySlug(
			context.privilegedSession,
			'password-reset@1.0.0',
		);
		await invalidatePreviousPasswordResets(context, user.id, request, typeCard);
		const passwordResetCard = await addPasswordResetCard(
			request,
			context,
			user,
			typeCard,
		);
		await addLinkCard(context, request, passwordResetCard, user);
		await sendEmail(context, user, passwordResetCard.data.resetToken as string);
	} catch (error) {
		logger.warn(
			request.context,
			`Failed to request password reset for user with username ${username}`,
			{
				id: user.id,
				slug: user.slug,
				type: user.type,
				error,
			},
		);
	}
	return response;
};

export const actionRequestPasswordReset: ActionFile = {
	handler,
	card: {
		slug: 'action-request-password-reset',
		type: 'action@1.0.0',
		name: 'Request a password reset',
		data: {
			arguments: {
				username: {
					type: 'string',
					pattern: '[a-z0-9-]+$',
				},
			},
		},
	},
};
