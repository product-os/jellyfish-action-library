import { Kernel, testUtils as coreTestUtils } from '@balena/jellyfish-core';
import {
	ActionContractDefinition,
	ActionHandlerRequest,
	ActionPreRequest,
	testUtils as workerTestUtils,
} from '@balena/jellyfish-worker';
import type { ActionData } from '@balena/jellyfish-types/build/core';
import { v4 as uuidv4 } from 'uuid';

export function makeHandlerRequest(
	context: workerTestUtils.TestContext,
	actionContract: ActionContractDefinition,
	requestArguments = {},
): ActionHandlerRequest {
	const contract = {
		id: coreTestUtils.generateRandomId(),
		...Kernel.defaults<ActionData>(actionContract),
	};

	return {
		action: contract,
		card: contract.slug,
		epoch: null,
		logContext: {
			id: `TEST-${uuidv4()}`,
		},
		timestamp: new Date().toISOString(),
		actor: context.adminUserId,
		originator: uuidv4(),
		arguments: requestArguments,
	};
}

export function makePreRequest(
	context: workerTestUtils.TestContext,
	actionContract: ActionContractDefinition,
	options: { card?: string; type?: string; requestArguments?: object } = {},
): ActionPreRequest {
	return {
		action: actionContract.slug,
		card: options.card || coreTestUtils.generateRandomId(),
		type: options.type || 'card@1.0.0',
		logContext: context.logContext,
		arguments: options.requestArguments || {},
	};
}

/**
 * Check that a given string exists within form data payload
 * @function
 *
 * @param key - parameter name to check for
 * @param value - value expected to be assigned to key
 * @param text - full form data payload
 * @returns boolean denoting if parameter information was found
 */
export function includes(key: string, value: string, text: string): boolean {
	const pattern = new RegExp(`name="${key}"\\s*${value}`, 'm');
	const regex = text.search(pattern);
	return regex !== -1;
}
