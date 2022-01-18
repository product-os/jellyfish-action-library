import type { PluginDefinition } from '@balena/jellyfish-worker';
import { version } from '../package.json';
import { actions } from './actions';

/**
 * The Action Library Jellyfish plugin.
 */
export const actionLibrary: PluginDefinition = {
	slug: 'action-library',
	name: 'Action Library Plugin',
	version,
	actions,
};
