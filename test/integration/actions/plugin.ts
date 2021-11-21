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
