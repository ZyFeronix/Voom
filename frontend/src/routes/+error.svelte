<script>
	import { page } from '$app/state';
	import { authStore } from '$lib/stores/auth.svelte.js';

	let status = $derived(page.status || 404);
	let errorMessage = $derived(page.error?.message || '');

	let errorTitle = $derived.by(() => {
		if (status === 404) return 'Página no encontrada';
		if (status === 403) return 'Acceso no autorizado';
		if (status === 500) return 'Error del servidor';
		return `Error ${status}`;
	});

	let errorDescription = $derived.by(() => {
		if (
			errorMessage &&
			errorMessage !== 'Internal Error' &&
			errorMessage !== 'Error interno del servidor'
		) {
			return errorMessage;
		}
		if (status === 404) {
			return 'La página o el recurso al que intentas acceder no existe, ha cambiado de dirección o no está disponible.';
		}
		if (status === 403) {
			return 'No tienes los permisos necesarios para ver este contenido. Inicia sesión con la cuenta adecuada.';
		}
		return 'Ha ocurrido un error inesperado en nuestros servicios. Por favor, intenta nuevamente en unos momentos.';
	});

	let iconName = $derived.by(() => {
		if (status === 404) return 'explore_off';
		if (status === 403) return 'lock';
		return 'error_outline';
	});
</script>

<svelte:head>
	<title>{status} · {errorTitle} — VSocial</title>
</svelte:head>

<main class="error-page-container">
	<!-- Background glow element -->
	<div class="error-ambient-glow" aria-hidden="true"></div>

	<div class="error-card glass-card">
		<!-- Icon badge -->
		<div class="error-icon-wrapper" style="flex: 0 0 80px; min-width: 80px; min-height: 80px">
			<span class="material-icons-round error-icon">{iconName}</span>
		</div>

		<!-- Status badge -->
		<div class="error-status-pill">
			<span class="error-pulse-dot"></span>
			<span>Código {status}</span>
		</div>

		<!-- Main Heading -->
		<h1 class="error-heading">{errorTitle}</h1>

		<!-- Description -->
		<p class="error-desc">{errorDescription}</p>

		<!-- Actions Grid -->
		<div class="error-actions-grid">
			{#if authStore.isAuthenticated}
				<a href="/feed" class="btn-aero-primary action-btn">
					<span class="material-icons-round">dynamic_feed</span>
					<span>Ir al Feed</span>
				</a>
				<a href="/" class="btn-aero-secondary action-btn">
					<span class="material-icons-round">home</span>
					<span>Inicio</span>
				</a>
			{:else}
				<a href="/" class="btn-aero-primary action-btn">
					<span class="material-icons-round">home</span>
					<span>Página de Inicio</span>
				</a>
				<a href="/login" class="btn-aero-secondary action-btn">
					<span class="material-icons-round">login</span>
					<span>Iniciar Sesión</span>
				</a>
				<a href="/register" class="btn-aero-ghost action-btn">
					<span class="material-icons-round">person_add</span>
					<span>Crear Cuenta</span>
				</a>
			{/if}
		</div>

		<!-- Support / Help link -->
		<div class="error-footer-links">
			<a href="/about" class="footer-link">
				<span class="material-icons-round text-sm">info</span>
				<span>Acerca de VSocial</span>
			</a>
			<span class="footer-dot">·</span>
			<a href="/feed" class="footer-link">
				<span class="material-icons-round text-sm">public</span>
				<span>Feed Público</span>
			</a>
		</div>
	</div>
</main>

<style>
	.error-page-container {
		position: relative;
		min-height: calc(100vh - 80px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.25rem;
		overflow: hidden;
	}

	.error-ambient-glow {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 480px;
		height: 480px;
		background: radial-gradient(
			circle,
			rgba(27, 133, 243, 0.18) 0%,
			rgba(0, 212, 170, 0.12) 40%,
			transparent 70%
		);
		border-radius: 50%;
		filter: blur(40px);
		pointer-events: none;
		z-index: 0;
	}

	.error-card {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 520px;
		padding: 2.75rem 2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		border-radius: var(--radius-xl, 28px);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		box-shadow:
			var(--shadow-lg),
			0 0 32px rgba(27, 133, 243, 0.12);
		backdrop-filter: var(--glass-blur, blur(16px));
		animation: errorAppear 0.5s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) forwards;
	}

	@keyframes errorAppear {
		from {
			opacity: 0;
			transform: scale(0.94) translateY(16px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.error-icon-wrapper {
		width: 80px;
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: linear-gradient(135deg, rgba(27, 133, 243, 0.15), rgba(0, 212, 170, 0.12));
		border: 1px solid rgba(27, 133, 243, 0.25);
		box-shadow: 0 8px 24px rgba(27, 133, 243, 0.2);
		margin-bottom: 1.25rem;
	}

	.error-icon {
		font-size: 40px;
		color: var(--accent-blue-base, #1b85f3);
	}

	.error-status-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.85rem;
		border-radius: var(--radius-full, 9999px);
		background: rgba(27, 133, 243, 0.1);
		border: 1px solid rgba(27, 133, 243, 0.25);
		color: var(--accent-blue-base, #1b85f3);
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		margin-bottom: 1rem;
	}

	.error-pulse-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent-blue-base, #1b85f3);
		box-shadow: 0 0 8px var(--accent-blue-base, #1b85f3);
		animation: pulseDot 2s infinite ease-in-out;
	}

	@keyframes pulseDot {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.4;
			transform: scale(0.85);
		}
	}

	.error-heading {
		font-family: var(--font-display, 'Outfit', sans-serif);
		font-size: 1.75rem;
		font-weight: 800;
		color: var(--text-primary);
		line-height: 1.2;
		margin: 0 0 0.75rem 0;
	}

	.error-desc {
		font-family: var(--font-sans, 'Inter', sans-serif);
		font-size: 0.95rem;
		color: var(--text-secondary);
		line-height: 1.6;
		margin: 0 0 2rem 0;
		max-width: 420px;
	}

	.error-actions-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		width: 100%;
		justify-content: center;
		margin-bottom: 1.75rem;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1.25rem;
		font-size: 0.9375rem;
		font-weight: 600;
		border-radius: var(--radius-md, 14px);
		text-decoration: none;
		flex: 1 1 calc(50% - 0.75rem);
		min-width: 140px;
		transition:
			transform var(--t-fast, 0.15s ease),
			box-shadow var(--t-fast, 0.15s ease);
	}

	.action-btn:hover {
		transform: translateY(-2px);
	}

	.error-footer-links {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.8125rem;
		color: var(--text-tertiary);
		border-top: 1px solid var(--border-subtle);
		padding-top: 1.25rem;
		width: 100%;
		justify-content: center;
	}

	.footer-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--text-secondary);
		text-decoration: none;
		transition: color var(--t-fast, 0.15s ease);
	}

	.footer-link:hover {
		color: var(--accent-blue-base, #1b85f3);
	}

	.footer-dot {
		color: var(--border-subtle);
	}

	.text-sm {
		font-size: 16px;
	}

	@media (max-width: 640px) {
		.error-card {
			padding: 2rem 1.25rem;
		}

		.error-heading {
			font-size: 1.45rem;
		}

		.action-btn {
			flex: 1 1 100%;
		}
	}
</style>
