import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { ProductOsPlugin } from '@balena/jellyfish-plugin-product-os';
import { integrationHelpers } from '@balena/jellyfish-test-harness';
import { WorkerContext } from '@balena/jellyfish-types/build/worker';
import bcrypt from 'bcrypt';
import { isArray, isNull } from 'lodash';
import { makeRequest } from './helpers';
import ActionLibrary from '../../../lib';
import { actionCreateSession } from '../../../lib/actions/action-create-session';
import { BCRYPT_SALT_ROUNDS } from '../../../lib/actions/constants';

const pre = actionCreateSession.pre;
const handler = actionCreateSession.handler;
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

describe('action-create-session', () => {
	test('should throw an error on invalid scope schema', async () => {
		expect.assertions(1);
		if (pre) {
			try {
				await pre(
					ctx.session,
					actionContext,
					makeRequest(ctx, {
						scope: ctx.generateRandomID(),
					}),
				);
			} catch (error: any) {
				expect(error.message).toEqual('Invalid schema for session scope');
			}
		}
	});

	test('should throw an error on invalid username', async () => {
		const request = makeRequest(ctx);
		request.card = ctx.generateRandomID();

		expect.assertions(1);
		if (pre) {
			try {
				await pre(ctx.session, actionContext, request);
			} catch (error: any) {
				expect(error.message).toEqual('Incorrect username or password');
			}
		}
	});

	test('should throw an error on invalid password', async () => {
		const user = await ctx.createUser(ctx.generateRandomWords(1));
		const request = makeRequest(ctx, {
			password: ctx.generateRandomID(),
		});
		request.card = user.contract.id;

		expect.assertions(1);
		if (pre) {
			try {
				await pre(ctx.session, actionContext, request);
			} catch (error: any) {
				expect(error.message).toEqual('Invalid password');
			}
		}
	});

	test('should return session arguments on success', async () => {
		const plaintext = ctx.generateRandomID();
		const hash = await bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS);
		const user = await ctx.createUser(ctx.generateRandomWords(1), hash);
		const request = makeRequest(ctx, {
			password: plaintext,
			scope: {
				type: 'object',
				properties: {
					slug: {
						type: 'string',
						const: user.contract.slug,
					},
				},
			},
		});
		request.card = user.contract.id;

		expect.assertions(1);
		if (pre) {
			const result = await pre(ctx.session, actionContext, request);
			if (!isNull(result) && !isArray(result)) {
				expect(result).toEqual({
					password: 'CHECKED IN PRE HOOK',
					scope: request.arguments.scope,
				});
			}
		}
	});

	test('should not store the password in the queue', async () => {
		const plaintext = ctx.generateRandomID();
		const hash = await bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS);
		const user = await ctx.createUser(ctx.generateRandomWords(1), hash);
		const request = await ctx.worker.pre(ctx.session, {
			action: 'action-create-session@1.0.0',
			context: ctx.context,
			card: user.contract.id,
			type: user.contract.type,
			arguments: {
				password: plaintext,
			},
		});
		await ctx.queue.producer.enqueue(ctx.worker.getId(), ctx.session, request);

		const dequeued: any = await ctx.dequeue();
		expect(dequeued).toBeTruthy();
		expect(dequeued.data.arguments.password).not.toBe(plaintext);
	});

	test('should throw an error on invalid user', async () => {
		const user = {
			id: ctx.generateRandomID(),
			name: ctx.generateRandomWords(3),
			slug: ctx.generateRandomSlug({
				prefix: 'user',
			}),
			type: 'user@1.0.0',
			version: '1.0.0',
			active: true,
			links: {},
			tags: [],
			markers: [],
			created_at: new Date().toISOString(),
			requires: [],
			capabilities: [],
			data: {
				hash: ctx.generateRandomID(),
				roles: [],
			},
		};

		expect.assertions(1);
		try {
			await handler(ctx.session, actionContext, user, makeRequest(ctx));
		} catch (error: any) {
			expect(error.message).toEqual(`No such user: ${user.id}`);
		}
	});

	test('should create a session on valid request', async () => {
		const plaintext = 'foobarbaz';
		const hash = await bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS);
		const user = await ctx.createUser(ctx.generateRandomWords(1), hash);

		expect.assertions(1);
		const result: any = await handler(
			ctx.session,
			actionContext,
			user.contract,
			makeRequest(ctx, {
				password: plaintext,
			}),
		);
		if (!isNull(result) && !isArray(result)) {
			expect(result.slug).toMatch(/^session-/);
		}
	});
});
