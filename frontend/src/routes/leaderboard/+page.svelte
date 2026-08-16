<script>
	import { fade } from 'svelte/transition';
	import AuroraPillar from '$lib/components/gamification/AuroraPillar.svelte';
	import LeaderboardTabs from '$lib/components/gamification/LeaderboardTabs.svelte';
	import PodiumCard from '$lib/components/gamification/PodiumCard.svelte';
	import LeaderboardRow from '$lib/components/gamification/LeaderboardRow.svelte';
	import CurrentUserCard from '$lib/components/gamification/CurrentUserCard.svelte';
	import { authStore } from '$lib/stores/auth.svelte.js';

	let type = $state('level'); // Tipo de contenido visible (pilar, beacon, datos)
	let activeTab = $state('level'); // Controls the UI tabs instantly
	let users = $state([]);
	let currentUserRank = $state(null);
	let currentUserData = $state(null);
	let loading = $state(true);
	let error = $state(null);

	// Cache para cambios de pestaña instantáneos
	let cache = $state({});

	// Fade fluido al cambiar entre Niveles/Rachas (ver applyContent)
	let contentEl = $state(undefined); // bind:this del contenedor de contenido
	let contentPhase = $state(''); // '' | 'leaving' | 'entering'
	let fadeToken = 0; // invalida fades obsoletos ante clics rápidos
	let hasShown = $state(false); // el primer render aparece sin fade

	async function fetchLeaderboard(targetType) {
		if (cache[targetType]) {
			applyContent(targetType, cache[targetType]);
			loading = false;
			return;
		}

		// Only show full-page spinner on the very first load
		if (Object.keys(cache).length === 0) {
			loading = true;
		}

		error = null;
		try {
			const res = await fetch(`/api/gamification/leaderboard?type=${targetType}`, {
				headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
			});
			if (res.ok) {
				const data = await res.json();
				cache[targetType] = data;
				applyContent(targetType, data);
			} else {
				if (activeTab === targetType && !cache[targetType]) {
					error = 'No pudimos cargar la clasificación. Inténtalo de nuevo.';
				}
			}
		} catch (e) {
			console.error(e);
			if (activeTab === targetType && !cache[targetType]) {
				error = 'No pudimos cargar la clasificación. Inténtalo de nuevo.';
			}
		} finally {
			if (activeTab === targetType) {
				loading = false;
			}
		}
	}

	// Aplica los datos de la pestaña con un fundido fluido. La transición corre
	// sobre el elemento .lb-content PERSISTENTE: las transiciones CSS completan
	// su estado final aunque el entorno congele el reloj de animación, y el
	// temporizador de respaldo garantiza que el contenido NUNCA quede invisible
	// a medias (si transitionend no se dispara, el timer termina la secuencia).
	function applyContent(targetType, data) {
		if (activeTab !== targetType) return;

		if (!hasShown) {
			// Primer render: el contenido aparece al instante (sin fade).
			commitContent(targetType, data);
			hasShown = true;
			return;
		}

		const token = ++fadeToken;
		contentPhase = 'leaving'; // funde a 0 (transición CSS)

		let finished = false;
		const finish = async () => {
			if (finished || token !== fadeToken) return;
			finished = true;
			clearTimeout(fallback);

			commitContent(targetType, data);

			// Fundido de entrada con origen desplazado: el contenido nuevo entra
			// desde la derecha. La clase intermedia se fuerza con un reflow antes
			// de limpiarla para que la transición arranque desde esa posición.
			contentPhase = 'entering';
			await tick();
			if (token !== fadeToken) return; // un clic más reciente tomó el control
			void contentEl?.offsetHeight;
			contentPhase = '';
		};

		// Acelerador en navegadores; en entornos donde transitionend no se
		// dispara (webviews), el timer termina la secuencia igualmente.
		contentEl?.addEventListener('transitionend', () => finish(), { once: true });
		const fallback = setTimeout(finish, 380);
	}

	function commitContent(targetType, data) {
		users = data.users || [];
		currentUserRank = data.currentUserRank;
		currentUserData = data.currentUserData;
		type = targetType; // cambia el pilar, el acento del beacon y el contenido
	}

	import { onMount, tick } from 'svelte';
	onMount(() => {
		fetchLeaderboard(activeTab);
	});

	let top3 = $derived(users.slice(0, 3));
	let rest = $derived(users.slice(3));

	// Visual podium order: silver (2) — gold (1) — bronze (3)
	let podiumOrder = $derived([top3[1], top3[0], top3[2]].filter(Boolean));
	let getRank = (user) => users.indexOf(user) + 1;

	let showBeacon = $derived(!loading && currentUserData && currentUserRank);

	function changeType(next) {
		if (activeTab === next) return;
		activeTab = next;
		fetchLeaderboard(next);
	}
