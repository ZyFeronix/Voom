import { redirect } from '@sveltejs/kit';

export async function load({ params }) {
	throw redirect(302, `/reels?id=${params.id}`);
}
