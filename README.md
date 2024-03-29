**Notice: This utility has been discontinued. The actions defined in this repository have been moved to [`jellyfish-plugin-default`](https://github.com/product-os/jellyfish-plugin-default).**

# Jellyfish Action Library

The action library consists of a set of actions with which the system provisions workers.

# Usage

Below is an example how to use this library:

```js
import { cardMixins } from '@balena/jellyfish-core';
import ActionLibraryPlugin from '@balena/jellyfish-action-library';

const plugin = new ActionLibraryPlugin();

// Load cards from this plugin (this will just include the action cards)
const cards = plugin.getCards(context, cardMixins);
// Load the action handlers, keyed by action slug.
const action = plugin.getActions(context);
```

# Documentation

[![Publish Documentation](https://github.com/product-os/jellyfish-action-library/actions/workflows/publish-docs.yml/badge.svg)](https://github.com/product-os/jellyfish-action-library/actions/workflows/publish-docs.yml)

Visit the website for complete documentation: https://product-os.github.io/jellyfish-action-library

# Testing

Unit tests can be easily run with the command `npm test`.

The integration tests require Postgres and Redis instances. The simplest way to run the tests locally is with `docker-compose`.

```
$ git secret reveal
$ npm run test:compose
```

You can also run tests locally against Postgres and Redis instances running in `docker-compose`:
```
$ git secret reveal
$ npm run compose
$ export INTEGRATION_GOOGLE_MEET_CREDENTIALS=$(cat .balena/secrets/integration_google_meet_credentials)
$ export MAILGUN_TOKEN=$(cat .balena/secrets/mailgun_token)
$ REDIS_HOST=localhost POSTGRES_HOST=localhost npx jest test/integration/actions/action-ping.spec.ts
```

You can also access these Postgres and Redis instances:
```
$ PGPASSWORD=docker psql -hlocalhost -Udocker
$ redis-cli -h localhost
```
