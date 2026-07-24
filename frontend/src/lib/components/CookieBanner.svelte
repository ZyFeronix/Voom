<script>
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';

	let visible = $state(false);

	onMount(() => {
		if (typeof localStorage === 'undefined') return;
		const c = localStorage.getItem('vsocial_cookie_consent');
		if (c !== 'accepted' && c !== 'essential') visible = true;
	});

	function accept() {
		localStorage.setItem('vsocial_cookie_consent', 'accepted');
		document.cookie =
			'vsocial_cookie_consent=accepted; path=/; max-age=31536000; SameSite=Strict; Secure';
		visible = false;
	}

	function essentialOnly() {
		localStorage.setItem('vsocial_cookie_consent', 'essential');
		document.cookie =
			'vsocial_cookie_consent=essential; path=/; max-age=31536000; SameSite=Strict; Secure';
		visible = false;
	}
</script>

{#if visible}
	<div class="cookie-banner-wrapper" transition:fly={{ y: 50, duration: 400 }}>
		<div class="glass-panel cookie-banner">
			<div class="cookie-content">
				<span class="material-icons-round cookie-icon">cookie</span>
				<p class="cookie-text">
					Usamos cookies esenciales para la autenticación y tu preferencia. Consulta nuestra
					<a href="/cookies" class="cookie-link">Política de Cookies</a>.
				</p>
			</div>
			<div class="cookie-actions">
				<button class="btn-essential" onclick={essentialOnly}>Solo esenciales</button>
				<button class="btn-aero-primary px-5 py-2 text-sm font-bold" onclick={accept}
					>Aceptar</button
				>
			</div>
		</div>
	</div>
{/if}

<style>
	.cookie-banner-wrapper {
		position: fixed;
		bottom: 16px;
		left: 16px;
		right: 16px;
		z-index: 1000;
		display: flex;
		justify-content: center;
		pointer-events: none;
	}

	.cookie-banner {
		pointer-events: auto;
		width: 100%;
		max-width: 720px;
		padding: 14px 18px;
		border-radius: 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		box-shadow:
			0 10px 40px rgba(0, 0, 0, 0.5),
			inset 0 1px 1px rgba(255, 255, 255, 0.1);
		background: var(--bg-surface, rgba(15, 23, 42, 0.85));
		border: 1px solid var(--glass-highlight, rgba(255, 255, 255, 0.1));
		border-bottom: 3px solid var(--primary-color, #1b85f3);
	}

	.cookie-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
		flex: 1;
	}

	.cookie-icon {
		font-size: 24px;
		color: var(--primary-color, #1b85f3);
		flex-shrink: 0;
	}

	.cookie-text {
		font-size: 0.82rem;
		color: var(--text-muted, #94a3b8);
		line-height: 1.4;
	}

	.cookie-link {
		color: var(--text-main, #e2e8f0);
		text-decoration: underline;
	}

	.cookie-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.btn-essential {
		background: transparent;
		border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.15));
		color: var(--text-muted, #94a3b8);
		padding: 0.5rem 1rem;
		border-radius: 10px;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-essential:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-main, #e2e8f0);
	}

	@media (max-width: 640px) {
		.cookie-banner {
			flex-direction: column;
			align-items: stretch;
		}
		.cookie-actions {
			justify-content: stretch;
		}
		.cookie-actions button {
			flex: 1;
		}
	}
</style>
