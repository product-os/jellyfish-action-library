import { JellyfishPluginBase } from '@balena/jellyfish-plugin-base';
import * as actions from './actions';

// tslint:disable-next-line: no-var-requires
const { version } = require('../package.json');

export { actions };

/**
 * The Action Library Jellyfish plugin.
 */
export class ActionLibrary extends JellyfishPluginBase {
	constructor() {
		super({
			slug: 'action-library',
			name: 'Action Library Plugin',
			version,
			actions: Object.values(actions),
		});
	}
}
