/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import * as semver from 'semver';
import { actionMergeDraftVersion } from '../../../lib/actions/action-merge-draft-version';
import { after, before, makeContext, makeCard, makeRequest } from './helpers';

const handler = actionMergeDraftVersion.handler;
const context = makeContext();

beforeAll(async () => {
	await before(context);
});

afterAll(async () => {
	await after(context);
});

describe('action-merge-draft-version', () => {
	test('should merge draft version contract without an artifact', async () => {
		const targetContract = await context.kernel.insertCard(
			context.context,
			context.session,
			{
				...makeCard({
					$transformer: {
						artifactReady: false,
					},
				}),
				version: '1.0.2-beta1+rev02',
			},
		);
		const request = makeRequest(context, {});

		const result = await handler(
			context.session,
			context,
			targetContract,
			request,
		);
		if (isNull(result) || isArray(result)) {
			expect(isNull(result) || isArray(result)).toBeFalsy();
			return;
		}
		expect(result.slug).toEqual(targetContract.slug);
		expect(result.type).toEqual(targetContract.type);
		expect(semver.prerelease(result.version)).toBeFalsy();

		const updated = await context.getCardById(
			context.session,
			targetContract.id,
		);
		expect(updated.data).toEqual(targetContract.data);
	});

	test('should throw an error on invalid type', async () => {
		const targetContract = await context.kernel.insertCard(
			context.context,
			context.session,
			{
				...makeCard({
					$transformer: {
						artifactReady: true,
					},
				}),
				version: '1.0.2-beta1+rev02',
			},
		);
		targetContract.type = 'foobar@1.0.0';

		expect.assertions(1);
		try {
			await handler(
				context.session,
				context,
				targetContract,
				makeRequest(context),
			);
		} catch (error) {
			expect(error.message).toEqual(`No such type: ${targetContract.type}`);
		}
	});
});
