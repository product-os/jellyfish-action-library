MAKEFILE_PATH := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

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

# Define make commands that wrap npm scripts to ensure a more consistent workflow across repos
.PHONY: clean
clean:
	npm run clean

.PHONY: build
build:
	npm run build

.PHONY: lint
lint:
	npm run lint

.PHONY: lint-fix
lint-fix:
	npm run lint-fix

.PHONY: test-unit
test-unit:
	npx jest

.PHONY: test
test:
	npm run test

.PHONY: doc
doc:
	npm run doc

.PHONY: prepack
prepack:
	npm run prepack

.PHONY: check
check:
	npm run check