</script>

<svelte:head>
	<title>Salón de la Fama · VSocial</title>
</svelte:head>

<main class="lb-page" class:has-beacon={showBeacon}>
	<AuroraPillar {type} />

	<!-- Header -->
	<header class="lb-header">
		<p class="lb-eyebrow">Comunidad VSocial</p>
		<h1 class="lb-title">Salón de la Fama</h1>
		<p class="lb-subtitle">
			{activeTab === 'level'
				? 'Los creadores que más han crecido en la plataforma.'
				: 'Las rachas más constantes, día tras día.'}
		</p>
	</header>

	<!-- Tabs -->
	<div class="lb-tabs-row">
		<LeaderboardTabs type={activeTab} onChange={changeType} />
	</div>

	<div id="lb-panel" role="tabpanel" aria-labelledby="lb-tab-{type}" class="lb-panel">
		{#if loading && users.length === 0}
			<div class="lb-loading" aria-live="polite" aria-busy="true">
				<div class="lb-spinner"></div>
				<p>Cargando clasificación…</p>
			</div>
		{:else if error && users.length === 0}
			<div class="lb-empty" in:fade={{ duration: 300 }} out:fade={{ duration: 200 }} role="alert">
				<span class="material-icons-round lb-empty__icon">error_outline</span>
				<h2 class="lb-empty__title">Algo salió mal</h2>
				<p class="lb-empty__text">{error}</p>
				<button type="button" class="lb-retry" onclick={fetchLeaderboard}>Reintentar</button>
			</div>
		{:else if users.length === 0}
			<div class="lb-empty" in:fade={{ duration: 300 }} out:fade={{ duration: 200 }}>
				<span class="material-icons-round lb-empty__icon">emoji_events</span>
				<h2 class="lb-empty__title">Aún no hay registros</h2>
				<p class="lb-empty__text">Sé el primero en aparecer en esta clasificación.</p>
			</div>
		{:else}
			<div
				class="lb-content"
				class:lb-content--leaving={contentPhase === 'leaving'}
				class:lb-content--entering={contentPhase === 'entering'}
				bind:this={contentEl}
			>
				<!-- Podium -->
				{#if top3.length > 0}
					<div class="lb-podium" role="list" aria-label="Top 3">
						{#each podiumOrder as user (user.id)}
							<div class="lb-podium__slot lb-podium__slot--{getRank(user)}" role="listitem">
								<PodiumCard {user} rank={getRank(user)} {type} />
							</div>
						{/each}
					</div>
				{/if}

				<!-- List -->
				{#if rest.length > 0}
					<ol class="lb-list" aria-label="Resto de la clasificación">
						{#each rest as user, i (user.id)}
							<li>
								<LeaderboardRow
									{user}
									{type}
									rank={i + 4}
									isCurrentUser={currentUserData && currentUserData.id === user.id}
								/>
							</li>
						{/each}
					</ol>
				{/if}
			</div>
		{/if}
	</div>
</main>

{#if showBeacon}
	<!-- Sin transición de entrada: si el reloj de animación se congela a mitad
	     de vuelo, un transform congelado en el ancestro rompe el position: fixed
	     del dock y desalinea el beacon. Aparece directo, siempre bien alineado. -->
	<CurrentUserCard user={currentUserData} rank={currentUserRank} {type} />
{/if}

<style>
	.lb-page {
		position: relative;
		max-width: 720px;
		margin: 0 auto;
		padding: 2rem 1rem 4rem;
		min-height: 90vh;
	}
	/* Room for the fixed beacon so the last row stays reachable */
	.lb-page.has-beacon {
		padding-bottom: 8.5rem;
	}
	/* En móvil el beacon se levanta por encima de la barra de navegación inferior */
	@media (max-width: 768px) {
		.lb-page.has-beacon {
			padding-bottom: calc(8.5rem + 88px);
		}
	}

	/* ── Header ── */
	.lb-header {
		position: relative;
		z-index: 10;
		text-align: center;
		margin-bottom: 1.75rem;
	}
	.lb-eyebrow {
		font-family: var(--font-display);
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		color: var(--aero-sky);
		margin: 0 0 0.5rem;
	}
	.lb-title {
		font-family: var(--font-display);
		font-size: clamp(2.1rem, 6vw, 3.4rem);
		font-weight: 900;
		letter-spacing: -0.03em;
		line-height: 1.02;
		color: var(--text-primary);
		margin: 0;
		text-shadow: 0 4px 24px rgba(var(--accent-blue-rgb), 0.25);
	}
	.lb-subtitle {
		max-width: 34ch;
		margin: 0.6rem auto 0;
		font-size: 0.95rem;
		color: var(--text-muted);
	}

	.lb-tabs-row {
		position: relative;
		z-index: 20;
		display: flex;
		justify-content: center;
		margin-bottom: 2rem;
	}

	.lb-panel {
		position: relative;
		z-index: 10;
		display: grid;
		align-items: start;
		/* La columna debe ajustarse al contenedor (no al max-content de los
		   ítems), o el podio desborda en móviles. */
		grid-template-columns: minmax(0, 1fr);
	}
	.lb-panel > * {
		grid-area: 1 / 1;
		min-width: 0;
	}
	.lb-content {
		display: flex;
		flex-direction: column;
		width: 100%;
		/* Fundido fluido al cambiar entre Niveles/Rachas. La transición corre
		   sobre este elemento persistente, así que completa su estado final
		   incluso si el entorno congela el reloj de animación; el timer de
		   applyContent garantiza que el contenido nunca quede invisible a medias. */
		transition:
			opacity 0.22s ease,
			transform 0.22s ease;
	}
	.lb-content--leaving {
		opacity: 0;
		transform: translateX(-14px);
	}
	.lb-content--entering {
		opacity: 0;
		transform: translateX(14px);
	}

	/* ── Podium ── */
	.lb-podium {
		display: flex;
		justify-content: center;
		align-items: flex-end;
		gap: 12px;
		margin-top: 4.5rem;
		padding-bottom: 1rem;
		width: 100%;
		max-width: 100%;
	}
	.lb-podium__slot {
		/* Basis 0 + min-width 0: slots reparten el ancho disponible y las tarjetas
		   (width: 100%) se encogen con ellos. max-width fija el ancho objetivo en
		   pantallas anchas sin depender del contenido. */
		flex: 1 1 0;
		min-width: 0;
		max-width: 145px;
	}
	.lb-podium__slot--1 {
		order: 2;
		max-width: 168px;
	}
	.lb-podium__slot--2 {
		order: 1;
	}
	.lb-podium__slot--3 {
		order: 3;
	}

	/* ── List ── */
	.lb-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 2.5rem 0 0;
		padding: 0;
	}

	/* ── Loading ── */
	.lb-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 5rem 1rem;
		color: var(--text-muted);
	}
	.lb-spinner {
		width: 42px;
		height: 42px;
		border: 3px solid var(--glass-border);
		border-top-color: var(--aero-sky);
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ── Empty / Error ── */
	.lb-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.35rem;
		max-width: 32rem;
		margin: 3.5rem auto 0;
		padding: 3.5rem 1.5rem;
		border-radius: var(--radius-xl, 24px);
		border: 1px solid transparent;
		background:
			linear-gradient(var(--glass-bg), var(--glass-bg)) padding-box,
			linear-gradient(
					135deg,
					rgba(255, 255, 255, 0.28),
					rgba(255, 255, 255, 0.06) 50%,
					rgba(var(--accent-blue-rgb), 0.2)
				)
				border-box;
		box-shadow: var(--shadow-md);
		backdrop-filter: var(--lb-glass-blur);
		-webkit-backdrop-filter: var(--lb-glass-blur);
	}
	.lb-empty__icon {
		font-size: 3rem;
		color: var(--text-muted);
		opacity: 0.5;
		margin-bottom: 0.5rem;
	}
	.lb-empty__title {
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--text-primary);
		margin: 0;
	}
	.lb-empty__text {
		font-size: 0.9rem;
		color: var(--text-muted);
		margin: 0;
	}
	.lb-retry {
		margin-top: 1rem;
		padding: 10px 24px;
		border: none;
		border-radius: 999px;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 0.85rem;
		color: #fff;
		background: linear-gradient(120deg, var(--aero-sky), var(--aero-mint));
		box-shadow: 0 4px 16px rgba(46, 180, 255, 0.4);
		cursor: pointer;
		transition: transform 0.2s var(--ease-spring);
	}
	.lb-retry:hover {
		transform: translateY(-2px);
	}
	.lb-retry:focus-visible {
		outline: 2px solid var(--accent-cyan);
		outline-offset: 3px;
	}

	@media (min-width: 640px) {
		.lb-podium {
			gap: 32px;
			margin-top: 5.5rem;
		}
	}

	/* Podium responsive: los slots son fluidos (flex: 1 1 0, min-width: 0) y las
	   tarjetas usan max-width en vez de width fija, así el podio nunca desborda
	   el viewport en móviles (sin depender de transform: scale). */
	@media (max-width: 480px) {
		.lb-podium {
			gap: 8px;
		}
	}
	/* [VSocial: reduced-motion removido — spinner siempre a velocidad original] */
</style>
