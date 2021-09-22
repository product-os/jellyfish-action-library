/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { strict as assert } from 'assert';
import md5 from 'blueimp-md5';
import isArray from 'lodash/isArray';
import isNull from 'lodash/isNull';
import nock from 'nock';
import ActionLibrary from '../../../lib';
import { actionSetUserAvatar } from '../../../lib/actions/action-set-user-avatar';
import { makeRequest } from './helpers';

const handler = actionSetUserAvatar.handler;
let ctx: integrationHelpers.IntegrationTestContext;
let actionContext: WorkerContext;

beforeAll(async () => {
	ctx = await integrationHelpers.before([
		DefaultPlugin,
		ActionLibrary,
		ProductOsPlugin,
	]);
	actionContext = ctx.worker.getActionContext({
		id: `test-${ctx.generateRandomID()}`,
	});
});

afterAll(async () => {
	return integrationHelpers.after(ctx);
});

afterEach(() => {
	nock.cleanAll();
});

/**
 * Generate random email address
 * @function
 *
 * @returns random email address
 */
function genEmail(): string {
	return `${ctx.generateRandomID()}@foo.bar`;
}

describe('action-set-user-avatar', () => {
	test('should not set avatar if user has no email', async () => {
		const user = await ctx.createContract(
			ctx.actor.id,
			ctx.session,
			'user@1.0.0',
			ctx.generateRandomWords(3),
			{
				hash: ctx.generateRandomID(),
				roles: [],
			},
		);
		const result = await handler(
			ctx.session,
			actionContext,
			user,
			makeRequest(ctx),
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result).toEqual({
				id: user.id,
				slug: user.slug,
				version: user.version,
				type: user.type,
			});
		}

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.avatar).toBeUndefined();
	});

	test('should not update avatar if already set', async () => {
		const user = await ctx.createContract(
			ctx.actor.id,
			ctx.session,
			'user@1.0.0',
			ctx.generateRandomWords(3),
			{
				hash: ctx.generateRandomID(),
				roles: [],
				avatar: ctx.generateRandomID(),
			},
		);

		const result = await handler(
			ctx.session,
			actionContext,
			user,
			makeRequest(ctx),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.avatar).toEqual(user.data.avatar);
	});

	test('should set avatar to null on invalid gravatar URL (single email)', async () => {
		const user: any = await ctx.createContract(
			ctx.actor.id,
			ctx.session,
			'user@1.0.0',
			ctx.generateRandomWords(3),
			{
				hash: ctx.generateRandomID(),
				roles: [],
				email: genEmail(),
			},
		);

		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email.trim())}?d=404`, 'HEAD')
			.reply(404, '');

		const result = await handler(
			ctx.session,
			actionContext,
			user,
			makeRequest(ctx),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.avatar).toBeNull();
	});

	test('should set avatar to null on invalid gravatar URL (email array)', async () => {
		const user: any = await ctx.createContract(
			ctx.actor.id,
			ctx.session,
			'user@1.0.0',
			ctx.generateRandomWords(3),
			{
				hash: ctx.generateRandomID(),
				roles: [],
				email: [genEmail(), genEmail()],
			},
		);

		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email[0].trim())}?d=404`, 'HEAD')
			.reply(404, '');
		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email[1].trim())}?d=404`, 'HEAD')
			.reply(404, '');

		const result = await handler(
			ctx.session,
			actionContext,
			user,
			makeRequest(ctx),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.avatar).toBeNull();
	});

	test('should set avatar on valid gravatar URL (single email)', async () => {
		const user: any = await ctx.createContract(
			ctx.actor.id,
			ctx.session,
			'user@1.0.0',
			ctx.generateRandomWords(3),
			{
				hash: ctx.generateRandomID(),
				roles: [],
				email: genEmail(),
			},
		);

		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email.trim())}?d=404`, 'HEAD')
			.reply(200, 'OK');

		const result = await handler(
			ctx.session,
			actionContext,
			user,
			makeRequest(ctx),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.avatar).toEqual(
			`https://www.gravatar.com/avatar/${md5(user.data.email.trim())}?d=404`,
		);
	});

	test('should set avatar on valid gravatar URL (first email in array)', async () => {
		const user: any = await ctx.createContract(
			ctx.actor.id,
			ctx.session,
			'user@1.0.0',
			ctx.generateRandomWords(3),
			{
				hash: ctx.generateRandomID(),
				roles: [],
				email: [genEmail(), genEmail()],
			},
		);

		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email[0].trim())}?d=404`, 'HEAD')
			.reply(200, 'OK');
		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email[1].trim())}?d=404`, 'HEAD')
			.reply(404, '');

		const result = await handler(
			ctx.session,
			actionContext,
			user,
			makeRequest(ctx),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.avatar).toEqual(
			`https://www.gravatar.com/avatar/${md5(user.data.email[0].trim())}?d=404`,
		);
	});

	test('should set avatar on valid gravatar URL (second email in array)', async () => {
		const user: any = await ctx.createContract(
			ctx.actor.id,
			ctx.session,
			'user@1.0.0',
			ctx.generateRandomWords(3),
			{
				hash: ctx.generateRandomID(),
				roles: [],
				email: [genEmail(), genEmail()],
			},
		);

		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email[0].trim())}?d=404`, 'HEAD')
			.reply(404, '');
		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email[1].trim())}?d=404`, 'HEAD')
			.reply(200, 'OK');

		const result = await handler(
			ctx.session,
			actionContext,
			user,
			makeRequest(ctx),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.avatar).toEqual(
			`https://www.gravatar.com/avatar/${md5(user.data.email[1].trim())}?d=404`,
		);
	});

	test('should set avatar when current data.avatar is null', async () => {
		const user: any = await ctx.createContract(
			ctx.actor.id,
			ctx.session,
			'user@1.0.0',
			ctx.generateRandomWords(3),
			{
				hash: ctx.generateRandomID(),
				roles: [],
				email: genEmail(),
				avatar: null,
			},
		);

		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(user.data.email.trim())}?d=404`, 'HEAD')
			.reply(200, 'OK');

		const result = await handler(
			ctx.session,
			actionContext,
			user,
			makeRequest(ctx),
		);
		expect(result).toEqual({
			id: user.id,
			slug: user.slug,
			version: user.version,
			type: user.type,
		});

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			user.id,
		);
		assert(updated);
		expect(updated.data.avatar).toEqual(
			`https://www.gravatar.com/avatar/${md5(user.data.email.trim())}?d=404`,
		);
	});
});
