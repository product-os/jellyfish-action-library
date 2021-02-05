/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

module.exports = [
	require('./action-broadcast'),
	require('./action-complete-first-time-login'),
	require('./action-complete-password-reset'),
	require('./action-create-card'),
	require('./action-create-event'),
	require('./action-create-session'),
	require('./action-create-user'),
	require('./action-delete-card'),
	require('./action-google-meet'),
	require('./action-increment-tag'),
	require('./action-increment'),
	require('./action-integration-discourse-mirror-event'),
	require('./action-integration-front-mirror-event'),
	require('./action-integration-github-mirror-event'),
	require('./action-integration-import-event'),
	require('./action-integration-outreach-mirror-event'),
	require('./action-oauth-associate'),
	require('./action-oauth-authorize'),
	require('./action-ping'),
	require('./action-request-password-reset'),
	require('./action-send-email'),
	require('./action-send-first-time-login-link'),
	require('./action-set-add'),
	require('./action-set-password'),
	require('./action-set-update'),
	require('./action-set-user-avatar'),
	require('./action-update-card')
]
