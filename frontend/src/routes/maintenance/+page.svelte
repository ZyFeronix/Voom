<script>
	import { fade } from 'svelte/transition';
	import ThemeSelector from '$lib/components/ThemeSelector.svelte';

	// Página pública de mantenimiento: el guard de hooks.server.js redirige aquí
	// a todo el tráfico no-staff mientras `maintenance_mode` esté activo.
</script>

<svelte:head>
	<title>Mantenimiento &mdash; Voom!</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="vs-maintenance-page" in:fade={{ duration: 350 }}>
	<header class="vs-maintenance-header">
		<a href="/" class="vs-home-pill">
			<span class="material-icons-round" style="font-size: 16px;">home</span>
			<span>Inicio</span>
		</a>
		<ThemeSelector />
	</header>

	<main class="vs-maintenance-card" in:fade={{ duration: 450, delay: 100 }}>
		<div class="vs-maintenance-icon" aria-hidden="true">
			<span class="material-icons-round">engineering</span>
			<span class="gear material-icons-round">settings</span>
		</div>
		<h1 class="vs-maintenance-title">Estamos dando mantenimiento</h1>
		<p class="vs-maintenance-text">
			Voom! está temporalmente fuera de servicio para mejoras. Volveremos en unos minutos &mdash;
			gracias por tu paciencia.
		</p>
		<div class="vs-maintenance-meta">
			<span class="material-icons-round">schedule</span>
			<span>Sin tiempo estimado &middot; sigue los avisos en el Discord oficial</span>
		</div>
	</main>
</div>

<style>
	.vs-maintenance-page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 24px;
		padding: 24px;
		background:
			radial-gradient(
				1200px 500px at 50% -10%,
				color-mix(in srgb, var(--accent-blue-base, #38bdf8) 12%, transparent),
				transparent
			),
			var(--bg-base, var(--bg-primary, #0b0f14));
		position: relative;
	}

	.vs-maintenance-header {
		position: absolute;
		top: 18px;
		left: 18px;
		right: 18px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.vs-home-pill {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 8px 14px;
		border-radius: var(--radius-full);
		background: var(--bg-overlay);
		border: 1px solid var(--glass-border);
		color: var(--text-secondary);
		font-size: 0.8rem;
		font-weight: 600;
		text-decoration: none;
		transition:
			border-color 0.2s ease,
			color 0.2s ease;
	}
	.vs-home-pill:hover {
		border-color: var(--accent-blue-base, var(--aero-sky));
		color: var(--text-primary);
	}

	.vs-maintenance-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		max-width: 460px;
		padding: 44px 40px;
		border-radius: var(--radius-xl, var(--radius-lg));
		background: var(--bg-surface, var(--bg-overlay));
		border: 1px solid var(--glass-border);
		box-shadow: var(--shadow-lg, 0 20px 60px rgb(0 0 0 / 0.25));
		text-align: center;
	}

	.vs-maintenance-icon {
		position: relative;
		width: 84px;
		height: 84px;
		display: grid;
		place-items: center;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--accent-blue-base, #38bdf8) 14%, transparent);
		border: 1px solid var(--glass-border);
	}
	.vs-maintenance-icon .material-icons-round {
		font-size: 38px;
		color: var(--accent-blue-base, var(--aero-sky));
	}
	.vs-maintenance-icon .gear {
		position: absolute;
		right: -6px;
		bottom: -6px;
		font-size: 24px;
		color: var(--text-tertiary);
		animation: vs-gear-spin 6s linear infinite;
	}
	@keyframes vs-gear-spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.vs-maintenance-icon .gear {
			animation: none;
		}
	}

	.vs-maintenance-title {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 800;
		color: var(--text-primary);
		letter-spacing: -0.01em;
	}

	.vs-maintenance-text {
		margin: 0;
		font-size: 0.95rem;
		line-height: 1.55;
		color: var(--text-secondary);
	}

	.vs-maintenance-meta {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin-top: 6px;
		padding: 8px 14px;
		border-radius: var(--radius-full);
		background: var(--bg-overlay);
		border: 1px solid var(--glass-border);
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}
	.vs-maintenance-meta .material-icons-round {
		font-size: 15px;
	}
</style>
