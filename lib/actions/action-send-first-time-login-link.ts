/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as assert from '@balena/jellyfish-assert';
import { getLogger } from '@balena/jellyfish-logger';
import type { ActionFile } from '@balena/jellyfish-plugin-base';
import type {
	Contract,
	TypeContract,
} from '@balena/jellyfish-types/build/core';
import { v4 as uuidv4 } from 'uuid';
import Bluebird from 'bluebird';
import get from 'lodash/get';
import includes from 'lodash/includes';
import intersectionBy from 'lodash/intersectionBy';
import type { ActionRequest } from '../types';
import { actionSendEmail, buildSendEmailOptions } from './action-send-email';
import { addLinkCard } from './utils';
import { WorkerContext } from '@balena/jellyfish-types/build/worker';

const logger = getLogger(__filename);
const sendEmailHandler = actionSendEmail.handler;

/**
 * @summary Get organization cards for a given user
 * @function
 *
 * @param context - execution context
 * @param userId - user ID
 * @returns set of organization cards
 */
export async function queryUserOrgs(
	context: WorkerContext,
	userId: string,
): Promise<Contract[]> {
	return context.query(context.privilegedSession, {
		$$links: {
			'has member': {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						const: userId,
					},
					type: {
						type: 'string',
						const: 'user@1.0.0',
					},
				},
			},
		},
		type: 'object',
		properties: {
			type: {
				type: 'string',
				const: 'org@1.0.0',
			},
			links: {
				type: 'object',
			},
		},
	});
}

/**
 * @summary Get a user's roles from the backend
 * @function
 *
 * @param context - execution context
 * @param userId - user ID
 * @param request - action request
 * @returns list of roles
 */
export async function getUserRoles(
	context: WorkerContext,
	userId: string,
	request: ActionRequest,
): Promise<string[]> {
	const [user] = await context.query(context.privilegedSession, {
		type: 'object',
		properties: {
			id: {
				const: userId,
			},
			data: {
				type: 'object',
				properties: {
					roles: {
						type: 'array',
						items: {
							type: 'string',
						},
					},
				},
			},
		},
	});
	const roles = get(user, ['data', 'roles']) as string[];
	assert.USER(
		request.context,
		roles,
		context.errors.WorkerNoElement,
		"Something went wrong while trying to query for the user's roles",
	);
	return roles;
}

/**
 * @summary Invalidate previous first time login cards
 * @function
 *
 * @param context - execution context
 * @param request - action request
 * @param userId - user ID
 * @param typeCard - type card
 */
