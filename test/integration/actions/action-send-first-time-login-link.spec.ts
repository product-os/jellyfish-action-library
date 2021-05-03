/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { defaultEnvironment } from '@balena/jellyfish-environment';
import nock from 'nock';
import { v4 as uuidv4 } from 'uuid';
import { actionSendFirstTimeLoginLink } from '../../../lib/actions/action-send-first-time-login-link';
import {
	after,
	before,
	includes,
	makeContext,
	makeFirstTimeLogin,
	makeRequest,
	makeUser,
} from './helpers';

const handler = actionSendFirstTimeLoginLink.handler;
const context = makeContext();
const MAIL_OPTIONS = defaultEnvironment.mail.options;

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

beforeAll(async () => {
	await before(context);
	context.userEmail = 'test@test.com';
	context.userTypeContract = await context.jellyfish.getCardBySlug(
		context.context,
		context.session,
		'user@latest',
	);

	expect(context.userTypeContract).not.toBeNull();

	context.orgTypeContract = await context.jellyfish.getCardBySlug(
		context.context,
		context.session,
		'org@latest',
	);

	expect(context.orgTypeContract).not.toBeNull();

	context.adminUser = await context.jellyfish.getCardBySlug(
		context.context,
		context.session,
		'user-admin@1.0.0',
	);
	expect(context.adminUser).not.toBeNull();
});

beforeEach(async () => {
	context.nockRequest = () => {
		nock(`${MAIL_OPTIONS!.baseUrl}/${MAIL_OPTIONS!.domain}`)
			.persist()
			.post('/messages')
			.basicAuth({
				user: 'api',
				pass: MAIL_OPTIONS!.token,
			})
			.reply(200, (_uri, sendBody) => {
				context.mailBody = sendBody;
			});
	};

	// Create user
	context.username = context.generateRandomSlug();
	const createUserAction = await context.worker.pre(context.session, {
		action: 'action-create-user@1.0.0',
		context: context.context,
		card: context.userTypeContract.id,
		type: context.userTypeContract.type,
		arguments: {
			username: `user-${context.username}`,
			password: 'foobarbaz',
			email: context.userEmail,
		},
	});
	context.user = await context.processAction(context.session, createUserAction);

	// Create org
	context.org = await context.processAction(context.session, {
		action: 'action-create-card@1.0.0',
		context: context.context,
		card: context.orgTypeContract.id,
		type: context.orgTypeContract.type,
		arguments: {
			reason: 'for testing',
			properties: {
				name: 'foobar',
			},
		},
	});

	// Link user to org
	const userOrgLinkAction = await createOrgLinkAction({
		toId: context.user.data.id,
		fromId: context.org.data.id,
		ctx: context.context,
	});
	await context.processAction(context.session, userOrgLinkAction);

	// Link admin user to org
	const adminOrgLinkAction = await createOrgLinkAction({
		toId: context.adminUser.id,
		fromId: context.org.data.id,
		ctx: context.context,
	});
	context.adminOrgLink = await context.processAction(
		context.session,
		adminOrgLinkAction,
	);
});

afterEach(async () => {
	nock.cleanAll();
	await context.processAction(context.session, {
		action: 'action-delete-card@1.0.0',
		context: context.context,
		card: context.adminOrgLink.data.id,
		type: context.adminOrgLink.data.type,
		arguments: {},
	});
});

afterAll(async () => {
	await after(context);
});

