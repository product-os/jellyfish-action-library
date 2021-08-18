/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { Action } from '@balena/jellyfish-types/build/worker';

export interface Context {
	id: string;
	[key: string]: any;
}

export type ActionRequest = Parameters<Action['handler']>[3];

export interface GoogleMeetCredentials {
	project_id: string;
	client_email: string;
	private_key: string;
	client_id: string;
}
