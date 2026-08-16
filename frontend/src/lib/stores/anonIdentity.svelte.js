// Identidad Anónima Permanente — username exclusivo para publicar/comentar de forma
// anónima. Se elige una sola vez y no se puede cambiar (estilo Facebook, mejorado).
import { users as usersApi } from '$lib/api.js';

/** @type {undefined | null | { anon_username: string }} undefined = sin cargar, null = no tiene */
let cached;
let cachePromise = null;

export function getAnonIdentity() {
	if (cached !== undefined) return Promise.resolve(cached);
	if (!cachePromise) {
		cachePromise = usersApi.anonIdentity
			.get()
			.then((data) => {
				cached = data?.identity || null;
				return cached;
			})
			.catch(() => {
				cached = null;
				return cached;
			})
			.finally(() => {
				cachePromise = null;
			});
	}
	return cachePromise;
}

export function setAnonIdentity(username) {
	cached = username ? { anon_username: username } : null;
}

export async function createAnonIdentity(username) {
	const data = await usersApi.anonIdentity.create(username);
	setAnonIdentity(data?.identity?.anon_username || username);
	return data?.identity;
}

export function invalidateAnonIdentity() {
	cached = undefined;
}
