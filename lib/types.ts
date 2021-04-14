/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

export interface Context {
	id: string;
	[key: string]: any;
}

export interface ActionRequest {
	[key: string]: any;
}