describe('action-send-first-time-login-link', () => {
	test('should throw an error if the user does not have an email address', async () => {
		await context.kernel.insertCard(
			context.context,
			context.session,
			makeFirstTimeLogin(),
		);
		const request = makeRequest(context);

		expect.assertions(5);
		const user = makeUser();
		try {
			await handler(context.session, context, user, request);
		} catch (error) {
			expect(error.message).toEqual(
				`User with slug ${user.slug} does not have an email address`,
			);
		}

		try {
			user.data.email = [];
			await handler(context.session, context, user, request);
		} catch (error) {
			expect(error.message).toEqual(
				`User with slug ${user.slug} does not have an email address`,
			);
		}
	});

	test('should create a first-time login card and user link for a user', async () => {
		context.nockRequest();

		const sendFirstTimeLogin = await context.processAction(context.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: context.context,
			card: context.user.data.id,
			type: context.user.data.type,
			arguments: {},
		});

		expect(sendFirstTimeLogin.error).toBe(false);

		const [firstTimeLogin] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				required: ['type'],
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
								const: context.user.data.id,
							},
						},
					},
				},
			},
			{
				limit: 1,
			},
		);

		expect(firstTimeLogin).toBeTruthy();
		expect(firstTimeLogin.links).toBeTruthy();
		expect(new Date((firstTimeLogin.data as any).expiresAt) > new Date()).toBe(
			true,
		);
		expect(firstTimeLogin.links['is attached to'][0].id).toBe(
			context.user.data.id,
		);
	});

	test('should send a first-time-login email to a user', async () => {
		context.mailBody = '';
		context.nockRequest();

		const sendFirstTimeLoginAction = {
			action: 'action-send-first-time-login-link@1.0.0',
			context: context.context,
			card: context.user.data.id,
			type: context.user.data.type,
			arguments: {},
		};

		const sendFirstTimeLogin = await context.processAction(
			context.session,
			sendFirstTimeLoginAction,
		);
		expect(sendFirstTimeLogin.error).toBe(false);

		const [firstTimeLogin] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				required: ['type', 'data'],
				additionalProperties: false,
				properties: {
					type: {
						type: 'string',
						const: 'first-time-login@1.0.0',
					},
					data: {
						type: 'object',
						properties: {
							firstTimeLoginToken: {
								type: 'string',
							},
						},
					},
				},
				$$links: {
					'is attached to': {
						type: 'object',
						properties: {
							id: {
								type: 'string',
								const: context.user.data.id,
							},
						},
					},
				},
			},
			{
				limit: 1,
			},
		);

		const firstTimeLoginUrl = `https://jel.ly.fish/first_time_login/${firstTimeLogin.data.firstTimeLoginToken}/${context.username}`;
		const expectedEmailBody = `<p>Hello,</p><p>Here is a link to login to your new Jellyfish account ${context.username}.</p><p>Please use the link below to set your password and login:</p><a href="${firstTimeLoginUrl}">${firstTimeLoginUrl}</a><p>Cheers</p><p>Jellyfish Team</p><a href="https://jel.ly.fish">https://jel.ly.fish</a>`;

		expect(includes('to', context.userEmail, context.mailBody)).toBe(true);
		expect(includes('from', 'no-reply@mail.ly.fish', context.mailBody)).toBe(
			true,
		);
		expect(
			includes('subject', 'Jellyfish First Time Login', context.mailBody),
		).toBe(true);
		expect(includes('html', expectedEmailBody, context.mailBody)).toBe(true);
	});

	test('should throw error if the user is inactive', async () => {
		context.nockRequest();

		const requestDelete = await context.processAction(context.session, {
			action: 'action-delete-card@1.0.0',
			context: context.context,
			card: context.user.data.id,
			type: context.user.data.type,
			arguments: {},
		});
		expect(requestDelete.error).toBe(false);

		const sendFirstTimeLoginAction = {
			action: 'action-send-first-time-login-link@1.0.0',
			context: context.context,
			card: context.user.data.id,
			type: context.user.data.type,
			arguments: {},
		};

		await expect(
			context.processAction(context.session, sendFirstTimeLoginAction),
		).rejects.toThrow(context.worker.errors.WorkerNoElement);
	});

	test('should invalidate previous first-time logins', async () => {
		context.nockRequest();

		const sendFirstTimeLoginAction = {
			action: 'action-send-first-time-login-link@1.0.0',
			context: context.context,
			card: context.user.data.id,
			type: context.user.data.type,
			arguments: {},
		};

		const firstPasswordResetRequest = await context.processAction(
			context.session,
			sendFirstTimeLoginAction,
		);
		expect(firstPasswordResetRequest.error).toBe(false);

		const secondPasswordResetRequest = await context.processAction(
			context.session,
			sendFirstTimeLoginAction,
		);
		expect(secondPasswordResetRequest.error).toBe(false);

		const firstTimeLogins = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				required: ['type'],
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
								const: context.user.data.id,
							},
						},
					},
				},
			},
			{
				sortBy: 'created_at',
			},
		);

		expect(firstTimeLogins.length).toBe(2);
		expect(firstTimeLogins[0].active).toBe(false);
		expect(firstTimeLogins[1].active).toBe(true);
	});

	test('should not invalidate previous first-time logins from other users', async () => {
		context.nockRequest();

		const otherUsername = 'janedoe';

		const createUserAction = await context.worker.pre(context.session, {
			action: 'action-create-user@1.0.0',
			context: context.context,
			card: context.userTypeContract.id,
			type: context.userTypeContract.type,
			arguments: {
				email: 'other@user.com',
				username: `user-${otherUsername}`,
				password: 'apassword',
			},
		});

		const otherUser = await context.processAction(
			context.session,
			createUserAction,
		);
		expect(otherUser.error).toBe(false);

		const linkAction = await createOrgLinkAction({
			toId: otherUser.data.id,
			fromId: context.org.data.id,
			ctx: context.context,
		});

		await context.processAction(context.session, linkAction);

		await context.processAction(context.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: context.context,
			card: otherUser.data.id,
			type: otherUser.data.type,
			arguments: {},
		});

		await context.processAction(context.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: context.context,
			card: context.user.data.id,
			type: context.user.data.type,
			arguments: {},
		});

		const firstTimeLogins = await context.jellyfish.query(
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
					active: {
						type: 'boolean',
					},
				},
				$$links: {
					'is attached to': {
						type: 'object',
						properties: {
							id: {
								type: 'string',
								enum: [context.user.data.id, otherUser.data.id],
							},
						},
					},
				},
			},
			{
				sortBy: 'created_at',
			},
		);

		expect(firstTimeLogins.length).toBe(2);
		expect(firstTimeLogins[0].active).toBe(true);
	});

	test('successfully sends an email to a user with an array of emails', async () => {
		context.mailBody = '';
		context.nockRequest();

		const firstEmail = 'first@email.com';
		const secondEmail = 'second@email.com';
		const newUsername = context.generateRandomSlug();

		const createUserAction = await context.worker.pre(context.session, {
			action: 'action-create-user@1.0.0',
			context: context.context,
			card: context.userTypeContract.id,
			type: context.userTypeContract.type,
			arguments: {
				email: firstEmail,
				username: `user-${newUsername}`,
				password: 'foobarbaz',
			},
		});

		const newUser = await context.processAction(
			context.session,
			createUserAction,
		);
		expect(newUser.error).toBe(false);

		const sendUpdateCard = {
			action: 'action-update-card@1.0.0',
			context: context.context,
			card: newUser.data.id,
			type: newUser.data.type,
			arguments: {
				reason: 'Making email an array for test',
				patch: [
					{
						op: 'replace',
						path: '/data/email',
						value: [firstEmail, secondEmail],
					},
				],
			},
		};

		const sendUpdate = await context.processAction(
			context.session,
			sendUpdateCard,
		);
		expect(sendUpdate.error).toBe(false);

		const userWithEmailArray = await context.jellyfish.getCardById(
			context.context,
			context.session,
			newUser.data.id,
		);

		expect(userWithEmailArray).not.toBeNull();
		expect(userWithEmailArray.data.email).toEqual([firstEmail, secondEmail]);

		const linkAction = await createOrgLinkAction({
			toId: newUser.data.id,
			fromId: context.org.data.id,
			ctx: context.context,
		});

		await context.processAction(context.session, linkAction);

		const firstTimeLoginRequest = {
			action: 'action-send-first-time-login-link@1.0.0',
			context: context.context,
			card: newUser.data.id,
			type: newUser.data.type,
			arguments: {},
		};

		const firstTimeLogin = await context.processAction(
			context.session,
			firstTimeLoginRequest,
		);

		expect(firstTimeLogin.error).toBe(false);
		expect(includes('to', firstEmail, context.mailBody)).toBe(true);
	});

	test('throws an error when the first-time-login user has no org', async () => {
		context.nockRequest();

		const userSlug = context.generateRandomSlug({
			prefix: 'user',
		});

		const createUserAction = await context.worker.pre(context.session, {
			action: 'action-create-user@1.0.0',
			context: context.context,
			card: context.userTypeContract.id,
			type: context.userTypeContract.type,
			arguments: {
				email: 'new@email.com',
				username: userSlug,
				password: 'foobarbaz',
			},
		});

		const newUser = await context.processAction(
			context.session,
			createUserAction,
		);
		expect(newUser.error).toBe(false);

		await expect(
			context.processAction(context.session, {
				action: 'action-send-first-time-login-link@1.0.0',
				context: context.context,
				card: newUser.data.id,
				type: newUser.data.type,
				arguments: {},
			}),
		).rejects.toThrow(context.worker.errors.WorkerNoElement);
	});

	test('throws an error when the first-time-login requester has no org', async () => {
		context.nockRequest();

		await context.processAction(context.session, {
			action: 'action-delete-card@1.0.0',
			context: context.context,
			card: context.adminOrgLink.data.id,
			type: context.adminOrgLink.data.type,
			arguments: {},
		});

		await expect(
			context.processAction(context.session, {
				action: 'action-send-first-time-login-link@1.0.0',
				context: context.context,
				card: context.user.data.id,
				type: context.user.data.type,
				arguments: {},
			}),
		).rejects.toThrow(context.worker.errors.WorkerNoElement);
	});

	test("throws an error when the first-time-login user does not belong to the requester's org", async () => {
		context.nockRequest();

		const userSlug = context.generateRandomSlug({
			prefix: 'user',
		});
		const userPassword = 'foobarbaz';

		const createUserAction = await context.worker.pre(context.session, {
			action: 'action-create-user@1.0.0',
			context: context.context,
			card: context.userTypeContract.id,
			type: context.userTypeContract.type,
			arguments: {
				email: 'new@email.com',
				username: userSlug,
				password: userPassword,
			},
		});

		const newUser = await context.processAction(
			context.session,
			createUserAction,
		);
		expect(newUser.error).toBe(false);

		const newOrg = await context.processAction(context.session, {
			action: 'action-create-card@1.0.0',
			context: context.context,
			card: context.orgTypeContract.id,
			type: context.orgTypeContract.type,
			arguments: {
				reason: 'for testing',
				properties: {
					name: 'foobar',
				},
			},
		});

		const linkAction = await createOrgLinkAction({
			toId: newUser.data.id,
			fromId: newOrg.data.id,
			ctx: context.context,
		});

		await context.processAction(context.session, linkAction);

		await expect(
			context.processAction(context.session, {
				action: 'action-send-first-time-login-link@1.0.0',
				context: context.context,
				card: newUser.data.id,
				type: newUser.data.type,
				arguments: {},
			}),
		).rejects.toThrow(context.worker.errors.WorkerAuthenticationError);
	});

	test('a community role is added to a supplied user with no role set', async () => {
		context.nockRequest();

		const createUserAction = await context.worker.pre(context.session, {
			action: 'action-create-card@1.0.0',
			context: context.context,
			card: context.userTypeContract.id,
			type: context.userTypeContract.type,
			arguments: {
				reason: 'for testing',
				properties: {
					slug: context.generateRandomSlug({
						prefix: 'user',
					}),
					data: {
						hash: 'fake-hash',
						email: 'fake@email.com',
						roles: [],
					},
				},
			},
		});

		const userWithoutRole = await context.processAction(
			context.session,
			createUserAction,
		);
		expect(userWithoutRole.error).toBe(false);

		const linkAction = await createOrgLinkAction({
			toId: userWithoutRole.data.id,
			fromId: context.org.data.id,
			ctx: context.context,
		});

		await context.processAction(context.session, linkAction);

		await context.processAction(context.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: context.context,
			card: userWithoutRole.data.id,
			type: userWithoutRole.data.type,
			arguments: {},
		});

		const updatedUser = await context.jellyfish.getCardById(
			context.context,
			context.session,
			userWithoutRole.data.id,
		);

		expect(updatedUser).not.toBeNull();
		expect(updatedUser.data.roles).toEqual(['user-community']);
	});

	test('a community role is added to a supplied user when it is not present in the roles field', async () => {
		context.nockRequest();

		const createUserAction = await context.worker.pre(context.session, {
			action: 'action-create-card@1.0.0',
			context: context.context,
			card: context.userTypeContract.id,
			type: context.userTypeContract.type,
			arguments: {
				reason: 'for testing',
				properties: {
					slug: context.generateRandomSlug({
						prefix: 'user',
					}),
					data: {
						hash: 'fake-hash',
						email: 'fake@email.com',
						roles: ['user-external-support'],
					},
				},
			},
		});

		const userWithoutRole = await context.processAction(
			context.session,
			createUserAction,
		);
		expect(userWithoutRole.error).toBe(false);

		const linkAction = await createOrgLinkAction({
			toId: userWithoutRole.data.id,
			fromId: context.org.data.id,
			ctx: context.context,
		});

		await context.processAction(context.session, linkAction);

		await context.processAction(context.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: context.context,
			card: userWithoutRole.data.id,
			type: userWithoutRole.data.type,
			arguments: {},
		});

		const updatedUser = await context.jellyfish.getCardById(
			context.context,
			context.session,
			userWithoutRole.data.id,
		);

		expect(updatedUser).not.toBeNull();
		expect(updatedUser.data.roles).toEqual([
			'user-external-support',
			'user-community',
		]);
	});
});
