<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { auth as authApi } from '$lib/api.js';
	import ThemeSelector from '$lib/components/ThemeSelector.svelte';

	let token = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let showPass = $state(false);
	let loading = $state(false);
	let success = $state(false);
	let error = $state('');

	let passwordValid = $derived(password.length >= 8);
	let passwordsMatch = $derived(password.length > 0 && password === confirmPassword);
	let formValid = $derived(passwordValid && passwordsMatch);

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		token = params.get('token') || '';
		if (!token) {
			error = 'Falta el token del enlace. Solicita un nuevo email de recuperación.';
		}
	});

	async function handleReset(e) {
		e?.preventDefault();
		if (!formValid || loading) return;
		loading = true;
		error = '';
		try {
			await authApi.resetPassword(token, password);
			success = true;
			setTimeout(() => goto('/login'), 2500);
		} catch (err) {
			error = err?.message || 'No se pudo restablecer la contraseña.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Nueva Contraseña &mdash; Voom!</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="vs-reset-page" in:fade={{ duration: 350 }}>
	<header class="vs-reset-header">
		<a href="/" class="vs-home-pill">
			<span class="material-icons-round" style="font-size: 16px;">home</span>
			<span>Inicio</span>
		</a>
		<ThemeSelector />
	</header>

	<main class="vs-reset-card" in:fade={{ duration: 450, delay: 100 }}>
		<div class="vs-reset-icon" aria-hidden="true">
			<span class="material-icons-round">lock_reset</span>
		</div>
		<h1 class="vs-reset-title">Nueva contraseña</h1>

		{#if success}
			<div class="vs-reset-success" role="status">
				<span class="material-icons-round">check_circle</span>
				<p>Contraseña actualizada. Te llevamos a <strong>Iniciar Sesión</strong>&hellip;</p>
			</div>
		{:else}
			{#if error}
				<div class="vs-reset-error" role="alert">
					<span class="material-icons-round">error</span>
					<span>{error}</span>
				</div>
			{/if}

			{#if token}
				<form onsubmit={handleReset} class="vs-reset-form">
					<div class="vs-form-group">
						<label for="rp-pass" class="vs-form-label"><span>Nueva contraseña</span></label>
						<div class="vs-input-wrapper">
							<div class="vs-input-lead-icon">
								<span class="material-icons-round" style="font-size: 17px;">password</span>
							</div>
							<input
								id="rp-pass"
								type={showPass ? 'text' : 'password'}
								bind:value={password}
								class="aero-input vs-custom-input"
								placeholder="Mínimo 8 caracteres"
								autocomplete="new-password"
								required
							/>
							<button
								type="button"
								class="vs-pass-toggle"
								aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
								onclick={() => (showPass = !showPass)}
							>
								<span class="material-icons-round" style="font-size: 17px;">
									{showPass ? 'visibility_off' : 'visibility'}
								</span>
							</button>
						</div>
						{#if password && !passwordValid}
							<p class="vs-field-error">La contraseña debe tener al menos 8 caracteres.</p>
						{/if}
					</div>

					<div class="vs-form-group">
						<label for="rp-pass2" class="vs-form-label"><span>Confirmar contraseña</span></label>
						<div class="vs-input-wrapper">
							<div class="vs-input-lead-icon">
								<span class="material-icons-round" style="font-size: 17px;">lock</span>
							</div>
							<input
								id="rp-pass2"
								type={showPass ? 'text' : 'password'}
								bind:value={confirmPassword}
								class="aero-input vs-custom-input"
								placeholder="Repite la contraseña"
								autocomplete="new-password"
								required
							/>
						</div>
						{#if confirmPassword && !passwordsMatch}
							<p class="vs-field-error">Las contraseñas no coinciden.</p>
						{/if}
					</div>

					<button
						type="submit"
						class="btn-aero-primary vs-reset-btn"
						disabled={!formValid || loading}
					>
						{#if loading}
							<span class="material-icons-round spin" style="font-size: 18px;">sync</span>
							<span>Guardando&hellip;</span>
						{:else}
							<span>Guardar contraseña</span>
						{/if}
					</button>
				</form>
			{:else}
				<a href="/login" class="btn-aero-primary vs-reset-btn">Volver a Iniciar Sesión</a>
			{/if}
		{/if}
	</main>
</div>

<style>
	.vs-reset-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
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
	.vs-reset-header {
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

	.vs-reset-card {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 16px;
		width: 100%;
		max-width: 420px;
		padding: 36px 34px;
		border-radius: var(--radius-xl, var(--radius-lg));
		background: var(--bg-surface, var(--bg-overlay));
		border: 1px solid var(--glass-border);
		box-shadow: var(--shadow-lg, 0 20px 60px rgb(0 0 0 / 0.25));
	}
	.vs-reset-icon {
		align-self: center;
		width: 72px;
		height: 72px;
		display: grid;
		place-items: center;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--accent-blue-base, #38bdf8) 14%, transparent);
		border: 1px solid var(--glass-border);
	}
	.vs-reset-icon .material-icons-round {
		font-size: 32px;
		color: var(--accent-blue-base, var(--aero-sky));
	}
	.vs-reset-title {
		margin: 0;
		text-align: center;
		font-size: 1.35rem;
		font-weight: 800;
		color: var(--text-primary);
	}

	.vs-reset-form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.vs-form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.vs-form-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-secondary);
	}
	.vs-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
	}
	.vs-input-lead-icon {
		position: absolute;
		left: 12px;
		display: grid;
		place-items: center;
		color: var(--text-tertiary);
		pointer-events: none;
	}
	.vs-custom-input {
		width: 100%;
		padding-left: 40px;
		padding-right: 42px;
	}
	.vs-pass-toggle {
		position: absolute;
		right: 8px;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border: none;
		background: transparent;
		border-radius: var(--radius-full);
		color: var(--text-tertiary);
		cursor: pointer;
	}
	.vs-pass-toggle:hover {
		color: var(--text-primary);
	}
	.vs-field-error {
		font-size: 0.68rem;
		color: #f87171;
		font-weight: 600;
		margin: 0.1rem 0 0 0;
	}

	.vs-reset-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 12px 22px;
		margin-top: 4px;
		text-decoration: none;
	}
	.vs-reset-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.vs-reset-error {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, #f87171 12%, transparent);
		border: 1px solid color-mix(in srgb, #f87171 35%, transparent);
		color: #f87171;
		font-size: 0.8rem;
		font-weight: 600;
	}
	.vs-reset-success {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--aero-mint, #34d399) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--aero-mint, #34d399) 35%, transparent);
		color: var(--aero-mint, #34d399);
		font-size: 0.85rem;
	}
	.vs-reset-success p {
		margin: 0;
	}

	.spin {
		animation: vs-spin 0.9s linear infinite;
	}
	@keyframes vs-spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spin {
			animation: none;
		}
	}
</style>
