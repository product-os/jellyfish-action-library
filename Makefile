.PHONY: lint \
	test

# See https://stackoverflow.com/a/18137056
MAKEFILE_PATH := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

# -----------------------------------------------
# Build Configuration
# -----------------------------------------------

# To make sure we don't silently swallow errors
NODE_ARGS = --abort-on-uncaught-exception --stack-trace-limit=100
NODE_DEBUG_ARGS = $(NODE_ARGS) --trace-warnings --stack_trace_on_illegal

# User parameters
FIX ?=
ifeq ($(FIX),)
ESLINT_OPTION_FIX =
else
ESLINT_OPTION_FIX = --fix
endif

INTEGRATION_GOOGLE_MEET_CREDENTIALS ?= {}
export INTEGRATION_GOOGLE_MEET_CREDENTIALS
MAIL_TYPE ?= mailgun
export MAIL_TYPE
MAILGUN_TOKEN ?=
export MAILGUN_TOKEN
MAILGUN_DOMAIN ?= mail.ly.fish
export MAILGUN_DOMAIN
MAILGUN_BASE_URL = https://api.mailgun.net/v3
export MAILGUN_BASE_URL

AVA_ARGS = $(AVA_OPTS)
ifndef CI
AVA_ARGS += --fail-fast
endif
ifdef MATCH
AVA_ARGS += --match $(MATCH)
endif

FILES ?= "'./test/**/*.spec.js'"
export FILES

# -----------------------------------------------
# Rules
# -----------------------------------------------

lint:
	npx eslint --ext .js $(ESLINT_OPTION_FIX) lib test
	npx jellycheck
	npx deplint
	npx depcheck --ignore-bin-package

test:
	node $(NODE_DEBUG_ARGS) ./node_modules/.bin/ava -v $(AVA_ARGS) $(FILES)
