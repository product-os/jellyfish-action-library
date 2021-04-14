/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import cloneDeep from 'lodash/cloneDeep';
import filter from 'lodash/filter';
import find from 'lodash/find';
import jsonpatch, { Operation } from 'fast-json-patch';
import skhema from 'skhema';
import { v4 as uuidv4 } from 'uuid';
import type { Contract } from '@balena/jellyfish-types/build/core';
import type { ActionRequest } from '../../lib/types';
import { TypedError } from 'typed-error';

// TS-TODO: Switch to import once core is TypeScript
// tslint:disable-next-line: no-var-requires
const cards = require('@balena/jellyfish-core/lib/cards');

// Define necessary typed errors
export class WorkerNoElement extends TypedError {}
export class WorkerAuthenticationError extends TypedError {}
export class WorkerSchemaMismatch extends TypedError {}
export class JellyfishElementAlreadyExists extends TypedError {}

/**
 * @summary Create card base skeleton
 * @function
 *
 * @param type - card type
 * @param data - optional card data
 * @param slug - optional card slug
 * @returns card object
 */
function makeCard(type: string, data = {}, slug = ''): Contract {
	return {
		id: uuidv4(),
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
 * @summary Generate and return a user card
 * @returns user card
 *
 * TS-TODO: Set proper return type
 */
export function makeUser(data = {}): any {
	return makeCard('user', data);
}

/**
 * @summary Generate and return an org card
 * @returns org card
 *
 * TS-TODO: Set proper return type
 */
export function makeOrg(): any {
	return makeCard('org');
}

/**
 * @summary Generate and return an external-event card
 * @returns external-event card
 *
 * TS-TODO: Set proper return type
 */
export function makeExternalEvent(data = {}): any {
	return makeCard('external-event', data);
}

/**
 * @summary Generate and return a tag card
 * @returns tag card
 *
 * TS-TODO: Set proper return type
 */
export function makeTag(): any {
	return makeCard('tag', {
		count: 0,
	});
}

/**
 * @summary Generate and return a message card
 * @returns message card
 *
 * TS-TODO: Set proper return type
 */
export function makeMessage(data = {}): any {
	return makeCard('message', data);
}

/**
 * @summary Generate and return a first-time-login card
 * @returns first-time-login card
 *
 * TS-TODO: Set proper return type
 */
export function makeFirstTimeLogin(): any {
	return makeCard('first-time-login', {
		firstTimeLoginToken: uuidv4(),
	});
}

/**
 * @summary Generate and return a password-reset card
 * @returns password-reset card
 *
 * TS-TODO: Set proper return type
 */
export function makePasswordReset(): any {
	return makeCard('password-reset', {
		resetToken: uuidv4(),
	});
}

// Generate and expose an actor used in tests
export const actor = makeUser();

/**
 * @summary Generate and return an action request object
 * @returns action request object
 */
export function makeRequest(requestArguments = {}): ActionRequest {
	return {
		context: {
			id: `TEST-${uuidv4()}`,
		},
		timestamp: new Date().toISOString(),
		actor: exports.actor.id,
		originator: uuidv4(),
		arguments: requestArguments,
	};
}

// Generate and expose a session used in tests
export const session = makeCard('session', {
	actor: exports.actor.slug,
});

// Expose a subset of card types needed for tests
export const types = cards;
types['first-time-login'] = makeCard('type', {}, 'first-time-login');
types.message = makeCard('type', {}, 'message');
types['password-reset'] = makeCard('type', {}, 'password-reset');
types.tag = makeCard('type', {}, 'tag');

/**
 * @summary Create and return context with stubbed functions
 * @function
 *
 * @param cardFixtures - list of cards to use as stubbed card store
 * @returns test context with all necessary function stubs
 */
// TS-TODO: Properly define return type
export function makeContext(cardFixtures: Contract[] = []): any {
	const defaults = (contract: Contract) => {
		if (!contract.id) {
			contract.id = uuidv4();
		}
		if (!contract.slug) {
			contract.slug = `${contract.type}-${uuidv4()}`;
		}

		return contract;
	};
	const store = cloneDeep(cardFixtures).map(defaults);

	return {
		privilegedSession: exports.session.id,
		query: async (_session: string, schema: any): Promise<Contract[]> => {
			return filter(store, (card: Contract) => {
				return skhema.isValid(schema, card);
			});
		},
		getCardBySlug: async (
			_session: string,
			slugWithVersion: string,
		): Promise<Contract | null> => {
			const slug = slugWithVersion.split('@')[0];
			return (
				find(store, {
					slug,
				}) || null
			);
		},
		getCardById: async (
			_session: string,
			id: string,
		): Promise<Contract | null> => {
			return (
				find(store, {
					id,
				}) || null
			);
		},
		insertCard: async (
			_session: string,
			_typeCard: Contract,
			_options: any,
			object: Contract,
		): Promise<Contract> => {
			if (
				find(store, {
					slug: object.slug,
				})
			) {
				throw new JellyfishElementAlreadyExists();
			}
			store.push(defaults(object));
			return object;
		},
		patchCard: async (
			_session: string,
			_typeCard: Contract,
			_options: any,
			current: Contract,
			patch: Operation[],
		): Promise<Contract | null> => {
			const index = store.findIndex((card) => card.id === current.id);
			if (store[index]) {
				jsonpatch.applyPatch(store[index], patch);
			}
			return (
				find(store, {
					id: current.id,
				}) || null
			);
		},
		replaceCard: async (
			_session: string,
			_typeCard: Contract,
			_options: any,
			object: Contract,
		): Promise<Contract | null> => {
			const slug = object.slug.split('@')[0];
			const index = store.findIndex((card) => card.slug === slug);
			if (store[index]) {
				store[index] = Object.assign({}, store[index], object);
			}
			return (
				find(store, {
					slug,
				}) || null
			);
		},
		getEventSlug: (type: string): string => {
			return `${type}-${uuidv4()}`;
		},
		sync: {
			mirror: (): Contract[] => {
				return [exports.makeUser(), exports.makeUser()];
			},
			translate: async (): Promise<any> => {
				return new Promise((resolve) => {
					resolve([exports.makeUser(), exports.makeUser()]);
				}).catch((error) => {
					console.error(error);
				});
			},
			associate: (): Contract => {
				return exports.makeUser();
			},
			authorize: (): string => {
				return uuidv4();
			},
			getActionContext: (): object => {
				return {};
			},
		},
		defaults,
		errors: {
			WorkerNoElement,
			WorkerAuthenticationError,
			WorkerSchemaMismatch,
		},
		cards,
	};
}
