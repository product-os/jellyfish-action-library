/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { defaultEnvironment as environment } from '@balena/jellyfish-environment';
import nock from 'nock';
import { v4 as uuidv4 } from 'uuid';
import {
	after,
	before,
	makeContext,
	makeFirstTimeLogin,
	makeRequest,
	makeUser,
} from './helpers';
import { actionCompleteFirstTimeLogin } from '../../../lib/actions/action-complete-first-time-login';
import { PASSWORDLESS_USER_HASH } from '../../../lib/actions/constants';
import { addLinkCard } from '../../../lib/actions/utils';

const handler = actionCompleteFirstTimeLogin.handler;
const context = makeContext();
const MAIL_OPTIONS = environment.mail.options;

const createOrgLinkAction = async ({
	fromId,
	toId,
	ctx,
}: {
	fromId: string;
	toId: string;
	ctx: any;
}) => {
	return {
		action: 'action-create-card@1.0.0',
		context: ctx,
		card: 'link',
		type: 'type',
		arguments: {
			reason: 'for testing',
			properties: {
				slug: `link-${fromId}-has-member-${toId}-${uuidv4()}`,
				version: '1.0.0',
				name: 'has member',
				data: {
					inverseName: 'is member of',
					to: {
						id: toId,
						type: 'user@1.0.0',
					},
					from: {
						id: fromId,
						type: 'org@1.0.0',
					},
				},
			},
		},
	};
};

// Create new user and link to test org
const createUser = async (withPassword: boolean) => {
	let user: any;
	const slug = context.generateRandomSlug({
		prefix: 'user',
	});
	const email = `${uuidv4()}@test.com`;
	if (withPassword) {
		const createUserAction = await context.worker.pre(context.session, {
			action: 'action-create-user@1.0.0',
			context: context.context,
			card: context.userTypeContract.id,
			type: context.userTypeContract.type,
			arguments: {
				email,
				password: uuidv4(),
				username: slug,
			},
		});
		user = await context.processAction(context.session, createUserAction);
	} else {
		user = await context.processAction(context.session, {
			action: 'action-create-card@1.0.0',
			context: context.context,
			card: context.userTypeContract.id,
			type: context.userTypeContract.type,
			arguments: {
				reason: 'for testing',
				properties: {
					slug,
					data: {
						email,
						hash: 'PASSWORDLESS',
						roles: ['user-community'],
					},
				},
			},
		});
	}

	// Link new user to test org
	const userOrgLinkAction = await createOrgLinkAction({
		toId: user.data.id,
		fromId: context.org.data.id,
		ctx: context.context,
	});
	await context.processAction(context.session, userOrgLinkAction);

	return user;
};

beforeAll(async () => {
	await before(context);

	nock(`${MAIL_OPTIONS!.baseUrl}/${MAIL_OPTIONS!.domain}`)
		.persist()
		.post('/messages')
		.basicAuth({
			user: 'api',
			pass: MAIL_OPTIONS!.token,
		})
		.reply(200);

	const orgTypeContract = await context.jellyfish.getCardBySlug(
		context.context,
		context.session,
		'org@latest',
	);
	expect(orgTypeContract).not.toBeNull();

	const userTypeContract = await context.jellyfish.getCardBySlug(
		context.context,
		context.session,
		'user@latest',
	);

	expect(userTypeContract).not.toBeNull();
	context.userTypeContract = userTypeContract;
	context.org = await context.processAction(context.session, {
		action: 'action-create-card@1.0.0',
		context: context.context,
		card: orgTypeContract.id,
		type: orgTypeContract.type,
		arguments: {
			reason: 'for testing',
			properties: {
				name: 'foobar',
			},
		},
	});

	// Get admin user and link to org
	const adminUser = await context.jellyfish.getCardBySlug(
		context.context,
		context.session,
		'user-admin@1.0.0',
	);

	expect(adminUser).not.toBeNull();

	const adminOrgLinkAction = await createOrgLinkAction({
		toId: adminUser.id,
		fromId: context.org.data.id,
		ctx: context.context,
	});
	await context.processAction(context.session, adminOrgLinkAction);
});

afterAll(async () => {
	nock.cleanAll();
	await after(context);
});

