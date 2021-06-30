/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as assert from '@balena/jellyfish-assert';
import { getLogger } from '@balena/jellyfish-logger';
import { ActionFile } from '@balena/jellyfish-plugin-base';
import { Context, ContractSummary } from '@balena/jellyfish-types/build/core';
import _ from 'lodash';
import * as semver from 'semver';
import { retagArtifact } from './registry';

const logger = getLogger(__filename);

const mergeLinkVerb = 'was merged as';
const mergeLinkInverseVerb = 'was merged from';

interface MergeableData {
	$transformer: {
		parentMerged: boolean;
		mergeable: boolean;
		merged: boolean;
		mergeConfirmed: boolean;
		artifactReady?: any;
	};
}

/**
 * Takes in a draft version of a card (e.g. 1.0.1-alpha1+rev1) and
 * creates a copy of the card as its final equivalent (i.e. 1.0.1+rev1)
 * and also links any existing artifacts to this new card
 */
export const actionMergeDraftVersion: ActionFile = {
	card: {
		slug: 'action-merge-draft-version',
		type: 'action@1.0.0',
		name: 'Merge a draft version to its final version',
		data: {
			filter: {
				type: 'object',
			},
			arguments: {},
		},
	},
	handler: async (session, context, card, request) => {
		logger.info(request.context, 'merging draft version', {
			slug: card.slug,
			version: card.version,
		});

		assert.USER(
			request.context,
			semver.prerelease(card.version),
			context.errors.WorkerNoElement,
			`Not a draft version: ${card.version}`,
		);

		const typeCard = await context.getCardBySlug(session, card.type);

		assert.USER(
			request.context,
			typeCard,
			context.errors.WorkerNoElement,
			`No such type: ${card.type}`,
		);

		// * create deep copy of card *without* data.$transformer (TODO check this) and version finalized
		// * insert card
		// * link artifacts
		// * update card with artifactReady=true (need to do this as two steps for docker registry permission checks)
		// * link cards with 'was merged as'

		const finalVersionCard = _.cloneDeep(card);
		Reflect.deleteProperty(finalVersionCard, 'id');
		(
			finalVersionCard.data as unknown as MergeableData
		).$transformer.artifactReady = false;
		finalVersionCard.version = makeFinal(card.version);

		// TODO check if final version already exists

		const insertedFinalCard = await context.insertCard(
			session,
			typeCard,
			{
				timestamp: request.timestamp,
				actor: request.actor,
				originator: request.originator,
				attachEvents: true,
			},
			finalVersionCard,
		);
		finalVersionCard.id = insertedFinalCard.id;

		// TS-TODO: fix type confusion in plugin base
		const cardData = card.data as unknown as MergeableData;
		const previousArtifactReady = cardData.$transformer.artifactReady;
		if (previousArtifactReady) {
			// NOTE
			// This action is doing too much. Mostly because of the weak integration between the registry artifacts
			// and the contracts. Also the explicit support for the local env stems from that

			const sessionContract = await context.getCardById(session, session);
			const actorContract = await context.getCardById(
				session,
				sessionContract.data.actor,
			);
			await retagArtifact(
				request.context,
				card,
				finalVersionCard,
				actorContract.slug,
				session,
			);

			await context.patchCard(
				session,
				typeCard,
				{
					timestamp: request.timestamp,
					actor: request.actor,
					originator: request.originator,
					attachEvents: true,
				},
				finalVersionCard,
				[
					{
						op: 'replace',
						path: '/data/$transformer/artifactReady',
						value: previousArtifactReady,
					},
				],
			);
		}

		await linkCards(
			context,
			session,
			request,
			card,
			insertedFinalCard,
			mergeLinkVerb,
			mergeLinkInverseVerb,
		);

		const result = insertedFinalCard;

		return {
			id: result.id,
			type: result.type,
			version: result.version,
			slug: result.slug,
		};
	},
};

// node-semver ignores build meta-data in its .toString() ...
const makeFinal = (version: string): string => {
	const v = semver.parse(version);
	if (!v) {
		throw new Error(`semver parsing failed: ${version}`);
	}
	const build = v.build.length ? `+${v.build.join('.')}` : '';
	return `${v.major}.${v.minor}.${v.patch}${build}`;
};

const linkCards = async (
	context: Context,
	session: string,
	request: any,
	card: ContractSummary,
	insertedFinalCard: ContractSummary,
	verb: string,
	inverseVerb: string,
) => {
	const linkTypeCard = await context.getCardBySlug(session, 'link@1.0.0');
	assert.INTERNAL(
		request.context,
		linkTypeCard,
		context.errors.WorkerNoElement,
		'No such type: link',
	);

	await context.insertCard(
		session,
		linkTypeCard,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			attachEvents: true,
		},
		{
			slug: await context.getEventSlug('link'),
			type: 'link@1.0.0',
			name: verb,
			data: {
				inverseName: inverseVerb,
				from: {
					id: card.id,
					slug: card.slug,
					type: card.type,
				},
				to: {
					id: insertedFinalCard.id,
					slug: insertedFinalCard.slug,
					type: insertedFinalCard.type,
				},
			},
		},
	);
};
