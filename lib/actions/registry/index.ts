import { defaultEnvironment } from '@balena/jellyfish-environment';
import { getLogger } from '@balena/jellyfish-logger';
import { core } from '@balena/jellyfish-types';
import { Context } from '@balena/jellyfish-types/build/core';
import axios from 'axios';

const logger = getLogger(__filename);

/**
 * This function uploads an existing manifest to another name, effectively
 * creating a secondary tag for the same image/artifact
 *
 * @param context logging context
 * @param src new contract with the new version to tag for
 * @param target existing contract to be retagged
 * @param userSlug user who shall access the registry
 * @param session session id of given user
 */
export const retagArtifact = async (
	context: Context,
	src: core.ContractSummary,
	target: core.ContractSummary,
	userSlug: string,
	session: string,
) => {
	// This function should do the same as the following curl statements
	// curl registry.ly.fish.local/v2/transformer-service-source2multi-arch-service/manifests/1.0.0-with-contract  -v -X PUT
	// < Www-Authenticate: Bearer realm="http://api.ly.fish.local/api/v2/registry",service="registry.ly.fish.local",scope="repository:transformer-service-source2multi-arch-service:push,pull"
	// export TOKEN=$(curl -v -u USER_SLUG:SESSION_TOKEN 'http://api.ly.fish.local/api/v2/registry?service=registry.ly.fish.local&scope=repository:transformer-service-source2multi-arch-service:pull,push' | jq -j .token)
	// curl -H "Authorization: bearer $TOKEN" registry.ly.fish.local/v2/transformer-service-source2multi-arch-service/manifests/1.0.0-with-contract  -H 'accept: application/vnd.docker.distribution.manifest.v2+json' -v | jq .
	// curl -H "Authorization: bearer $TOKEN" registry.ly.fish.local/v2/transformer-service-source2multi-arch-service/manifests/1.0.0-with-contract -X PUT -H 'content-type: application/vnd.docker.distribution.manifest.v2+json' -d '@manifest-1.0.0.json' -v

	const srcManifestUrl = manifestUrl(src);
	const targetManifestUrl = manifestUrl(target);

	if (defaultEnvironment.registry.insecureHttp) {
		logger.warn(
			context,
			`Communicating with registry insecurely - this should only happen locally`,
		);
	}

	// get login URL
	const deniedRegistryResp = await axios.put(
		srcManifestUrl,
		{},
		{ validateStatus: (status) => status === 403 || status === 401 },
	);
	const wwwAuthenticate = deniedRegistryResp.headers['www-authenticate'];
	if (deniedRegistryResp.status !== 401 || !wwwAuthenticate) {
		throw new Error(
			`Registry didn't ask for authentication (status code ${deniedRegistryResp.status})`,
		);
	}
	const { realm, service, scope } = parseWwwAuthenticate(wwwAuthenticate);
	const authUrl = new URL(realm);
	authUrl.searchParams.set('service', service);
	authUrl.searchParams.set('scope', scope);

	// login with session user
	const loginResp = await axios.get(authUrl.href, {
		auth: { username: userSlug, password: session },
	});
	if (!loginResp.data.token) {
		throw new Error(
			`Couldn't log in for registry (status code ${loginResp.status})`,
		);
	}

	// get source manifest
	const srcManifestResp = await axios.get(srcManifestUrl, {
		headers: {
			Authorization: `bearer ${loginResp.data.token}`,
			Accept: 'application/vnd.docker.distribution.manifest.v2+json',
		},
	});

	// push target manifest
	await axios.put(targetManifestUrl, srcManifestResp.data, {
		headers: {
			Authorization: `bearer ${loginResp.data.token}`,
			'Content-Type': 'application/vnd.docker.distribution.manifest.v2+json',
		},
	});
};

const registrySchema = defaultEnvironment.registry.insecureHttp
	? 'http://'
	: 'https://';

const manifestUrl = (card: core.ContractSummary) =>
	`${registrySchema}${defaultEnvironment.registry.host}/v2/${card.slug}/manifests/${card.version}`;

const parseWwwAuthenticate = (wwwAuthenticate: any) => {
	return {
		realm: (/realm="([^"]+)/.exec(wwwAuthenticate) || [])[1],
		service: (/service="([^"]+)/.exec(wwwAuthenticate) || [])[1],
		scope: (/scope="([^"]+)/.exec(wwwAuthenticate) || [])[1],
	};
};
