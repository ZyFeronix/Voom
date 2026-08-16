import { redirect } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export function load({ url }) {
	const mode = url.searchParams.get('mode') || url.searchParams.get('action');
	if (mode === 'register' || mode === 'signup') {
		throw redirect(307, '/register');
	}
	throw redirect(307, '/login');
}
