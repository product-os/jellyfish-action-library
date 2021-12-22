import * as assert from '@balena/jellyfish-assert';
import { ActionFile } from '@balena/jellyfish-plugin-base';
import { JellyfishError } from '@balena/jellyfish-types';
import { TypeContract } from '@balena/jellyfish-types/build/core';

const handler: ActionFile['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const typeCard = (await context.getCardBySlug(
		session,
		`${request.arguments.type}@1.0.0`,
	))! as TypeContract;

	// In most cases, the `card` argument will contain all the information we
	// need, but in some instances (for example when the guest user session
	// creates a new user), `card` will be missing certain fields due to
	// a permission filter being applied. The full card is loaded using
	// a privileged sessions so that we can ensure all required fields are
	// present.
	const fullCard = (await context.getCardById(
		context.privilegedSession,
		card.id,
	))!;

	assert.USER(
		request.context,
		typeCard,
		context.errors.WorkerNoElement,
		`No such type: ${request.arguments.type}`,
	);

	const data = {
		timestamp: request.timestamp,
		target: fullCard.id,
		actor: request.actor,
		payload: request.arguments.payload,
	};

	const result = (await context
		.insertCard(
			session,
			typeCard,
			{
				timestamp: request.timestamp,
				actor: request.actor,
				originator: request.originator,
				attachEvents: false,
			},
			{
				slug:
					request.arguments.slug || (await context.getEventSlug(typeCard.slug)),
				version: '1.0.0',
				name: request.arguments.name || null,
				tags: request.arguments.tags || [],

				// Events always inherit the head cards markers
				markers: fullCard.markers,
				data,
			},
		)
		.catch((error: JellyfishError) => {
			// This is a user error
			if (error.name === 'JellyfishElementAlreadyExists') {
				error.expected = true;
			}

			throw error;
		}))!;

	const linkTypeCard = (await context.getCardBySlug(
		session,
		'link@1.0.0',
	))! as TypeContract;

	// Create a link card between the event and its target
	await context.insertCard(
		session,
		linkTypeCard,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: false,
		},
		{
			slug: await context.getEventSlug('link'),
			type: 'link@1.0.0',
			name: 'is attached to',
			data: {
				inverseName: 'has attached element',
				from: {
					id: result.id,
					type: result.type,
				},
				to: {
					id: fullCard.id,
					type: fullCard.type,
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
	};
};

export const actionCreateEvent: ActionFile = {
	handler,
	card: {
		slug: 'action-create-event',
		type: 'action@1.0.0',
		name: 'Attach an event to a card',
		data: {
			arguments: {
				tags: {
					type: 'array',
					items: {
						type: 'string',
					},
				},
				slug: {
					type: 'string',
					pattern: '^[a-z0-9-]+$',
				},
				name: {
					type: 'string',
				},
				type: {
					type: 'string',
					pattern: '^[a-z0-9-]+$',
				},
				payload: {
					type: 'object',
				},
			},
			required: ['type', 'payload'],
		},
	},
};
