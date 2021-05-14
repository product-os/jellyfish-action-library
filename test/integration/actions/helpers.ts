/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import type { Contract } from '@balena/jellyfish-types/build/core';
import { TypedError } from 'typed-error';
import { v4 as uuidv4 } from 'uuid';
import type { ActionRequest, Context } from '../../../lib/types';
import { jellyfish, worker } from '../helpers';

// Define necessary typed errors
export class WorkerNoElement extends TypedError {}
export class WorkerAuthenticationError extends TypedError {}
export class WorkerSchemaMismatch extends TypedError {}

export async function before(context: Context): Promise<void> {
	await jellyfish.before(context);
	await worker.before(context);

	const actionContext = context.worker.getActionContext({
		id: `test-${uuidv4()}`,
		api: `test-${uuidv4()}`,
	});

	context.errors = {
		WorkerNoElement,
		WorkerAuthenticationError,
		WorkerSchemaMismatch,
	};
	context.cards = context.allCards;
	context.privilegedSession = context.session;
	context.insertCard = actionContext.insertCard;
	context.getCardById = actionContext.getCardById;
	context.getCardBySlug = actionContext.getCardBySlug;
	context.query = actionContext.query;
	context.getEventSlug = actionContext.getEventSlug;
	context.patchCard = actionContext.patchCard;
	context.replaceCard = actionContext.replaceCard;
	context.sync = {
		mirror: (): Contract[] => {
			return [makeUser(), makeUser()];
		},
		translate: async (): Promise<any> => {
			return new Promise((resolve) => {
				resolve([makeUser(), makeUser()]);
			}).catch((error) => {
				console.error(error);
			});
		},
		associate: (): Contract => {
			return makeUser();
		},
		authorize: (): string => {
			return uuidv4();
		},
		getActionContext: (): object => {
			return {};
		},
	};
}

export async function after(context: Context): Promise<void> {
	await jellyfish.after(context);
	await worker.after(context);
}

/**
 * @summary Create contract base skeleton
 * @function
 *
 * @param type - contract base type
 * @param data - optional contract data object
 * @param slug - optional contract slug
 * @returns contract
 */
function makeContract(type: string, data = {}, slug = ''): Contract {
	return {
		id: uuidv4(),
		name: uuidv4(),
		slug: type === 'type' ? slug : `${type}-${uuidv4()}`,
		type: `${type}@1.0.0`,
		version: '1.0.0',
		active: true,
		links: {},
		tags: [],
		markers: [],
		created_at: new Date().toISOString(),
		requires: [],
		capabilities: [],
		data,
	};
}

/**
 * @summary Generate and return a user contract
 * @function
 *
 * @param data - optional contract data object
 * @returns user contract
 */
export function makeUser(data = {}): Contract {
	return makeContract(
		'user',
		Object.assign(
			{},
			{
				hash: uuidv4(),
				roles: [],
			},
			data,
		),
	);
}

/**
 * @summary Generate and return an org contract
 * @function
 *
 * @returns org contract
 */
export function makeOrg(): Contract {
	return makeContract('org');
}

/**
 * @summary Generate and return an external-event contract
 * @function
 *
 * @param data - optional contract data object
 * @returns external-event contract
 */
export function makeExternalEvent(data = {}): Contract {
	return makeContract(
		'external-event',
		Object.assign(
			{},
			{
				source: uuidv4(),
				headers: {
					foo: uuidv4(),
				},
				payload: {
					foo: uuidv4(),
				},
			},
			data,
		),
	);
}

/**
 * @summary Generate and return a tag contract
 * @function
 *
 * @returns tag contract
 */
export function makeTag(): Contract {
	return makeContract('tag', {
		count: 0,
	});
}

/**
 * @summary Generate and return a message contract
 * @function
 *
 * @param context - execution context
 * @param data - optional contract data object
 * @returns message contract
 */
export function makeMessage(context: Context, data = {}): Contract {
	return makeContract(
		'message',
		Object.assign(
			{},
			{
				actor: context.actor.id,
				payload: {
					message: uuidv4(),
				},
				timestamp: new Date().toISOString(),
			},
			data,
		),
	);
}

/**
 * @summary Generate and return a ping contract
 * @function
 *
 * @param - optional contract data object
 * @returns ping contract
 */
export function makePing(data = {}): Contract {
	return makeContract(
		'ping',
		Object.assign(
			{},
			{
				timestamp: new Date().toISOString(),
			},
			data,
		),
	);
}

/**
 * @summary Generate and return a thread contract
 * @function
 *
 * @param data - optional contract data object
 * @returns thread contract
 */
export function makeThread(data = {}): Contract {
	return makeContract('thread', data);
}

/**
 * @summary Generate and return a first-time-login contract
 * @function
 *
 * @returns first-time-login contract
 */
export function makeFirstTimeLogin(): Contract {
	return makeContract('first-time-login', {
		firstTimeLoginToken: uuidv4(),
	});
}

/**
 * @summary Generate and return a password-reset contract
 * @function
 *
 * @param data - optional contract data object
 * @returns password-reset contract
 */
export function makePasswordReset(data = {}): Contract {
	return makeContract(
		'password-reset',
		Object.assign(
			{},
			{
				resetToken: uuidv4(),
			},
			data,
		),
	);
}

/**
 * @summary Generate and return an action request object
 * @function
 *
 * @param context - execution context
 * @param requestArguments - optional request arguments
 * @returns action request object
 */
export function makeRequest(
	context: Context,
	requestArguments = {},
): ActionRequest {
	return {
		context: {
			id: `TEST-${uuidv4()}`,
		},
		timestamp: new Date().toISOString(),
		actor: context.actor.id,
		originator: uuidv4(),
		arguments: requestArguments,
	};
}

/**
 * @summary Generate and return test context base
 * @function
 *
 * @returns test context
 */
export function makeContext(): Context {
	return {
		id: `test-${uuidv4()}`,
	};
}

/**
 * @summary Create a thread with a linked message
 *
 * @param context - execution context
 * @returns created thread and message contracts
 */
export async function createThread(context: Context): Promise<any> {
	const thread = await context.kernel.insertCard(
		context.context,
		context.session,
		makeThread(),
	);
	const message = await context.kernel.insertCard(
		context.context,
		context.session,
		makeMessage(context),
	);
	await context.kernel.insertCard(context.context, context.session, {
		slug: `link-${message.slug}-is-attached-to-${thread.slug}`,
		type: 'link@1.0.0',
		name: 'is attached to',
		data: {
			inverseName: 'has attached element',
			from: {
				id: message.id,
				type: message.type,
			},
			to: {
				id: thread.id,
				type: thread.type,
			},
		},
	});

	return {
		message,
		thread,
	};
}

/**
 * Check that a given string exists within form data payload
 * @function
 *
 * @param key - parameter name to check for
 * @param value - value expected to be assigned to key
 * @param text - full form data payload
 * @returns boolean denoting if parameter information was found
 */
export function includes(key: string, value: string, text: string): boolean {
	const pattern = new RegExp(`name="${key}"\\s*${value}`, 'm');
	const regex = text.search(pattern);
	return regex !== -1;
}
