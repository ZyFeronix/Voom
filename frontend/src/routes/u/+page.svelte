<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.svelte.js';

	onMount(async () => {
		if (authStore.loading) {
			await new Promise((resolve) => {
				const check = setInterval(() => {
					if (!authStore.loading) {
						clearInterval(check);
						resolve();
					}
				}, 50);
			});
		}

		const search = typeof window !== 'undefined' ? window.location.search : '';
		if (authStore.user?.username) {
			if (search.includes('tab=')) {
				goto(`/u/${authStore.user.username}/following${search}`, { replaceState: true });
			} else {
				goto(`/u/${authStore.user.username}`, { replaceState: true });
			}
		} else {
			goto('/feed', { replaceState: true });
		}
	});
</script>

<div class="redirect-container glass-panel">
	<span class="loading loading-spinner text-primary"></span>
	<p>Redirigiendo a tu perfil...</p>
</div>

<style>
	.redirect-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 50vh;
		gap: 16px;
		color: var(--text-secondary);
	}
</style>
