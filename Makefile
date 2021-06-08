MAKEFILE_PATH := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

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
	npx jest test/unit

.PHONY: test-integration
test-integration:
	npx jest --runInBand --bail test/integration

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
