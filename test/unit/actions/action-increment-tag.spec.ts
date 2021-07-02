/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import type { core } from '@balena/jellyfish-types';
import { mergeIncrements } from '../../../lib/actions/action-increment-tag';

describe('mergeIncrements()', () => {
	test('should ignore null items', () => {
		const set: core.ContractSummary[] = [];
		const item = null;
		mergeIncrements(set, item);
		expect(set.length).toBe(0);
	});

	test('should push ContractSummary items', () => {
		const set: core.ContractSummary[] = [];
		const item: core.ContractSummary = {
			id: '1234',
			slug: 'card-1234',
			version: '1.0.0',
			type: 'card@1.0.0',
		};
		mergeIncrements(set, item);
		expect(set.length).toBe(1);
	});

	test('should handle ContractSummary arrays', () => {
		const set: core.ContractSummary[] = [];
		const items: core.ContractSummary[] = [
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
