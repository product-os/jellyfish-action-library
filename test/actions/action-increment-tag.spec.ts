/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import pick from 'lodash/pick';
import {
	makeContext,
	makeMessage,
	makeRequest,
	makeTag,
	session,
	types,
} from './helpers';
import {
	actionIncrementTag,
	mergeIncrements,
} from '../../lib/actions/action-increment-tag';
import type { ContractSummary } from '@balena/jellyfish-types/build/core';

const handler = actionIncrementTag.handler;

describe('handler()', () => {
	test('should increment a tag', async () => {
		const tag = makeTag();
		const context = makeContext([tag, types.tag]);
		const request = makeRequest({
			name: tag.slug.replace(/^tag-/, ''),
		});

		const result = await handler(session.id, context, makeMessage(), request);
		expect(result).toEqual([pick(tag, ['id', 'type', 'version', 'slug'])]);

		let updated = await context.getCardById(session.id, tag.id);
		expect(updated.data.count).toEqual(1);

		await handler(session.id, context, makeMessage(), request);
		updated = await context.getCardById(session.id, tag.id);
		expect(updated.data.count).toEqual(2);
	});
});

describe('mergeIncrements()', () => {
	test('should ignore null items', () => {
		const set: ContractSummary[] = [];
		const item = null;
		mergeIncrements(set, item);
		expect(set.length).toBe(0);
	});

	test('should push ContractSummary items', () => {
		const set: ContractSummary[] = [];
		const item: ContractSummary = {
			id: '1234',
			slug: 'card-1234',
			version: '1.0.0',
			type: 'card@1.0.0',
		};
		mergeIncrements(set, item);
		expect(set.length).toBe(1);
	});

	test('should handle ContractSummary arrays', () => {
		const set: ContractSummary[] = [];
		const items: ContractSummary[] = [
			{
				id: '1234',
				slug: 'card-1234',
				version: '1.0.0',
				type: 'card@1.0.0',
			},
			{
				id: '5678',
				slug: 'card-5678',
				version: '1.0.0',
				type: 'card@1.0.0',
			},
		];
		mergeIncrements(set, items);
		expect(set.length).toBe(2);
	});
});
