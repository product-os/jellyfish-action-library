import { Action } from '@balena/jellyfish-types/build/worker';

export type ActionRequest = Parameters<Action['handler']>[3];

export interface GoogleMeetCredentials {
	project_id: string;
	client_email: string;
	private_key: string;
	client_id: string;
}
