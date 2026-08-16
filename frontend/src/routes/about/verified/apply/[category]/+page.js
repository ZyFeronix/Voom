import { error } from '@sveltejs/kit';

export const prerender = false;
export const ssr = true;

const validCategories = ['creator', 'streamer', 'organization', 'government', 'public'];

export function load({ params }) {
	const category = params.category;
	if (!validCategories.includes(category)) {
		error(404, 'Tipo de verificación no encontrado');
	}
	return {
		category
	};
}
