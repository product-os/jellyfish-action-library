/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { JellyfishPluginBase } from '@balena/jellyfish-plugin-base';
import integrations from './integrations';

/**
 * The Foobar Jellyfish plugin.
 */
export class FoobarPlugin extends JellyfishPluginBase {
	constructor() {
		super({
			slug: 'jellyfish-plugin-foobar',
			name: 'Foobar Plugin',
			version: '1.0.0',
			integrations,
			requires: [],
		});
	}
}
