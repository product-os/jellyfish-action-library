/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { ActionFile } from '@balena/jellyfish-plugin-base';
import { actionBroadcast } from './action-broadcast';
import { actionCompleteFirstTimeLogin } from './action-complete-first-time-login';
import { actionCompletePasswordReset } from './action-complete-password-reset';
import { actionCreateCard } from './action-create-card';
import { actionCreateEvent } from './action-create-event';
import { actionCreateSession } from './action-create-session';
import { actionCreateUser } from './action-create-user';
import { actionDeleteCard } from './action-delete-card';
import { actionGoogleMeet } from './action-google-meet';
import { actionIncrement } from './action-increment';
import { actionIncrementTag } from './action-increment-tag';
import { actionIntegrationFrontMirrorEvent } from './action-integration-front-mirror-event';
import { actionIntegrationImportEvent } from './action-integration-import-event';
import { actionMergeDraftVersion } from './action-merge-draft-version';
import { actionOAuthAssociate } from './action-oauth-associate';
import { actionOAuthAuthorize } from './action-oauth-authorize';
import { actionPing } from './action-ping';
import { actionRequestPasswordReset } from './action-request-password-reset';
import { actionSendEmail } from './action-send-email';
import { actionSendFirstTimeLoginLink } from './action-send-first-time-login-link';
import { actionSetAdd } from './action-set-add';
import { actionSetPassword } from './action-set-password';
import { actionSetUpdate } from './action-set-update';
import { actionSetUserAvatar } from './action-set-user-avatar';
import { actionUpdateCard } from './action-update-card';

export { mirror } from './mirror';

export const actions: ActionFile[] = [
	actionBroadcast,
	actionCompleteFirstTimeLogin,
	actionCompletePasswordReset,
	actionCreateCard,
	actionCreateEvent,
	actionCreateSession,
	actionCreateUser,
	actionDeleteCard,
	actionGoogleMeet,
	actionIncrementTag,
	actionIncrement,
	actionIntegrationFrontMirrorEvent,
	actionIntegrationImportEvent,
	actionMergeDraftVersion,
	actionOAuthAssociate,
	actionOAuthAuthorize,
	actionPing,
	actionRequestPasswordReset,
	actionSendEmail,
	actionSendFirstTimeLoginLink,
	actionSetAdd,
	actionSetPassword,
	actionSetUpdate,
	actionSetUserAvatar,
	actionUpdateCard,
];
