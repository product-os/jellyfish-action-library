import * as assert from '@balena/jellyfish-assert';
import { getLogger } from '@balena/jellyfish-logger';
import type { ActionFile } from '@balena/jellyfish-plugin-base';
import type { JellyfishError } from '@balena/jellyfish-types';
import type {
	Contract,
	TypeContract,
} from '@balena/jellyfish-types/build/core';
import type { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { isNil } from 'lodash';
import { actionCompletePasswordReset } from './action-complete-password-reset';
import { PASSWORDLESS_USER_HASH } from './constants';
import type { ActionRequest } from '../types';

const logger = getLogger(__filename);
const pre = actionCompletePasswordReset.pre;

/**
 * @summary Get first-time login card from database
 * @function
 *
 * @param context - execution context
 * @param request - action request
 * @returns
 */
export async function getFirstTimeLoginCard(
	context: WorkerContext,
	request: ActionRequest,
): Promise<Contract | null> {
	const [firstTimeLogin] = await context.query(
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
			required: ['type', 'links', 'active', 'data'],
			additionalProperties: true,
			properties: {
				type: {
					type: 'string',
					const: 'first-time-login@1.0.0',
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
						firstTimeLoginToken: {
							type: 'string',
							const: request.arguments.firstTimeLoginToken,
						},
					},
					required: ['firstTimeLoginToken'],
				},
			},
		},
		{
			limit: 1,
		},
	);
	return firstTimeLogin;
}

/**
 * @summary Invalidate a first-time login card
 * @function
 *
 * @param context - execution context
 * @param session - user session
 * @param request - action request
 * @param card - first-time login card to invalidate
 * @returns invalidated first-time login card
 */
export async function invalidateFirstTimeLogin(
	context: WorkerContext,
	request: ActionRequest,
	card: Contract,
): Promise<Contract> {
	const typeCard = (await context.getCardBySlug(
		context.privilegedSession,
		'first-time-login@latest',
	))! as TypeContract;
	return (await context.patchCard(
		context.privilegedSession,
		typeCard,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		card,
		[
			{
				op: 'replace',
				path: '/active',
				value: false,
			},
		],
	))!;
}

const handler: ActionFile['handler'] = async (
	session,
	context,
	_card,
	request,
) => {
	const firstTimeLogin = await getFirstTimeLoginCard(context, request);
	if (isNil(firstTimeLogin)) {
		const error = new context.errors.WorkerAuthenticationError(
			'First-time login token invalid',
		);
		error.expected = true;
		logger.warn(
			request.context,
			`Could not find firstTimeLogin card with token ${request.arguments.firstTimeLoginToken}`,
		);
		throw error;
	}

	await invalidateFirstTimeLogin(context, request, firstTimeLogin);

	const [user] =
		firstTimeLogin &&
		firstTimeLogin.links &&
		firstTimeLogin.links['is attached to']
			? firstTimeLogin.links['is attached to']
			: [null];
	if (isNil(user)) {
		const error = new context.errors.WorkerAuthenticationError(
			'First-time login token invalid',
		);
		error.expected = false;
		logger.warn(
			request.context,
			`FirstTimeLogin card with token
			${request.arguments.firstTimeLoginToken} has no user attached`,
		);
		throw error;
	}

	assert.USER(
		request.context,
		user,
		context.errors.WorkerAuthenticationError,
		'First-time login token invalid',
	);

	const hasExpired =
		new Date(firstTimeLogin.data.expiresAt as string) < new Date();
	if (hasExpired) {
		const newError = new context.errors.WorkerAuthenticationError(
			'First-time login token has expired',
		);
		newError.expected = true;
		throw newError;
	}

	const isFirstTimeLogin = user.data.hash === PASSWORDLESS_USER_HASH;

	assert.USER(
		request.context,
		isFirstTimeLogin,
		context.errors.WorkerAuthenticationError,
		'User already has a password set',
	);

	const userTypeCard = (await context.getCardBySlug(
		session,
		'user@latest',
	))! as TypeContract;

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
			console.dir(error, {
				depth: null,
			});

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

export const actionCompleteFirstTimeLogin: ActionFile = {
	pre,
	handler,
	card: {
		slug: 'action-complete-first-time-login',
		type: 'action@1.0.0',
		name: 'Complete the first time login of a user',
		data: {
			arguments: {
				newPassword: {
					type: 'string',
				},
				firstTimeLoginToken: {
					type: 'string',
					format: 'uuid',
				},
			},
		},
	},
};
