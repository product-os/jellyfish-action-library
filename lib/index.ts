import { JellyfishPluginBase } from '@balena/jellyfish-plugin-base';
import actions from './actions';
// tslint:disable-next-line: no-var-requires
const { version } = require('../package.json');

/**
 * The Action Library Jellyfish plugin.
 */
class ActionLibrary extends JellyfishPluginBase {
	constructor() {
		super({
			slug: 'action-library',
			name: 'Action Library Plugin',
			version,
			actions,
		});
	}
}

export = ActionLibrary;
