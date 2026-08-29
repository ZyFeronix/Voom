<script>
	import { fade } from 'svelte/transition';
	import { onMount, onDestroy, tick } from 'svelte';
	import ArenaBackdrop from '$lib/components/gamification/ArenaBackdrop.svelte';
	import LeaderboardTabs from '$lib/components/gamification/LeaderboardTabs.svelte';
	import LeaderboardSkeleton from '$lib/components/gamification/LeaderboardSkeleton.svelte';
	import PodiumCard from '$lib/components/gamification/PodiumCard.svelte';
	import LeaderboardRow from '$lib/components/gamification/LeaderboardRow.svelte';
	import CurrentUserCard from '$lib/components/gamification/CurrentUserCard.svelte';
	import CountUp from '$lib/components/gamification/CountUp.svelte';
	import { authStore } from '$lib/stores/auth.svelte.js';

	/**
	 * /leaderboard — ARENA Voom! (Salón de la Fama v2)
	 * Tres rankings (Niveles · Rachas · Creadores), podio de pedestals,
	 * búsqueda client-side, franja "Tu vecindario" cuando estás fuera del top,
	 * deltas ▲▼ vs la última visita (localStorage) y beacon fijo con progreso.
	 */

	const TYPES = ['level', 'streak', 'creators'];
	const DELTAS_KEY = 'vsocial_lb_deltas_v1';
	const DELTA_BASELINE_MS = 15 * 60 * 1000; // la base de comparación se renueva cada 15 min

	let activeTab = $state('level'); // pestaña activa (UI instantánea)
	let boardType = $state('level'); // tipo comprometido en pantalla (acento del escenario)
	let users = $state([]);
	let total = $state(null);
	let currentUserRank = $state(null);
	let currentUserData = $state(null);
	let neighbors = $state([]);
	let deltasByUser = $state({});
	let query = $state('');
	let loading = $state(true);
	let error = $state(null);

	// Cache en memoria por tipo: cambio de pestaña instantáneo tras la 1.ª carga.
	let cache = {};

	// Fundido fluido entre pestañas sobre un elemento PERSISTENTE (.lb-content):
	// las transiciones CSS completan su estado final aunque el entorno congele
	// el reloj de animación; el timer de respaldo garantiza que el contenido
	// NUNCA quede invisible a medias si transitionend no se dispara.
	let contentEl = $state(undefined);
	let contentPhase = $state(''); // '' | 'leaving' | 'entering'
	let fadeToken = 0;
	let hasShown = false;

	// Petición en vuelo: se aborta al cambiar de pestaña o desmontar.
	let inflight = null;

	const COPY = {
		level: {
			subtitle: 'Los creadores que más han crecido en la plataforma.',
			unit: 'XP',
			icon: 'star'
		},
		streak: {
			subtitle: 'Las rachas más constantes, día tras día.',
			unit: 'días',
			icon: 'local_fire_department'
		},
		creators: {
			subtitle: 'Los creadores con más interacción en los últimos 30 días.',
			unit: 'interacciones',
			icon: 'auto_awesome'
		}
	};

	let copy = $derived(COPY[boardType] || COPY.level);

	let top3 = $derived(users.slice(0, 3));
	let rest = $derived(users.slice(3));

	// Orden visual del podio: plata (2) — oro (1) — bronce (3)
	let podiumOrder = $derived([top3[1], top3[0], top3[2]].filter(Boolean));

	let searching = $derived(query.trim().length > 0);
	let matches = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return users.filter(
			(u) =>
				(u.display_name || '').toLowerCase().includes(q) ||
				(u.username || '').toLowerCase().includes(q)
		);
	});

	// Vecindario: solo tiene sentido viendo la clasificación completa.
	let showNeighbors = $derived(
		!searching &&
			neighbors.length > 0 &&
			currentUserData != null &&
			(currentUserRank == null || currentUserRank > users.length)
	);

	let showBeacon = $derived(!loading && currentUserData && currentUserRank);

	let leaderValue = $derived.by(() => {
		const u = users[0];
		if (!u) return 0;
		if (boardType === 'streak') return u.checkin_streak || 0;
		if (boardType === 'creators') return u.engagement || 0;
		return u.xp_points || 0;
	});

	/* ── Deltas ▲▼ vs la última visita ─────────────────────────────── */
	function readDeltaStore() {
		try {
			return JSON.parse(localStorage.getItem(DELTAS_KEY)) || {};
		} catch {
			return {};
		}
	}

	function computeDeltas(type, rankEntries) {
		// rankEntries: [{ id, rank }] de top + vecinos + usuario actual.
		const store = readDeltaStore();
		const entry = store[type];
		const prev = entry && entry.ranks ? entry.ranks : {};
		const deltas = {};
		for (const { id, rank } of rankEntries) {
			const before = prev[id];
			if (before != null) deltas[id] = before - rank; // >0 subió
		}
		// La base de comparación se refresca con moderación para que los
		// cambios de pestaña dentro de una misma sesión no la reseteen.
		const now = Date.now();
		if (!entry || now - (entry.at || 0) > DELTA_BASELINE_MS) {
			store[type] = {
				at: now,
				ranks: Object.fromEntries(rankEntries.map((r) => [String(r.id), r.rank]))
			};
			try {
				localStorage.setItem(DELTAS_KEY, JSON.stringify(store));
			} catch {
				/* cuota llena o storage bloqueado: los deltas simplemente no persisten */
			}
		}
		return deltas;
	}

	/* ── Aplicar datos con fundido robusto ─────────────────────────── */
	function commitContent(targetType, data) {
		users = data.users || [];
		total = data.total ?? null;
		currentUserRank = data.currentUserRank ?? null;
		currentUserData = data.currentUserData ?? null;
		neighbors = data.neighbors || [];

		boardType = targetType;

		// Deltas sobre TODO lo visible: top, vecinos y el propio usuario.
		const entries = [
			...(data.users || []).map((u, i) => ({ id: u.id, rank: i + 1 })),
			...(data.neighbors || []).map((n) => ({ id: n.id, rank: n.rank }))
		];
		if (data.currentUserRank != null && data.currentUserData) {
			entries.push({ id: data.currentUserData.id, rank: data.currentUserRank });
		}
		deltasByUser = computeDeltas(targetType, entries);
	}

	function applyContent(targetType, data) {
		if (activeTab !== targetType) return;

		if (!hasShown) {
			commitContent(targetType, data);
			hasShown = true;
			return;
		}

		const token = ++fadeToken;
		contentPhase = 'leaving'; // funde a 0

		let finished = false;
		const finish = () => {
			if (finished || token !== fadeToken) return;
			finished = true;
			clearTimeout(fallback);

			commitContent(targetType, data);

			// Entrada desde la derecha: se fuerza la clase intermedia con un
			// reflow antes de limpiarla para que la transición arranque ahí.
			contentPhase = 'entering';
			tick().then(() => {
				if (token !== fadeToken) return; // un clic más reciente tomó el control
				void contentEl?.offsetHeight;
				contentPhase = '';
			});
		};

		contentEl?.addEventListener('transitionend', () => finish(), { once: true });
		const fallback = setTimeout(finish, 380);
	}

	async function fetchLeaderboard(targetType, { force = false } = {}) {
		if (!TYPES.includes(targetType)) return;

		inflight?.abort();

		if (cache[targetType] && !force) {
			applyContent(targetType, cache[targetType]);
			loading = false;
			return;
		}
		// Skeleton de página completa solo en la primera carga con datos.
		if (Object.keys(cache).length === 0) loading = true;

		error = null;
		const controller = new AbortController();
		inflight = controller;
		const isCurrent = () => inflight === controller;

		try {
			const res = await fetch(`/api/gamification/leaderboard?type=${targetType}`, {
				headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
				signal: controller.signal
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			cache[targetType] = data;
			applyContent(targetType, data);
		} catch (e) {
			if (e?.name === 'AbortError') return;
			console.error('[Leaderboard]', e);
			if (activeTab === targetType && !cache[targetType]) {
				error = 'No pudimos cargar la clasificación. Inténtalo de nuevo.';
			}
		} finally {
			// Solo la petición vigente toca el estado de carga; las abortadas
			// no esconden el skeleton de la petición que la reemplazó.
			if (isCurrent() && activeTab === targetType) {
				loading = false;
			}
		}
	}

	function retry() {
		delete cache[activeTab];
		fetchLeaderboard(activeTab, { force: true });
	}

	function changeType(next) {
		if (activeTab === next) return;
		activeTab = next;
		query = ''; // la búsqueda es por-tablero
		if (cache[next]) {
			applyContent(next, cache[next]);
		} else {
			fetchLeaderboard(next);
		}
	}

	onMount(() => {
		fetchLeaderboard(activeTab);
	});

	onDestroy(() => {
		inflight?.abort();
	});
</script>

<svelte:head>
	<title>Salón de la Fama · Voom!</title>
</svelte:head>

<main class="lb-page" class:has-beacon={showBeacon}>
	<ArenaBackdrop type={boardType} />

	<!-- ══ Cabecera ceremonial ══ -->
	<header class="lb-header">
		<p class="lb-eyebrow">Arena Voom!</p>
		<h1 class="lb-title">Salón de la Fama</h1>
		<p class="lb-subtitle">{copy.subtitle}</p>

		<div class="lb-strip" role="list" aria-label="Resumen de la clasificación">
			<div class="strip-chip" role="listitem">
				<span class="material-icons-round strip-icon" aria-hidden="true">groups</span>
				<span class="strip-body">
					<strong>
						{#if total != null}
							<CountUp value={total} />
						{:else}
							—
						{/if}
					</strong>
					<span>clasificados</span>
				</span>
			</div>
			<div class="strip-chip" role="listitem">
				<span class="material-icons-round strip-icon" aria-hidden="true">my_location</span>
				<span class="strip-body">
					<strong>
						{#if currentUserRank != null}
							#{currentUserRank}
						{:else if authStore.isAuthenticated}
							Sin puesto
						{:else}
							<a href="/login" class="strip-login">Inicia sesión</a>
						{/if}
					</strong>
					<span>tu puesto</span>
				</span>
			</div>
			<div class="strip-chip" role="listitem">
				<span class="material-icons-round strip-icon strip-icon--lead" aria-hidden="true"
					>{copy.icon}</span
				>
				<span class="strip-body">
					<strong><CountUp value={leaderValue} /></strong>
					<span>del líder · {copy.unit}</span>
				</span>
			</div>
		</div>
	</header>

	<!-- ══ Pestañas ══ -->
	<div class="lb-tabs-row">
		<LeaderboardTabs type={activeTab} onChange={changeType} />
	</div>

	<!-- ══ Panel ══ -->
	<div id="lb-panel" role="tabpanel" aria-labelledby="lb-tab-{activeTab}" class="lb-panel">
		{#if loading && users.length === 0}
			<LeaderboardSkeleton />
		{:else if error && users.length === 0}
			<div class="lb-empty" in:fade={{ duration: 300 }} out:fade={{ duration: 200 }} role="alert">
				<span class="material-icons-round lb-empty__icon">error_outline</span>
				<h2 class="lb-empty__title">Algo salió mal</h2>
				<p class="lb-empty__text">{error}</p>
				<button type="button" class="lb-retry" onclick={retry}>Reintentar</button>
			</div>
		{:else if users.length === 0}
			<div class="lb-empty" in:fade={{ duration: 300 }} out:fade={{ duration: 200 }}>
				<span class="material-icons-round lb-empty__icon">emoji_events</span>
				<h2 class="lb-empty__title">Aún no hay registros</h2>
				<p class="lb-empty__text">
					{activeTab === 'streak'
						? 'Haz tu check-in diario para iniciar la primera racha.'
						: activeTab === 'creators'
							? 'Publica contenido y genera interacciones este mes para estrenar esta clasificación.'
							: 'Publica, comenta y reacciona para ganar los primeros puntos.'}
				</p>
				<a href="/posts/create" class="lb-retry">Crear publicación</a>
			</div>
		{:else}
			<div
				class="lb-content"
				class:lb-content--leaving={contentPhase === 'leaving'}
				class:lb-content--entering={contentPhase === 'entering'}
				bind:this={contentEl}
			>
				<!-- Búsqueda (aparece con suficiente competencia) -->
				{#if users.length > 8}
					<div class="lb-search">
						<span class="material-icons-round lb-search__icon" aria-hidden="true">search</span>
						<input
							type="search"
							class="lb-search__input"
							placeholder="Buscar en el top {users.length}…"
							aria-label="Buscar creador en la clasificación"
							bind:value={query}
						/>
						{#if searching}
							<button
								type="button"
								class="lb-search__clear"
								aria-label="Limpiar búsqueda"
								onclick={() => (query = '')}
							>
								<span class="material-icons-round" aria-hidden="true">close</span>
							</button>
						{/if}
					</div>
				{/if}

				{#if searching}
					<!-- Modo búsqueda: lista plana con puestos reales -->
					{#if matches.length === 0}
						<p class="lb-nomatch" role="status">
							Nadie llamado «{query.trim()}» en el top {users.length}.
						</p>
					{:else}
						<ol class="lb-list" aria-label="Resultados de búsqueda">
							{#each matches as user, i (user.id)}
								<li>
									<LeaderboardRow
										{user}
										rank={i + 1}
										type={boardType}
										query={query.trim()}
										isCurrentUser={currentUserData && currentUserData.id === user.id}
										delta={deltasByUser[user.id]}
									/>
								</li>
							{/each}
						</ol>
					{/if}
				{:else}
					<!-- Podio -->
					{#if top3.length > 0}
						<div class="lb-podium" role="list" aria-label="Top 3">
							{#each podiumOrder as user, i (user.id)}
								<div
									class="lb-podium__slot lb-podium__slot--{users.indexOf(user) + 1}"
									role="listitem"
								>
									<PodiumCard
										{user}
										rank={users.indexOf(user) + 1}
										type={boardType}
										delay={i * 120}
									/>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Resto de la clasificación -->
					{#if rest.length > 0}
						<ol class="lb-list" aria-label="Resto de la clasificación">
							{#each rest as user, i (user.id)}
								<li>
									<LeaderboardRow
										{user}
										rank={i + 4}
										type={boardType}
										isCurrentUser={currentUserData && currentUserData.id === user.id}
										delta={deltasByUser[user.id]}
									/>
								</li>
							{/each}
						</ol>
					{/if}

					<!-- Tu vecindario: contexto cuando estás fuera del top visible -->
					{#if showNeighbors}
						<section class="lb-neighbors" aria-label="Tu entorno en la clasificación">
							<h2 class="lb-neighbors__title">
								<span class="material-icons-round" aria-hidden="true">near_me</span>
								Tu vecindario
								<span class="lb-neighbors__hint">puesto #{currentUserRank}</span>
							</h2>
							<ol class="lb-list lb-list--neighbors">
								{#each neighbors as n (n.id)}
									<li>
										<LeaderboardRow
											user={n}
											rank={n.rank}
											type={boardType}
											isCurrentUser={currentUserData && currentUserData.id === n.id}
											delta={deltasByUser[n.id]}
										/>
									</li>
								{/each}
							</ol>
						</section>
					{/if}
				{/if}
			</div>
		{/if}
	</div>
</main>

{#if showBeacon}
	<!-- Sin transición de entrada: si el reloj de animación se congela a mitad
	     de vuelo, un transform congelado en el ancestro rompe el position: fixed
	     del dock. Aparece directo, siempre bien alineado. -->
	<CurrentUserCard
		user={currentUserData}
		rank={currentUserRank}
		type={boardType}
		delta={currentUserData ? deltasByUser[currentUserData.id] : null}
	/>
{/if}

<style>
	.lb-page {
		position: relative;
		max-width: 780px;
		margin: 0 auto;
		padding: 2rem 1rem 4rem;
		min-height: 90vh;
	}
	.lb-page.has-beacon {
		padding-bottom: 9rem;
	}
	@media (max-width: 768px) {
		.lb-page.has-beacon {
			padding-bottom: calc(9rem + 88px);
		}
	}

	/* ── Cabecera ── */
	.lb-header {
		position: relative;
		z-index: 10;
		text-align: center;
		margin-bottom: 1.6rem;
	}
	.lb-eyebrow {
		font-family: var(--font-display);
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: var(--aero-sky);
		margin: 0 0 0.45rem;
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
		max-width: 40ch;
		margin: 0.55rem auto 0;
		font-size: 0.93rem;
		color: var(--text-muted);
	}

	/* Franja de resumen */
	.lb-strip {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 1.25rem;
	}
	.strip-chip {
		display: inline-flex;
		align-items: center;
		gap: 9px;
		padding: 8px 14px;
		border-radius: var(--radius-full);
		border: 1px solid transparent;
		background:
			linear-gradient(var(--lb-card-bg), var(--lb-card-bg)) padding-box,
			linear-gradient(
					135deg,
					rgba(255, 255, 255, 0.26),
					rgba(255, 255, 255, 0.06) 50%,
					rgba(var(--accent-blue-rgb), 0.18)
				)
				border-box;
		box-shadow: var(--shadow-xs);
		backdrop-filter: var(--lb-glass-blur);
		-webkit-backdrop-filter: var(--lb-glass-blur);
		text-align: left;
	}
	.strip-icon {
		font-size: 19px;
		color: var(--aero-sky);
	}
	.strip-icon--lead {
		color: var(--lb-gold);
	}
	.strip-body {
		display: flex;
		flex-direction: column;
		line-height: 1.15;
	}
	.strip-body strong {
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 900;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
	}
	.strip-body span:last-child {
		font-size: 0.62rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.11em;
		color: var(--text-muted);
	}
	.strip-login {
		color: var(--aero-sky);
		text-decoration: none;
		font-weight: 800;
	}
	.strip-login:hover {
		text-decoration: underline;
	}

	.lb-tabs-row {
		position: relative;
		z-index: 20;
		display: flex;
		justify-content: center;
		margin-bottom: 1.75rem;
	}

	.lb-panel {
		position: relative;
		z-index: 10;
		display: grid;
		align-items: start;
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

	/* ── Búsqueda ── */
	.lb-search {
		position: relative;
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: 420px;
		margin: 0 auto 1.5rem;
		padding: 0 8px 0 14px;
		border-radius: var(--radius-full);
		border: 1px solid transparent;
		background:
			linear-gradient(var(--lb-card-bg), var(--lb-card-bg)) padding-box,
			linear-gradient(
					135deg,
					rgba(255, 255, 255, 0.28),
					rgba(255, 255, 255, 0.07) 50%,
					rgba(var(--accent-blue-rgb), 0.2)
				)
				border-box;
		box-shadow: var(--shadow-xs);
		backdrop-filter: var(--lb-glass-blur);
		-webkit-backdrop-filter: var(--lb-glass-blur);
		transition: box-shadow 0.25s ease;
	}
	.lb-search:focus-within {
		box-shadow:
			var(--shadow-sm),
			0 0 0 2px color-mix(in srgb, var(--aero-sky) 55%, transparent);
	}
	.lb-search__icon {
		font-size: 19px;
		color: var(--text-muted);
	}
	.lb-search__input {
		flex: 1;
		min-width: 0;
		height: 44px; /* escudo táctil */
		border: none;
		background: transparent;
		font-family: var(--font-sans);
		font-size: 0.92rem;
		color: var(--text-primary);
		outline: none;
	}
	.lb-search__input::placeholder {
		color: var(--text-muted);
	}
	.lb-search__input::-webkit-search-cancel-button {
		display: none; /* usamos nuestra propia ✕ */
	}
	.lb-search__clear {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: none;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--text-primary) 8%, transparent);
		color: var(--text-secondary);
		cursor: pointer;
		transition:
			background 0.2s ease,
			transform 0.2s var(--ease-spring);
	}
	.lb-search__clear:hover {
		background: color-mix(in srgb, var(--text-primary) 14%, transparent);
		transform: scale(1.08);
	}
	.lb-search__clear:focus-visible {
		outline: 2px solid var(--accent-cyan);
		outline-offset: 2px;
	}
	.lb-search__clear .material-icons-round {
		font-size: 17px;
	}

	.lb-nomatch {
		text-align: center;
		color: var(--text-muted);
		padding: 2.5rem 1rem;
	}

	/* ── Podio ── */
	.lb-podium {
		display: flex;
		justify-content: center;
		align-items: flex-end;
		gap: clamp(8px, 3vw, 30px);
		margin-top: 4.25rem;
		padding-bottom: 1rem;
		width: 100%;
		max-width: 100%;
	}
	.lb-podium__slot {
		/* Basis 0 + min-width 0: los slots reparten el ancho disponible y las
		   tarjetas se encogen con ellos. Sin desbordes en móviles. */
		flex: 1 1 0;
		min-width: 0;
		max-width: 150px;
	}
	.lb-podium__slot--1 {
		order: 2;
		max-width: 172px;
	}
	.lb-podium__slot--2 {
		order: 1;
	}
	.lb-podium__slot--3 {
		order: 3;
	}

	/* ── Lista ── */
	.lb-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 2.25rem 0 0;
		padding: 0;
	}
	.lb-list--neighbors {
		margin-top: 0.9rem;
	}

	/* ── Vecindario ── */
	.lb-neighbors {
		margin-top: 2.5rem;
		padding-top: 1.5rem;
		border-top: 1px dashed var(--glass-border, rgba(var(--accent-blue-rgb), 0.2));
	}
	.lb-neighbors__title {
		display: flex;
		align-items: center;
		gap: 7px;
		margin: 0;
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--text-primary);
	}
	.lb-neighbors__title .material-icons-round {
		font-size: 18px;
		color: var(--lb-self);
	}
	.lb-neighbors__hint {
		margin-left: auto;
		font-size: 0.68rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--text-muted);
		font-variant-numeric: tabular-nums;
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
		display: inline-block;
		margin-top: 1rem;
		padding: 10px 24px;
		border: none;
		border-radius: var(--radius-full);
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 0.85rem;
		color: #fff;
		background: linear-gradient(120deg, var(--aero-sky), var(--aero-mint));
		box-shadow: 0 4px 16px rgba(46, 180, 255, 0.4);
		cursor: pointer;
		text-decoration: none;
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
			margin-top: 5.25rem;
		}
	}

	/* ══ Adaptación al Tema Claro (Light Theme) ══ */
	:global([data-theme='light']) .strip-chip {
		background:
			linear-gradient(rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.88)) padding-box,
			linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(0, 0, 0, 0.08)) border-box;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}

	:global([data-theme='light']) .lb-search {
		background:
			linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.9)) padding-box,
			linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(0, 0, 0, 0.08)) border-box;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}

	:global([data-theme='light']) .lb-empty {
		background:
			linear-gradient(rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.92)) padding-box,
			linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(0, 0, 0, 0.08)) border-box;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
	}

	/* ══ Modos de Rendimiento ══ */
	:global([data-perf-mode='true']) .strip-chip,
	:global([data-perf-mode='true']) .lb-search,
	:global([data-perf-mode='true']) .lb-empty,
	:global([data-glass-blur='none']) .strip-chip,
	:global([data-glass-blur='none']) .lb-search,
	:global([data-glass-blur='none']) .lb-empty {
		backdrop-filter: none !important;
		-webkit-backdrop-filter: none !important;
	}

	:global([data-simplify-shadows='true']) .lb-title {
		text-shadow: none !important;
	}

	:global([data-simplify-shadows='true']) .strip-chip,
	:global([data-simplify-shadows='true']) .lb-search,
	:global([data-simplify-shadows='true']) .lb-empty {
		box-shadow: none !important;
	}
</style>
