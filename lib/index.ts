/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { JellyfishPluginBase } from '@balena/jellyfish-plugin-base';
import { actions } from './actions';
// tslint:disable-next-line: no-var-requires
const { version } = require('../package.json');

export { mirror } from './actions';

/**
 * The Action Library Jellyfish plugin.
 */
export class ActionLibrary extends JellyfishPluginBase {
	constructor() {
		super({
			slug: 'action-library',
			name: 'Action Library Plugin',
			version,
			actions,
		});
	}
}