export async function invalidatePreviousFirstTimeLogins(
	context: WorkerContext,
	request: ActionRequest,
	userId: string,
	typeCard: TypeContract,
): Promise<void> {
	const previousFirstTimeLogins = await context.query(
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
					const: 'first-time-login@1.0.0',
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

	if (previousFirstTimeLogins.length > 0) {
		await Bluebird.all(
			previousFirstTimeLogins.map((firstTimeLogin: Contract) => {
				return context.patchCard(
					context.privilegedSession,
					typeCard,
					{
						timestamp: request.timestamp,
						actor: request.actor,
						originator: request.originator,
						attachEvents: true,
					},
					firstTimeLogin,
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
 * @summary Add first-time login card
 * @function
 *
 * @param context - execution context
 * @param request - action request
 * @param typeCard - type card
 * @returns created first-time login card
 */
export async function addFirstTimeLogin(
	context: WorkerContext,
	request: ActionRequest,
	typeCard: TypeContract,
): Promise<Contract> {
	const firstTimeLoginToken = uuidv4();
	const requestedAt = new Date();

	// The first time login token is valid for 7 days
	const sevenDaysinFuture = requestedAt.setHours(
		requestedAt.getHours() + 24 * 7,
	);
	const expiresAt = new Date(sevenDaysinFuture);
	return (await context.insertCard(
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
			slug: await context.getEventSlug('first-time-login'),
			data: {
				expiresAt: expiresAt.toISOString(),
				requestedAt: requestedAt.toISOString(),
				firstTimeLoginToken,
			},
		},
	))!;
}

/**
 * @summary Send first-time login token to user
 * @function
 *
 * @param context - execution context
 * @param userCard - user card
 * @param firstTimeLoginToken - first-time login token
 * @returns send email request response
 */
export async function sendEmail(
	context: WorkerContext,
	userCard: Contract,
	firstTimeLoginToken: string,
): Promise<any> {
	const username = userCard.slug.replace(/^user-/g, '');
	const url = `https://jel.ly.fish/first_time_login/${firstTimeLoginToken}/${username}`;
	const html = `<p>Hello,</p><p>Here is a link to login to your new Jellyfish account ${username}.</p><p>Please use the link below to set your password and login:</p><a href="${url}">${url}</a><p>Cheers</p><p>Jellyfish Team</p><a href="https://jel.ly.fish">https://jel.ly.fish</a>`;

	return sendEmailHandler(context.privilegedSession, context, userCard, {
		arguments: buildSendEmailOptions(
			userCard,
			'Jellyfish First Time Login',
			html,
		),
	} as any);
}

/**
 * @summary Check that a user belongs to specific organizations
 * @function
 *
 * @param context - execution context
 * @param request - action request
 * @param userCard - user card
 */
export async function checkOrgs(
	context: WorkerContext,
	request: ActionRequest,
	userCard: Contract,
): Promise<void> {
	const requesterOrgs = await queryUserOrgs(context, request.actor);
	assert.USER(
		request.context,
		requesterOrgs.length > 0,
		context.errors.WorkerNoElement,
		'You do not belong to an organisation and thus cannot send a first-time login link to any users',
	);

	const userOrgs = await queryUserOrgs(context, userCard.id);
	assert.USER(
		request.context,
		userOrgs.length > 0,
		context.errors.WorkerNoElement,
		`User with slug ${userCard.slug} is not a member of any organisations`,
	);

	const sharedOrgs = intersectionBy(userOrgs, requesterOrgs, 'id');
	assert.USER(
		request.context,
		sharedOrgs.length > 0,
		context.errors.WorkerAuthenticationError,
		`User with slug ${userCard.slug} is not a member of any of your organisations`,
	);
}

/**
 * @summary Set "user-community" role to specified user
 * @function
 *
 * @param context - execution context
 * @param session - user session
 * @param userCard - user card
 * @param request - action request
 */
async function setCommunityRole(
	context: WorkerContext,
	session: string,
	userCard: Contract,
	request: ActionRequest,
): Promise<void> {
	const typeCard = (await context.getCardBySlug(
		session,
		'user@latest',
	))! as TypeContract;
	await context.patchCard(
		context.privilegedSession,
		typeCard,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		userCard,
		[
			{
				op: 'replace',
				path: '/data/roles',
				value: ['user-community'],
			},
		],
	);
	logger.info(
		request.context,
		`Added community role to user with slug ${userCard.slug}`,
	);
}

const handler: ActionFile['handler'] = async (
	session,
	context,
	userCard,
	request,
) => {
	const typeCard = (await context.getCardBySlug(
		session,
		'first-time-login@latest',
	))! as TypeContract;
	const userEmails = userCard.data.email as string[];

	assert.USER(
		request.context,
		typeCard,
		context.errors.WorkerNoElement,
		'No such type: first-time-login',
	);

	assert.USER(
		request.context,
		userCard.active,
		context.errors.WorkerNoElement,
		`User with slug ${userCard.slug} is not active`,
	);

	assert.USER(
		request.context,
		userCard.data.email && userEmails.length,
		context.errors.WorkerNoElement,
		`User with slug ${userCard.slug} does not have an email address`,
	);

	await checkOrgs(context, request, userCard);
	const userRoles = await getUserRoles(context, userCard.id, request);
	if (!includes(userRoles, 'user-community')) {
		logger.info(
			request.context,
			`User with slug ${userCard.slug} does not have community role. Setting role now`,
		);
		await setCommunityRole(context, session, userCard, request);
	}

	await invalidatePreviousFirstTimeLogins(
		context,
		request,
		userCard.id,
		typeCard,
	);
	const firstTimeLoginCard = await addFirstTimeLogin(
		context,
		request,
		typeCard,
	);
	await addLinkCard(context, request, firstTimeLoginCard, userCard);
	await sendEmail(
		context,
		userCard,
		firstTimeLoginCard.data.firstTimeLoginToken as string,
	);
	return {
		id: userCard.id,
		type: userCard.type,
		version: userCard.version,
		slug: userCard.slug,
	};
};

export const actionSendFirstTimeLoginLink: ActionFile = {
	handler,
	card: {
		slug: 'action-send-first-time-login-link',
		type: 'action@1.0.0',
		name: 'Send a first-time login link to a user',
		data: {
			filter: {
				type: 'object',
				properties: {
					type: {
						type: 'string',
						const: 'user@1.0.0',
					},
				},
			},
			arguments: {},
		},
	},
};
