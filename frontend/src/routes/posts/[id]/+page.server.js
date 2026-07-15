import { error } from '@sveltejs/kit';

export async function load({ params, fetch }) {
	const { id } = params;
	
	try {
		const res = await fetch(`/api/posts/${id}`);
		if (!res.ok) {
			error(404, 'Publicación no encontrada');
		}
		
		const data = await res.json();
		if (!data.post) {
			error(404, 'Publicación no encontrada');
		}
		
		return {
			post: data.post
		};
	} catch (e) {
		console.error('Error fetching post:', e);
		if (e.status === 404) throw e;
		error(500, 'Error interno al cargar la publicación');
	}
}
