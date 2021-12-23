import type { Integration } from '@balena/jellyfish-plugin-base';
import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';

const SLUG = 'foobar';

module.exports = class FoobarIntegration implements Integration {
	private options: any;
	public slug = SLUG;

	constructor(options: any) {
		this.options = options || {};
	}

	public async initialize() {
		return Promise.resolve(this.options);
	}

	public async destroy() {
		return Promise.resolve(this.options);
	}

	public async translate(_event: any): Promise<any> {
		return [
			{
				time: new Date(),
				actor: uuidv4(),
				card: {
					slug: `card-${uuidv4()}`,
					type: 'card@1.0.0',
					version: '1.0.0',
					data: {},
				},
			},
		];
	}

	public async mirror(_card: any, options: any): Promise<any> {
		return [
			{
				time: new Date(),
				actor: options.actor,
				card: {
					slug: `card-${uuidv4()}`,
					type: 'card@1.0.0',
					version: '1.0.0',
					data: {},
				},
			},
		];
	}
};

module.exports.slug = SLUG;

module.exports.OAUTH_BASE_URL = 'http://api.foobar.com';

module.exports.OAUTH_SCOPES = ['foo.all', 'bar.all'];

module.exports.whoami = _.constant(null);

module.exports.match = async (
	_context: any,
	_externalUser: any,
	_options: any,
) => {
	return {
		slug: `user-${uuidv4()}`,
		type: 'user@1.0.0',
		version: '1.0.0',
		data: {},
	};
};
