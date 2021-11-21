import { defaultEnvironment } from '@balena/jellyfish-environment';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { WorkerContext } from '@balena/jellyfish-types/build/worker';
import { strict as assert } from 'assert';
import nock from 'nock';
import ActionLibrary from '../../../lib';
import { actionSendFirstTimeLoginLink } from '../../../lib/actions/action-send-first-time-login-link';
import { includes, makeRequest } from './helpers';

const MAIL_OPTIONS = defaultEnvironment.mail.options;
let mailBody: string = '';
let balenaOrg: any;

const handler = actionSendFirstTimeLoginLink.handler;
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

	// Get org and add test user as member
	balenaOrg = await ctx.jellyfish.getCardBySlug(
		ctx.context,
		ctx.session,
		'org-balena@1.0.0',
	);
	assert(balenaOrg);
	await ctx.createLink(
		ctx.actor.id,
		ctx.session,
		ctx.actor,
		balenaOrg,
		'is member of',
		'has member',
	);
});

afterAll(async () => {
	return integrationHelpers.after(ctx);
});

afterEach(async () => {
	nock.cleanAll();
});

function nockRequest() {
	nock(`${MAIL_OPTIONS!.baseUrl}/${MAIL_OPTIONS!.domain}`)
		.persist()
		.post('/messages')
		.basicAuth({
			user: 'api',
			pass: MAIL_OPTIONS!.token,
		})
		.reply(200, (_uri: string, sendBody: string) => {
			mailBody = sendBody;
		});
}

