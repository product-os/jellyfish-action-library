import * as assert from '@balena/jellyfish-assert';
import type { ActionFile } from '@balena/jellyfish-plugin-base';
import type { TypeContract } from '@balena/jellyfish-types/build/core';
import bcrypt from 'bcrypt';
import { v4 as isUUID } from 'is-uuid';
import skhema from 'skhema';
import { v4 as uuidv4 } from 'uuid';
import { BCRYPT_SALT_ROUNDS } from './constants';

const pre: ActionFile['pre'] = async (session, context, request) => {
	// Validate scope schema if set.
	if (request.arguments.scope) {
		assert.USER(
			request.context,
			skhema.isValid(
				request.arguments.scope,
				{},
				{
					schemaOnly: true,
				},
			),
			context.errors.WorkerSchemaMismatch,
			'Invalid schema for session scope',
		);
	} else {
		request.arguments.scope = {};
	}

	const userCard = (
		isUUID(request.card)
			? await context.getCardById(session, request.card)
			: await context.getCardBySlug(session, `${request.card}@latest`)
	)!;

	assert.USER(
		request.context,
		userCard,
		context.errors.WorkerAuthenticationError,
		'Incorrect username or password',
	);

	const fullUser = (await context.getCardById(
		context.privilegedSession,
		userCard.id,
	))!;

	assert.USER(
		request.context,
		fullUser.data.hash,
		context.errors.WorkerAuthenticationError,
		'Login disallowed',
	);

	const matches = await bcrypt.compare(
		request.arguments.password,
		fullUser.data.hash as string,
	);
	assert.USER(
		request.context,
		matches,
		context.errors.WorkerAuthenticationError,
		'Invalid password',
	);

	// Don't store the plain text password in the
	// action request as we don't need it anymore.
	request.arguments.password = 'CHECKED IN PRE HOOK';

	return request.arguments;
};

const handler: ActionFile['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const user = (await context.getCardById(context.privilegedSession, card.id))!;

	assert.USER(
		request.context,
		user,
		context.errors.WorkerAuthenticationError,
		`No such user: ${card.id}`,
	);
	assert.USER(
		request.context,
		user.data.hash,
		context.errors.WorkerAuthenticationError,
		'Login disallowed',
	);

	const sessionTypeCard = (await context.getCardBySlug(
		session,
		'session@1.0.0',
	))! as TypeContract;

	assert.USER(
		request.context,
		sessionTypeCard,
		context.errors.WorkerNoElement,
		'No such type: session',
	);

	// Set the expiration date to be 7 days from now
	const expirationDate = new Date();
	expirationDate.setDate(expirationDate.getDate() + 7);

	/*
	 * This allows us to differentiate two login requests
	 * coming on the same millisecond, unlikely but possible.
	 */
	const suffix = uuidv4();

	const secretToken = await uuidv4();
	const secretTokenHash = await bcrypt.hash(secretToken, BCRYPT_SALT_ROUNDS);

	const result = await context.insertCard(
		context.privilegedSession,
		sessionTypeCard,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		{
			version: '1.0.0',
			slug: `session-${user.slug}-${request.epoch}-${suffix}`,
			data: {
				actor: card.id,
				expiration: expirationDate.toISOString(),
				scope: request.arguments.scope,
				token: {
					authentication: secretTokenHash,
				},
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
		data: {
			token: {
				authentication: secretToken,
			},
		},
	};
};

export const actionCreateSession: ActionFile = {
	pre,
	handler,
	card: {
		slug: 'action-create-session',
		type: 'action@1.0.0',
		name: 'Login as a user',
		data: {
			filter: {
				type: 'object',
				properties: {
					type: {
						type: 'string',
						const: 'user@1.0.0',
					},
				},
				required: ['type'],
			},
			arguments: {
				password: {
					type: 'string',
				},
				scope: {
					type: 'object',
					additionalProperties: true,
				},
			},
		},
	},
};
