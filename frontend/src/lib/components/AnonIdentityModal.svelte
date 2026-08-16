<script>
	import { fade, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { createAnonIdentity } from '$lib/stores/anonIdentity.svelte.js';

	// `open` controla el modal; `onCreated(username)` se llama al crearla con éxito
	let { open = false, onCreated = () => {}, onClose = () => {} } = $props();

	let username = $state('');
	let error = $state('');
	let creating = $state(false);
	let touched = $state(false);

	const RESERVED = ['anonimo', 'anonymous', 'usuario', 'admin', 'vsocial', 'anon', 'nuevo_usuario'];

	let validation = $derived.by(() => {
		const name = username.trim();
		if (!name) return { ok: false, hint: 'Elige un nombre para tu identidad anónima.' };
		if (!/^[a-zA-Z0-9_]+$/.test(name))
			return { ok: false, hint: 'Solo letras, números y guion bajo (_).' };
		if (name.length < 3 || name.length > 24) return { ok: false, hint: 'Entre 3 y 24 caracteres.' };
		if (RESERVED.includes(name.toLowerCase()))
			return { ok: false, hint: 'Ese nombre no está disponible.' };
		return { ok: true, hint: 'Disponible y permanente. ¡No podrás cambiarlo!' };
	});

	async function submit() {
		if (!validation.ok || creating) return;
		creating = true;
		error = '';
		try {
			const identity = await createAnonIdentity(username.trim());
			onCreated?.(identity?.anon_username || username.trim());
			username = '';
			touched = false;
		} catch (err) {
			error = err?.message || 'No se pudo crear la identidad anónima. Inténtalo de nuevo.';
		} finally {
			creating = false;
		}
	}

	function close() {
		if (creating) return;
		error = '';
		touched = false;
		onClose?.();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="aero-modal-backdrop"
		onclick={(e) => e.target === e.currentTarget && close()}
		transition:fade={{ duration: 150 }}
	>
		<div
			class="aero-modal-content anon-modal"
			transition:scale={{ duration: 250, start: 0.95, easing: backOut }}
		>
			<div class="anon-modal-accent" aria-hidden="true"></div>

			<div class="anon-modal-head">
				<div class="anon-modal-icon">
					<span class="material-icons-round">theater_comedy</span>
				</div>
				<div>
					<h3 class="anon-modal-title">Tu Identidad Anónima</h3>
					<p class="anon-modal-sub">
						Crea tu username exclusivo para publicar y comentar de forma anónima. Se elige
						<strong>una sola vez</strong> y queda fijo para siempre.
					</p>
				</div>
				<button type="button" class="anon-modal-close" onclick={close} aria-label="Cerrar">
					<span class="material-icons-round">close</span>
				</button>
			</div>

			<div class="anon-modal-body">
				<label class="anon-field-label" for="anon_username_input">Username anónimo</label>
				<div class="anon-input-shell" class:error={!!error || (touched && !validation.ok)}>
					<span class="anon-input-at">@</span>
					<input
						id="anon_username_input"
						type="text"
						autocomplete="off"
						spellcheck="false"
						maxlength="24"
						placeholder="p.ej. LunaRoja_99"
						bind:value={username}
						oninput={() => {
							touched = true;
							error = '';
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter') submit();
						}}
					/>
				</div>

				<div
					class="anon-hint"
					class:ok={validation.ok && username.trim()}
					class:bad={!validation.ok && username.trim()}
				>
					<span class="material-icons-round anon-hint-icon">
						{#if username.trim() && validation.ok}check_circle{:else if username.trim()}error_outline{:else}info_outline{/if}
					</span>
					<span>{username.trim() ? validation.hint : validation.hint}</span>
				</div>

				{#if error}
					<div class="anon-error-banner" role="alert">
						<span class="material-icons-round">error_outline</span>
						<span>{error}</span>
					</div>
				{/if}

				<ul class="anon-rules">
					<li>
						<span class="material-icons-round">verified_user</span> Es exclusivo: nadie más podrá usarlo
						en posts anónimos.
					</li>
					<li>
						<span class="material-icons-round">lock</span> Permanente: no se puede cambiar después de
						elegirlo.
					</li>
					<li>
						<span class="material-icons-round">visibility_off</span> Tu perfil real nunca aparece vinculado.
					</li>
				</ul>
			</div>

			<div class="anon-modal-actions">
				<button type="button" class="anon-btn-ghost" onclick={close}>Cancelar</button>
				<button
					type="button"
					class="anon-btn-primary"
					disabled={!validation.ok || creating}
					onclick={submit}
				>
					{#if creating}
						<span class="mini-spinner"></span> Creando…
					{:else}
						<span class="material-icons-round">masks</span> Crear mi identidad anónima
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.anon-modal {
		position: relative;
		max-width: 460px;
		padding: 0;
	}
	.anon-modal-accent {
		height: 3px;
		background: linear-gradient(90deg, #818cf8 0%, #38bdf8 50%, #34d399 100%);
	}
	.anon-modal-head {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		padding: 20px 20px 14px;
	}
	.anon-modal-icon {
		width: 42px;
		height: 42px;
		flex: 0 0 42px;
		border-radius: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(
			--anon-gradient,
			linear-gradient(135deg, rgba(99, 102, 241, 0.28), rgba(34, 211, 238, 0.2))
		);
		border: 1px solid var(--anon-border, rgba(129, 140, 248, 0.45));
		color: var(--anon-accent, #818cf8);
		box-shadow: 0 4px 14px rgba(99, 102, 241, 0.25);
	}
	.anon-modal-title {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.05rem;
		color: var(--text-primary);
	}
	.anon-modal-sub {
		margin: 4px 0 0;
		font-size: 0.8rem;
		line-height: 1.5;
		color: var(--text-muted);
	}
	.anon-modal-sub strong {
		color: var(--text-secondary);
	}
	.anon-modal-close {
		margin-left: auto;
		width: 30px;
		height: 30px;
		border-radius: 10px;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
	}
	.anon-modal-close:hover {
		color: var(--text-primary);
		border-color: rgba(var(--accent-blue-rgb), 0.4);
	}
	.anon-modal-body {
		padding: 6px 20px 4px;
	}
	.anon-field-label {
		display: block;
		font-size: 0.72rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		margin-bottom: 8px;
	}
	.anon-input-shell {
		display: flex;
		align-items: center;
		gap: 8px;
		border: 1px solid var(--border-subtle);
		border-radius: 14px;
		background: var(--bg-input);
		box-shadow: var(--input-shadow-inner);
		transition:
			border-color var(--t-fast),
			box-shadow var(--t-fast);
	}
	.anon-input-shell:focus-within {
		border-color: var(--aero-sky);
		box-shadow:
			0 0 0 3px rgba(0, 229, 255, 0.16),
			var(--input-shadow-inner);
	}
	.anon-input-shell.error {
		border-color: var(--aero-rose);
	}
	.anon-input-at {
		padding-left: 16px;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.1rem;
		color: var(--aero-sky);
	}
	.anon-input-shell input {
		flex: 1;
		background: transparent;
		border: none;
		outline: none;
		padding: 12px 16px 12px 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-primary);
		font-family: var(--font-mono);
	}
	.anon-hint {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 8px;
		font-size: 0.74rem;
		color: var(--text-muted);
	}
	.anon-hint.ok {
		color: var(--aero-mint);
	}
	.anon-hint.bad {
		color: var(--aero-rose);
	}
	.anon-hint-icon {
		font-size: 15px;
	}
	.anon-error-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
		padding: 9px 12px;
		border-radius: 12px;
		background: rgba(244, 63, 94, 0.12);
		border: 1px solid rgba(244, 63, 94, 0.3);
		color: #fb7185;
		font-size: 0.78rem;
		font-weight: 600;
	}
	.anon-rules {
		list-style: none;
		margin: 14px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.anon-rules li {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.74rem;
		color: var(--text-muted);
	}
	.anon-rules .material-icons-round {
		font-size: 14px;
		color: var(--anon-accent, #818cf8);
	}
	.anon-modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 18px 20px 20px;
	}
	.anon-btn-ghost {
		padding: 9px 16px;
		border-radius: 12px;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		color: var(--text-secondary);
		font-weight: 700;
		font-size: 0.82rem;
		cursor: pointer;
	}
	.anon-btn-ghost:hover {
		border-color: rgba(var(--accent-blue-rgb), 0.4);
		color: var(--aero-sky);
	}
	.anon-btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 9px 18px;
		border-radius: 12px;
		border: none;
		background: var(--grad-primary);
		color: #ffffff;
		font-weight: 800;
		font-size: 0.82rem;
		cursor: pointer;
		box-shadow: 0 6px 16px rgba(var(--accent-blue-rgb), 0.35);
		transition: all var(--t-fast);
	}
	.anon-btn-primary:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 8px 20px rgba(var(--accent-blue-rgb), 0.45);
	}
	.anon-btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		filter: saturate(0.5);
	}
	.mini-spinner {
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255, 255, 255, 0.35);
		border-top-color: #ffffff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		display: inline-block;
	}
</style>
