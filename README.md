# Jellyfish Action Library

The action library consists of a set of actions with which the system provisions workers.

# Usage

Below is an example how to use this library:

```js
const Worker = require('@balena/jellyfish-worker').Worker
const actionLibrary = require('@balena/jellyfish-action-library')

// Create built-in worker
const worker = new Worker(jellyfish, sessions.admin, actionLibrary, consumer)
```

# Documentation

A module that defines Jellyfish actions and their handlers.