describe('action-complete-first-time-login', () => {
	test("should update the user's password when the firstTimeLoginToken is valid", async () => {
		const user = await createUser(false);

		await context.processAction(context.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: context.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {},
		});

		const [firstTimeLogin] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				properties: {
					type: {
						type: 'string',
						const: 'first-time-login@1.0.0',
					},
				},
			},
		);

		const newPassword = 'newPassword';

		const completeFirstTimeLoginAction = await context.worker.pre(
			context.session,
			{
				action: 'action-complete-first-time-login@1.0.0',
				context: context.context,
				card: user.data.id,
				type: user.data.type,
				arguments: {
					firstTimeLoginToken: firstTimeLogin.data.firstTimeLoginToken,
					newPassword,
				},
			},
		);

		await context.processAction(context.session, completeFirstTimeLoginAction);

		await expect(
			context.worker.pre(context.session, {
				action: 'action-create-session@1.0.0',
				card: user.data.id,
				type: user.data.type,
				context,
				arguments: {
					password: 'PASSWORDLESS',
				},
			}),
		).rejects.toThrow(context.worker.errors.WorkerAuthenticationError);

		const newPasswordLoginRequest = await context.worker.pre(context.session, {
			action: 'action-create-session@1.0.0',
			context: context.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {
				password: newPassword,
			},
		});

		const newPasswordLoginResult = await context.processAction(
			context.session,
			newPasswordLoginRequest,
		);
		expect(newPasswordLoginResult.error).toBe(false);
	});

	test('should fail when the first-time login does not match a valid card', async () => {
		const user = await createUser(false);

		const fakeToken = uuidv4();

		await expect(
			context.processAction(context.session, {
				action: 'action-complete-first-time-login@1.0.0',
				context: context.context,
				card: user.data.id,
				type: user.data.type,
				arguments: {
					firstTimeLoginToken: fakeToken,
					newPassword: 'new-password',
				},
			}),
		).rejects.toThrow(context.worker.errors.WorkerAuthenticationError);
	});

	test('should fail when the first-time login token has expired', async () => {
		const user = await createUser(false);

		await context.processAction(context.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: context.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {},
		});

		const [firstTimeLogin] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				additionalProperties: true,
				properties: {
					type: {
						type: 'string',
						const: 'first-time-login@1.0.0',
					},
				},
				$$links: {
					'is attached to': {
						type: 'object',
						properties: {
							id: {
								type: 'string',
								const: user.data.id,
							},
						},
					},
				},
			},
		);

		const now = new Date();
		const hourInPast = now.setHours(now.getHours() - 1);
		const newExpiry = new Date(hourInPast);

		await context.processAction(context.session, {
			action: 'action-update-card@1.0.0',
			context: context.context,
			card: firstTimeLogin.id,
			type: firstTimeLogin.type,
			arguments: {
				reason: 'Expiring for test',
				patch: [
					{
						op: 'replace',
						path: '/data/expiresAt',
						value: newExpiry.toISOString(),
					},
				],
			},
		});

		await expect(
			context.processAction(context.session, {
				action: 'action-complete-first-time-login@1.0.0',
				context: context.context,
				card: user.data.id,
				type: user.data.type,
				arguments: {
					firstTimeLoginToken: firstTimeLogin.data.firstTimeLoginToken,
					newPassword: 'new-password',
				},
			}),
		).rejects.toThrow(context.worker.errors.WorkerAuthenticationError);
	});

	test('should fail when the first-time login is not active', async () => {
		const user = await createUser(false);

		await context.processAction(context.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: context.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {},
		});

		const [firstTimeLogin] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				properties: {
					type: {
						type: 'string',
						const: 'first-time-login@1.0.0',
					},
				},
			},
		);

		await context.processAction(context.session, {
			action: 'action-delete-card@1.0.0',
			context: context.context,
			card: firstTimeLogin.id,
			type: firstTimeLogin.type,
			arguments: {},
		});

		await expect(
			context.processAction(context.session, {
				action: 'action-complete-first-time-login@1.0.0',
				context: context.context,
				card: user.data.id,
				type: user.data.type,
				arguments: {
					firstTimeLoginToken: firstTimeLogin.data.firstTimeLoginToken,
					newPassword: 'new-password',
				},
			}),
		).rejects.toThrow(context.worker.errors.WorkerAuthenticationError);
	});

	test('should fail if the user becomes inactive between requesting and completing the first-time login', async () => {
		const user = await createUser(false);

		await context.processAction(context.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: context.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {
				username: user.data.slug,
			},
		});

		await context.processAction(context.session, {
			action: 'action-delete-card@1.0.0',
			context: context.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {},
		});

		const [firstTimeLogin] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				properties: {
					type: {
						type: 'string',
						const: 'first-time-login@1.0.0',
					},
				},
				required: ['type'],
				additionalProperties: true,
			},
		);

		const completePasswordReset = await context.worker.pre(context.session, {
			action: 'action-complete-first-time-login@1.0.0',
			context: context.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {
				firstTimeLoginToken: firstTimeLogin.data.firstTimeLoginToken,
				newPassword: 'new-password',
			},
		});

		await expect(
			context.processAction(context.session, completePasswordReset),
		).rejects.toThrow(context.worker.errors.WorkerAuthenticationError);
	});

	test('should invalidate the first-time-login card', async () => {
		// Attach first time login contract to user without a password
		const user = await context.kernel.insertCard(
			context.context,
			context.session,
			makeUser({
				hash: PASSWORDLESS_USER_HASH,
			}),
		);
		const firstTimeLogin = await context.kernel.insertCard(
			context.context,
			context.session,
			makeFirstTimeLogin(),
		);
		await addLinkCard(context, makeRequest(context), firstTimeLogin, user);

		// Create request with new random password
		const request = makeRequest(context, {
			firstTimeLoginToken: firstTimeLogin.data.firstTimeLoginToken,
			newPassword: uuidv4(),
		});

		// Execute action and check that the first time login contract was invalidated
		await handler(context.session, context, user, request);
		const updated = await context.getCardById(
			context.privilegedSession,
			firstTimeLogin.id,
		);
		expect(updated.active).toBe(false);
	});

	test('should throw an error when the user already has a password set', async () => {
		const user = await createUser(true);

		await context.processAction(context.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: context.context,
			card: user.data.id,
			type: user.data.type,
			arguments: {},
		});

		const [firstTimeLogin] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				properties: {
					type: {
						type: 'string',
						const: 'first-time-login@1.0.0',
					},
				},
				$$links: {
					'is attached to': {
						type: 'object',
						properties: {
							id: {
								type: 'string',
								const: user.data.id,
							},
						},
					},
				},
			},
		);

		await expect(
			context.processAction(context.session, {
				action: 'action-complete-first-time-login@1.0.0',
				context: context.context,
				card: user.data.id,
				type: user.data.type,
				arguments: {
					firstTimeLoginToken: firstTimeLogin.data.firstTimeLoginToken,
					newPassword: 'new-password',
				},
			}),
		).rejects.toThrow(context.worker.errors.WorkerAuthenticationError);
	});
});
