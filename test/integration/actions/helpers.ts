import { v4 as uuidv4 } from 'uuid';

/**
 * @summary Generate and return an action request object
 * @function
 *
 * @param context - execution context
 * @param requestArguments - optional request arguments
 * @returns action request object
 */
export function makeRequest(context: any, requestArguments = {}): any {
	// the return value gets abused as two different request objects...
	return {
		context: {
			id: `TEST-${uuidv4()}`,
		},
		timestamp: new Date().toISOString(),
		actor: context.actor.id,
		originator: uuidv4(),
		arguments: requestArguments,
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
