/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { v4 as uuid } from 'uuid';
import _ from 'lodash';
import sinon from 'sinon';
import type { Contract } from '@balena/jellyfish-types/build/core';
import { actionCreateEvent } from '../../../lib/actions/action-create-event';

const sandbox = sinon.createSandbox();

const session = uuid();

const withDefaults = (
	card: Partial<Contract> & { type: Contract['type'] },
): Contract => {
	return _.merge(
		{},
		{
			id: uuid(),
			slug: `${card.type.split('@')[0]}-uuid()`,
			version: '1.0.0',
			markers: [],
			tags: [],
			data: {},
			created_at: '2019-06-19T08:32:33.142Z',
			active: true,
			requires: [],
			capabilities: [],
		},
		card,
	);
};

const createType: Contract = withDefaults({
	slug: 'create',
	type: 'type@1.0.0',
});

const linkType: Contract = withDefaults({
	slug: 'link',
	type: 'type@1.0.0',
});

const target: Contract = withDefaults({
	type: 'foo@1.0.0',
});

const actor: Contract = withDefaults({
	type: 'user@1.0.0',
});

const createEvent: Contract = withDefaults({
	type: 'create@1.0.0',
});

describe('action-create-event', () => {
	afterEach(() => {
		sandbox.reset();
	});

	describe('create events', () => {
		it('should create a link between the target and the creator', async () => {
			const context = {
				id: 'context-1',
				errors: {},
				getCardBySlug: sandbox.stub(),
				getCardById: sandbox.stub(),
				insertCard: sandbox.stub(),
				getEventSlug: sandbox.stub(),
			};
			const request = {
				context: {
					id: 'request-context-1',
				},
				actor: actor.id,
				timestamp: '2020-01-01T00:00:00.000Z',
				originator: 'originator-1',
				arguments: {
					slug: `create-1`,
					type: 'create',
					payload: {},
				},
			};
			context.getCardBySlug.onFirstCall().resolves(createType);
			context.getCardById.onFirstCall().resolves(target);
			context.insertCard.onFirstCall().resolves(createEvent);
			context.getCardBySlug.onSecondCall().resolves(linkType);
			// This call should fetch the actor card prior to linking the target to the actor
			context.getCardById.onSecondCall().resolves(actor);
			// This call should insert the link between the target and the actor
			context.insertCard.onSecondCall().resolves();
			context.insertCard.onThirdCall().resolves();
			context.getEventSlug.resolves(`link-1`);

			const result = await actionCreateEvent.handler(
				session,
				context,
				target,
				request,
			);

			expect(context.getCardById.getCall(1).args[1]).toBe(actor.id);
			expect(_.omit(context.insertCard.getCall(1).args[3], 'slug')).toEqual({
				type: 'link@1.0.0',
				name: 'was created by',
				data: {
					inverseName: 'created',
					from: {
						id: target.id,
						type: target.type,
					},
					to: {
						id: actor.id,
						type: actor.type,
					},
				},
			});
			expect(result).toEqual(
				_.pick(createEvent, 'id', 'type', 'version', 'slug'),
			);
		});
	});
});
