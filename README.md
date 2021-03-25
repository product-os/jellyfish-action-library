# Jellyfish Action Library

The action library consists of a set of actions with which the system provisions workers.

# Usage

Below is an example how to use this library:

```js
const coreMixins = require('@balena/jellyfish-core/lib/cards/mixins')
const ActionLibraryPlugin = require('@balena/jellyfish-action-library')

const plugin = new ActionLibraryPlugin()

// Load cards from this plugin (this will just include the action cards)
const cards = plugin.getCards(context, coreMixins)
// Load the action handlers, keyed by action slug.
const action = plugin.getActions(context)
```

# Documentation

[![Publish Documentation](https://github.com/product-os/jellyfish-action-library/actions/workflows/publish-docs.yml/badge.svg)](https://github.com/product-os/jellyfish-action-library/actions/workflows/publish-docs.yml)

Visit the website for complete documentation: https://product-os.github.io/jellyfish-action-library
