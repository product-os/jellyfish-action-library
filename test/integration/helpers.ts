/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

// tslint:disable: no-var-requires

import { PluginManager } from '@balena/jellyfish-plugin-base';
import type { Actions, Contracts } from '@balena/jellyfish-plugin-base';
import {
	Consumer,
	errors as queueErrors,
	Producer,
} from '@balena/jellyfish-queue';
import { before as backendBefore } from '@balena/jellyfish-test-harness/build/integration/backend-helpers';
import {
	generateRandomID,
	generateRandomSlug,
} from '@balena/jellyfish-test-harness/build/integration/utils';
import type { core } from '@balena/jellyfish-types';
import { Worker } from '@balena/jellyfish-worker';
import { cards, cardMixins } from '@balena/jellyfish-core';
import Bluebird from 'bluebird';
import errio from 'errio';
import filter from 'lodash/filter';
import forEach from 'lodash/forEach';
import { v4 as uuidv4 } from 'uuid';
import { ActionLibrary } from '../../lib';
import type { ActionRequest } from '../../lib/types';

// TS-TODO: Switch to import
const DefaultPlugin = require('@balena/jellyfish-plugin-default');

const pluginManager = new PluginManager(
	{
		id: 'jellyfish-test',
	},
	{
		plugins: [ActionLibrary, DefaultPlugin],
	},
);

/**
 * @summary Get all contracts
 * @function
 *
 * @param context - execution context
 * @returns map of contracts
 */
function loadCards(context: core.Context): Contracts {
	const allCards = pluginManager.getCards(context, cardMixins);
	allCards['action-test-originator'] = Object.assign(
		{},
		allCards['action-create-card'],
		{
			slug: 'action-test-originator',
		},
	);
	allCards.event = cards.event;
	return allCards;
}

/**
 * @summary Get all actions
 * @function
 *
 * @param context - execution context
 * @returns map of actions
 */
function loadActions(context: core.Context): Actions {
	const allActions = pluginManager.getActions(context);
	Object.assign(allActions, {
		'action-test-originator': {
			handler: async (
				session: string,
				ctx: core.Context,
				card: core.Contract,
				request: ActionRequest,
			) => {
				request.arguments.properties.data =
					request.arguments.properties.data || {};
				request.arguments.properties.data.originator = request.originator;
				return allActions['action-create-card'].handler(
					session,
					ctx,
					card,
					request,
				);
			},
		},
	});
	return allActions;
}

const before = async (context: any) => {
	await backendBefore(context, {
		suffix: `action_library_${uuidv4().split('-')[0]}`,
	});

	context.allCards = loadCards(context.context);
	context.actionLibrary = loadActions(context.context);
	context.jellyfish = context.kernel;
	context.session = context.jellyfish.sessions.admin;

	const session = await context.jellyfish.getCardById(
		context.context,
		context.session,
		context.session,
	);
	context.actor = await context.jellyfish.getCardById(
		context.context,
		context.session,
		session.data.actor,
	);

	await context.jellyfish.insertCard(
		context.context,
		context.session,
		context.allCards.ping,
	);
	await context.jellyfish.insertCard(
		context.context,
		context.session,
		context.allCards['external-event'],
	);
	await context.jellyfish.insertCard(
		context.context,
		context.session,
		context.allCards.tag,
	);
	await context.jellyfish.insertCard(
		context.context,
		context.session,
		context.allCards.message,
	);
	await context.jellyfish.insertCard(
		context.context,
		context.session,
		context.allCards.thread,
	);
	await context.jellyfish.insertCard(
		context.context,
		context.session,
		context.allCards['role-user-community'],
	);
	await context.jellyfish.insertCard(
		context.context,
		context.session,
		context.allCards['password-reset'],
	);
	await context.jellyfish.insertCard(
		context.context,
		context.session,
		context.allCards['first-time-login'],
	);

	const actionCards = filter(context.allCards, (card) => {
		return card.slug.startsWith('action-');
	});

	forEach(actionCards, async (actionCard: any) => {
		await context.jellyfish.insertCard(
			context.context,
			context.session,
			actionCard,
		);
	});

	context.queue = {};
	context.queue.errors = queueErrors;
	context.queue.consumer = new Consumer(context.jellyfish, context.session);

	const consumedActionRequests: any[] = [];
	await context.queue.consumer.initializeWithEventHandler(
		context.context,
		(actionRequest: any) => {
			consumedActionRequests.push(actionRequest);
		},
	);

	context.queueActor = uuidv4();
	context.dequeue = async (times = 50) => {
		if (consumedActionRequests.length === 0) {
			if (times <= 0) {
				return null;
			}

			await Bluebird.delay(10);
			return context.dequeue(times - 1);
		}

		return consumedActionRequests.shift();
	};

	context.queue.producer = new Producer(context.jellyfish, context.session);

	await context.queue.producer.initialize(context.context);
	context.generateRandomSlug = generateRandomSlug;
	context.generateRandomID = generateRandomID;
};

const after = async (context: any) => {
	if (context.queue) {
		await context.queue.consumer.cancel();
	}

	if (context.jellyfish) {
		await context.backend.disconnect(context.context);
		if (context.cache) {
			await context.cache.disconnect();
		}
	}
};

export const jellyfish: any = {
	before: async (context: any) => {
		await before(context);

		await context.jellyfish.insertCard(
			context.context,
			context.session,
			require('@balena/jellyfish-worker').CARDS.update,
		);
		await context.jellyfish.insertCard(
			context.context,
			context.session,
			require('@balena/jellyfish-worker').CARDS.create,
		);
		await context.jellyfish.insertCard(
			context.context,
			context.session,
			require('@balena/jellyfish-worker').CARDS['triggered-action'],
		);
	},

	after: async (context: any) => {
		await after(context);
	},
};

export const worker: any = {
	before: async (context: any) => {
		context.worker = new Worker(
			context.jellyfish,
			context.session,
			context.actionLibrary,
			context.queue.consumer,
			context.queue.producer,
		);
		await context.worker.initialize(context.context);

		context.flush = async (session: string) => {
			const request = await context.dequeue();

			if (!request) {
				throw new Error('No message dequeued');
			}

			const result = await context.worker.execute(session, request);

			if (result.error) {
				const Constructor =
					context.worker.errors[result.data.name] ||
					context.queue.errors[result.data.name] ||
					context.jellyfish.errors[result.data.name] ||
					Error;

				const error = new Constructor(result.data.message);
				error.stack = errio.fromObject(result.data).stack;
				throw error;
			}
		};

		context.processAction = async (session: string, action: any) => {
			const createRequest = await context.queue.producer.enqueue(
				context.worker.getId(),
				session,
				action,
			);
			await context.flush(session);
			return context.queue.producer.waitResults(context, createRequest);
		};
	},
	after,
};
