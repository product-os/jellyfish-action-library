/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const _ = require('lodash')
const jsonpatch = require('fast-json-patch')
const skhema = require('skhema')
const typedErrors = require('typed-errors')
const uuid = require('uuid')
const cards = require('@balena/jellyfish-core/lib/cards')

/**
 * @summary Create card base skeleton
 * @function
 *
 * @param {String} type - card type
 * @param {Object} data - optional card data
 * @param {String} slug - optional card slug
 * @returns {Object} card object
 */
const makeCard = (type, data = {}, slug = '') => {
	return {
		id: uuid.v4(),
		slug: (type === 'type') ? slug : `${type}-${uuid.v4()}`,
		type: `${type}@1.0.0`,
		version: '1.0.0',
		active: true,
		links: {},
		data
	}
}

/**
 * @summary Return a fake user card
 * @returns {Object} fake user card
 */
exports.makeUser = () => {
	return makeCard('user')
}

/**
 * @summary Return a fake org card
 * @returns {Object} fake org card
 */
exports.makeOrg = () => {
	return makeCard('org')
}

/**
 * @summary Return a fake external-event card
 * @returns {Object} fake external-event card
 */
exports.makeExternalEvent = () => {
	return makeCard('external-event')
}

/**
 * @summary Return a fake tag card
 * @returns {Object} fake tag card
 */
exports.makeTag = () => {
	return makeCard('tag', {
		count: 0
	})
}

/**
 * @summary Return a fake message card
 * @returns {Object} fake message card
 */
exports.makeMessage = () => {
	return makeCard('message')
}

/**
 * @summary Return a fake first-time-login card
 * @returns {Object} fake first-time-login card
 */
exports.makeFirstTimeLogin = () => {
	return makeCard('first-time-login', {
		firstTimeLoginToken: uuid.v4()
	})
}

/**
 * @summary Return a fake password-reset card
 * @returns {Object} fake password-reset card
 */
exports.makePasswordReset = () => {
	return makeCard('password-reset', {
		resetToken: uuid.v4()
	})
}

// Generate and expose an actor used in tests
exports.actor = exports.makeUser()

/**
 * @summary Return a base request object
 * @returns {Object} base request object
 */
exports.makeRequest = () => {
	return {
		context: {
			id: `TEST-${uuid.v4()}`
		},
		timestamp: new Date().toISOString(),
		actor: exports.actor.id,
		originator: uuid.v4(),
		arguments: {}
	}
}

// Generate and expose a session used in tests
exports.session = makeCard('session', {
	actor: exports.actor.slug
})

// Expose a subset of card types needed for tests
exports.types = cards
exports.types.message = makeCard('type', {}, 'message')
exports.types['password-reset'] = makeCard('type', {}, 'password-reset')
exports.types['first-time-login'] = makeCard('type', {}, 'first-time-login')
exports.types.tag = makeCard('type', {}, 'tag')

/**
 * @summary Create and return context with stubbed functions
 * @function
 *
 * @param {Array} cardFixtures - list of cards to use as stubbed card store
 * @returns {Object} test context with all necessary function stubs
 */
exports.makeContext = (cardFixtures = []) => {
	const defaults = (contract) => {
		if (!contract.id) {
			contract.id = uuid.v4()
		}
		if (!contract.slug) {
			contract.slug = `${contract.type}-${uuid.v4()}`
		}

		return contract
	}
	const store = _.cloneDeep(cardFixtures).map(defaults)

	return {
		privilegedSession: exports.session.id,
		query: async (_session, schema) => {
			return _.filter(store, (card) => {
				return skhema.isValid(schema, card)
			})
		},
		getCardBySlug: async (_session, slugWithVersion) => {
			const slug = slugWithVersion.split('@')[0]
			return _.find(store, {
				slug
			}) || null
		},
		getCardById: async (_session, id) => {
			return _.find(store, {
				id
			}) || null
		},
		insertCard: async (_session, _typeCard, _options, object) => {
			if (_.find(store, {
				slug: object.slug
			})) {
				throw new Error(`${object.slug} already exists`)
			}
			store.push(defaults(object))
			return object
		},
		patchCard: async (_session, _typeCard, _options, current, patch) => {
			for (let idx = 0; idx < store.length; idx++) {
				if (store[idx].id === current.id) {
					jsonpatch.applyPatch(store[idx], patch)
				}
			}
			return _.find(store, {
				id: current.id
			})
		},
		replaceCard: async (_session, _typeCard, _options, object) => {
			const slug = object.slug.split('@')[0]
			for (let idx = 0; idx < store.length; idx++) {
				if (store[idx].slug === slug) {
					store[idx] = Object.assign({}, store[idx], object)
				}
			}
			return _.find(store, {
				slug
			}) || null
		},
		getEventSlug: (type) => {
			const id = uuid.v4()
			return `${type}-${id}`
		},
		sync: {
			mirror: () => {
				return [
					exports.makeUser(),
					exports.makeUser()
				]
			},
			translate: async () => {
				return new Promise((resolve) => {
					resolve([
						exports.makeUser(),
						exports.makeUser()
					]
					)
				}).catch((error) => {
					console.error(error)
				})
			},
			associate: () => {
				return exports.makeUser()
			},
			authorize: () => {
				return uuid.v4()
			},
			getActionContext: () => {
				return {}
			}
		},
		defaults,
		errors: {
			WorkerNoElement: typedErrors.makeTypedError('WorkerNoElement'),
			WorkerAuthenticationError: typedErrors.makeTypedError('WorkerAuthenticationError'),
			WorkerSchemaMismatch: typedErrors.makeTypedError('WorkerSchemaMismatch')
		},
		cards
	}
}