describe('action-send-first-time-login-link', () => {
	test('should throw an error if the user does not have an email address', async () => {
		const user = await ctx.createUser(ctx.generateRandomWords(1));
		user.contract.data.email = [];

		await expect(
			handler(ctx.session, actionContext, user.contract, makeRequest(ctx)),
		).rejects.toThrow(
			new Error(
				`User with slug ${user.contract.slug} does not have an email address`,
			),
		);
	});

	test('should create a first-time login contract for a user', async () => {
		nockRequest();
		const user = await ctx.createUser(ctx.generateRandomWords(1));
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		const sendFirstTimeLogin = await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {},
		});
		expect(sendFirstTimeLogin.error).toBe(false);

		const match = await ctx.waitForMatch({
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
							const: user.contract.id,
						},
					},
				},
			},
		});
		expect(new Date((match.data as any).expiresAt) > new Date()).toBe(true);
	});

	test('should send a first-time-login email to a user', async () => {
		mailBody = '';
		nockRequest();
		const username = ctx.generateRandomWords(1);
		const user = await ctx.createUser(username);
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);
		const email = (user.contract.data as any).email[0];

		const sendFirstTimeLogin = await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {},
		});
		expect(sendFirstTimeLogin.error).toBe(false);

		const match = await ctx.waitForMatch({
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
							const: user.contract.id,
						},
					},
				},
			},
		});

		const firstTimeLoginUrl = `https://jel.ly.fish/first_time_login/${match.data.firstTimeLoginToken}/${username}`;
		const expectedEmailBody = `<p>Hello,</p><p>Here is a link to login to your new Jellyfish account ${username}.</p><p>Please use the link below to set your password and login:</p><a href="${firstTimeLoginUrl}">${firstTimeLoginUrl}</a><p>Cheers</p><p>Jellyfish Team</p><a href="https://jel.ly.fish">https://jel.ly.fish</a>`;

		expect(includes('to', email, mailBody)).toBe(true);
		expect(includes('from', 'no-reply@mail.ly.fish', mailBody)).toBe(true);
		expect(includes('subject', 'Jellyfish First Time Login', mailBody)).toBe(
			true,
		);
		expect(includes('html', expectedEmailBody, mailBody)).toBe(true);
	});

	test('should throw error if the user is inactive', async () => {
		nockRequest();
		const user = await ctx.createUser(ctx.generateRandomWords(1));
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		const requestDelete = await ctx.processAction(ctx.session, {
			action: 'action-delete-card@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {},
		});
		expect(requestDelete.error).toBe(false);

		const sendFirstTimeLoginAction = {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {},
		};

		await expect(
			ctx.processAction(ctx.session, sendFirstTimeLoginAction),
		).rejects.toThrow(ctx.worker.errors.WorkerNoElement);
	});

	test('should invalidate previous first-time logins', async () => {
		nockRequest();
		const user = await ctx.createUser(ctx.generateRandomWords(1));
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		const sendFirstTimeLoginAction = {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {},
		};

		const firstPasswordResetRequest = await ctx.processAction(
			ctx.session,
			sendFirstTimeLoginAction,
		);
		expect(firstPasswordResetRequest.error).toBe(false);

		const secondPasswordResetRequest = await ctx.processAction(
			ctx.session,
			sendFirstTimeLoginAction,
		);
		expect(secondPasswordResetRequest.error).toBe(false);

		const firstTimeLogins = await ctx.jellyfish.query(
			ctx.context,
			ctx.session,
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
								const: user.contract.id,
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
		nockRequest();
		const firstUser = await ctx.createUser(ctx.generateRandomWords(1));
		const secondUser = await ctx.createUser(ctx.generateRandomWords(1));
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			firstUser.contract,
			balenaOrg,
			'is member of',
			'has member',
		);
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			secondUser.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: firstUser.contract.id,
			type: firstUser.contract.type,
			arguments: {},
		});

		await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: secondUser.contract.id,
			type: secondUser.contract.type,
			arguments: {},
		});

		const firstTimeLogins = await ctx.jellyfish.query(
			ctx.context,
			ctx.session,
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
								enum: [firstUser.contract.id, secondUser.contract.id],
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
		expect(firstTimeLogins[1].active).toBe(true);
	});

	test('successfully sends an email to a user with an array of emails', async () => {
		mailBody = '';
		nockRequest();
		const user = await ctx.createUser(ctx.generateRandomWords(1));
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);
		const emails = [
			`${ctx.generateRandomWords(1)}@example.com`,
			`${ctx.generateRandomWords(1)}@example.com`,
		];

		// Update user emails
		await ctx.worker.patchCard(
			ctx.context,
			ctx.session,
			ctx.worker.typeContracts[user.contract.type],
			{
				attachEvents: true,
				actor: ctx.actor.id,
			},
			user.contract,
			[
				{
					op: 'replace',
					path: '/data/email',
					value: emails,
				},
			],
		);
		await ctx.flushAll(ctx.session);

		const firstTimeLogin = await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {},
		});

		expect(firstTimeLogin.error).toBe(false);
		expect(includes('to', emails[0], mailBody)).toBe(true);
	});

	test('throws an error when the first-time-login user has no org', async () => {
		nockRequest();
		const user = await ctx.createUser(ctx.generateRandomWords(1));

		await expect(
			ctx.processAction(ctx.session, {
				action: 'action-send-first-time-login-link@1.0.0',
				context: ctx.context,
				card: user.contract.id,
				type: user.contract.type,
				arguments: {},
			}),
		).rejects.toThrow(ctx.worker.errors.WorkerNoElement);
	});

	test('throws an error when the first-time-login requester has no org', async () => {
		nockRequest();
		const requester = await ctx.createUser(ctx.generateRandomWords(1));
		const user = await ctx.createUser(ctx.generateRandomWords(1));
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		await expect(
			ctx.processAction(requester.session, {
				action: 'action-send-first-time-login-link@1.0.0',
				context: ctx.context,
				card: user.contract.id,
				type: user.contract.type,
				arguments: {},
			}),
		).rejects.toThrow(ctx.worker.errors.WorkerNoElement);
	});

	test("throws an error when the first-time-login user does not belong to the requester's org", async () => {
		nockRequest();
		const newOrg = await ctx.createContract(
			ctx.actor.id,
			ctx.session,
			'org@1.0.0',
			ctx.generateRandomWords(1),
			{},
		);
		const user = await ctx.createUser(ctx.generateRandomWords(1));
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			newOrg,
			'is member of',
			'has member',
		);

		await expect(
			ctx.processAction(ctx.session, {
				action: 'action-send-first-time-login-link@1.0.0',
				context: ctx.context,
				card: user.contract.id,
				type: user.contract.type,
				arguments: {},
			}),
		).rejects.toThrow(ctx.worker.errors.WorkerAuthenticationError);
	});

	test('community role is added to a supplied user with no role set', async () => {
		nockRequest();
		const user = await ctx.createUser(ctx.generateRandomWords(1));
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		// Update user roles
		await ctx.worker.patchCard(
			ctx.context,
			ctx.session,
			ctx.worker.typeContracts[user.contract.type],
			{
				attachEvents: true,
				actor: ctx.actor.id,
			},
			user.contract,
			[
				{
					op: 'replace',
					path: '/data/roles',
					value: [],
				},
			],
		);
		await ctx.flushAll(ctx.session);

		await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {},
		});

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			user.contract.id,
		);
		assert(updated);
		expect(updated.data.roles).toEqual(['user-community']);
	});

	test('roles should be set to community role when community role is not present', async () => {
		nockRequest();
		const user = await ctx.createUser(ctx.generateRandomWords(1));
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		// Update user roles
		await ctx.worker.patchCard(
			ctx.context,
			ctx.session,
			ctx.worker.typeContracts[user.contract.type],
			{
				attachEvents: true,
				actor: ctx.actor.id,
			},
			user.contract,
			[
				{
					op: 'replace',
					path: '/data/roles',
					value: ['user-external-support'],
				},
			],
		);
		await ctx.flushAll(ctx.session);

		await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {},
		});

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			user.contract.id,
		);
		assert(updated);
		expect(updated.data.roles).toEqual(['user-community']);
	});

	test('roles should not be updated when community role is present', async () => {
		nockRequest();
		const user = await ctx.createUser(ctx.generateRandomWords(1));
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			user.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		// Update user roles
		const roles = ['user-operator', 'user-community'];
		await ctx.worker.patchCard(
			ctx.context,
			ctx.session,
			ctx.worker.typeContracts[user.contract.type],
			{
				attachEvents: true,
				actor: ctx.actor.id,
			},
			user.contract,
			[
				{
					op: 'replace',
					path: '/data/roles',
					value: roles,
				},
			],
		);
		await ctx.flushAll(ctx.session);

		await ctx.processAction(ctx.session, {
			action: 'action-send-first-time-login-link@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {},
		});

		const updated = await ctx.jellyfish.getCardById(
			ctx.context,
			ctx.session,
			user.contract.id,
		);
		assert(updated);
		expect(updated.data.roles).toEqual(roles);
	});

	test('users with the "user-community" role cannot send a first-time login link to another user', async () => {
		const targetUser = await ctx.createUser(ctx.generateRandomID());
		const communityUser = await ctx.createUser(ctx.generateRandomID());
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			targetUser.contract,
			balenaOrg,
			'is member of',
			'has member',
		);
		await ctx.createLink(
			ctx.actor.id,
			ctx.session,
			communityUser.contract,
			balenaOrg,
			'is member of',
			'has member',
		);

		await expect(
			handler(
				communityUser.session,
				actionContext,
				targetUser.contract,
				makeRequest(ctx),
			),
		).rejects.toThrow(
			new ctx.worker.errors.WorkerNoElement('No such type: first-time-login'),
		);
	});
});
