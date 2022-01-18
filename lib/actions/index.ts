import { actionBroadcast } from './action-broadcast';
import { actionCompleteFirstTimeLogin } from './action-complete-first-time-login';
import { actionCompletePasswordReset } from './action-complete-password-reset';
import { actionDeleteCard } from './action-delete-card';
import { actionGoogleMeet } from './action-google-meet';
import { actionIncrement } from './action-increment';
import { actionIncrementTag } from './action-increment-tag';
import { actionIntegrationImportEvent } from './action-integration-import-event';
import { actionMergeDraftVersion } from './action-merge-draft-version';
import { actionOAuthAssociate } from './action-oauth-associate';
import { actionOAuthAuthorize } from './action-oauth-authorize';
import { actionPing } from './action-ping';
import { actionRequestPasswordReset } from './action-request-password-reset';
import { actionSendEmail } from './action-send-email';
import { actionSendFirstTimeLoginLink } from './action-send-first-time-login-link';
import { actionSetPassword } from './action-set-password';
import { actionSetUpdate } from './action-set-update';
import { actionSetUserAvatar } from './action-set-user-avatar';

export const actions = [
	actionBroadcast,
	actionCompleteFirstTimeLogin,
	actionCompletePasswordReset,
	actionDeleteCard,
	actionGoogleMeet,
	actionIncrement,
	actionIncrementTag,
	actionIntegrationImportEvent,
	actionMergeDraftVersion,
	actionOAuthAssociate,
	actionOAuthAuthorize,
	actionPing,
	actionRequestPasswordReset,
	actionSendEmail,
	actionSendFirstTimeLoginLink,
	actionSetPassword,
	actionSetUpdate,
	actionSetUserAvatar,
];
