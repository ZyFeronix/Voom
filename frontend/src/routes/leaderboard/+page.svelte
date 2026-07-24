<script>
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import AuroraPillar from '$lib/components/gamification/AuroraPillar.svelte';
	import LeaderboardTabs from '$lib/components/gamification/LeaderboardTabs.svelte';
	import PodiumCard from '$lib/components/gamification/PodiumCard.svelte';
	import LeaderboardRow from '$lib/components/gamification/LeaderboardRow.svelte';
	import CurrentUserCard from '$lib/components/gamification/CurrentUserCard.svelte';

	let type = $state('level'); // Controls the {#key} content
	let activeTab = $state('level'); // Controls the UI tabs instantly
	let users = $state([]);
	let currentUserRank = $state(null);
	let currentUserData = $state(null);
	let loading = $state(true);
	let error = $state(null);

	let isInitialLoad = $state(true);

	// Cache for instant transitions
	let cache = $state({});

	async function fetchLeaderboard(targetType) {
		if (cache[targetType]) {
			users = cache[targetType].users;
			currentUserRank = cache[targetType].currentUserRank;
			currentUserData = cache[targetType].currentUserData;
			type = targetType;
			loading = false;
			return;
		}

		// Only show full-page spinner on the very first load
		if (Object.keys(cache).length === 0) {
			loading = true;
		}

		error = null;
		try {
			const res = await fetch(`/api/gamification/leaderboard?type=${targetType}`);
			if (res.ok) {
				const data = await res.json();
				cache[targetType] = data;

				if (activeTab === targetType) {
					users = data.users || [];
					currentUserRank = data.currentUserRank;
					currentUserData = data.currentUserData;
					type = targetType; // Triggers the slide transition!
				}
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

	import { onMount } from 'svelte';
	onMount(() => {
		fetchLeaderboard(activeTab);
	});

	let top3 = $derived(users.slice(0, 3));
	let rest = $derived(users.slice(3));

	// Visual podium order: silver (2) — gold (1) — bronze (3)
	let podiumOrder = $derived([top3[1], top3[0], top3[2]].filter(Boolean));
	let getRank = (user) => users.indexOf(user) + 1;

	let showBeacon = $derived(!loading && currentUserData && currentUserRank);

	let direction = $state(1);

	function changeType(next) {
		if (activeTab === next) return;
		isInitialLoad = false;
		direction = next === 'streak' ? 1 : -1;
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
	<header class="lb-header" in:fade={{ duration: 400 }}>
		<p class="lb-eyebrow">Comunidad VSocial</p>
		<h1 class="lb-title">Salón de la Fama</h1>
		<p class="lb-subtitle">
			{activeTab === 'level'
				? 'Los creadores que más han crecido en la plataforma.'
				: 'Las rachas más constantes, día tras día.'}
		</p>
	</header>

	<!-- Tabs -->
	<div class="lb-tabs-row" in:fly={{ y: -18, duration: 400, delay: 100, easing: cubicOut }}>
		<LeaderboardTabs type={activeTab} onChange={changeType} />
	</div>

	<div id="lb-panel" role="tabpanel" aria-labelledby="lb-tab-{type}" class="lb-panel">
		{#if loading && users.length === 0}
			<div
				class="lb-loading"
				in:fade={{ duration: 250, delay: 150 }}
				out:fade={{ duration: 200 }}
				aria-live="polite"
				aria-busy="true"
			>
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
			{#key type}
				<div
					class="lb-content"
					in:fly={{
						x: isInitialLoad ? 0 : 40 * direction,
						y: isInitialLoad ? 20 : 0,
						duration: 450,
						easing: cubicOut
					}}
					out:fly={{ x: isInitialLoad ? 0 : -40 * direction, duration: 300, easing: cubicOut }}
				>
					<!-- Podium -->
					{#if top3.length > 0}
						<div class="lb-podium" role="list" aria-label="Top 3">
							{#each podiumOrder as user, idx (user.id)}
								<div
									class="lb-podium__slot lb-podium__slot--{getRank(user)}"
									role="listitem"
									in:fly={{
										y: isInitialLoad ? 60 : 0,
										duration: isInitialLoad ? 600 : 0,
										delay: isInitialLoad ? 200 + idx * 140 : 0,
										easing: cubicOut
									}}
								>
									<PodiumCard {user} rank={getRank(user)} {type} />
								</div>
							{/each}
						</div>
					{/if}

					<!-- List -->
					{#if rest.length > 0}
						<ol class="lb-list" aria-label="Resto de la clasificación">
							{#each rest as user, i (user.id)}
								<li
									in:fly={{
										y: isInitialLoad ? 18 : 0,
										duration: isInitialLoad ? 380 : 0,
										delay: isInitialLoad ? 360 + Math.min(i, 18) * 45 : 0,
										easing: cubicOut
									}}
								>
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
			{/key}
		{/if}
	</div>
</main>

{#if showBeacon}
	<div in:fly={{ y: 100, duration: 500, delay: 700, easing: cubicOut }}>
		<CurrentUserCard user={currentUserData} rank={currentUserRank} {type} />
	</div>
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
		text-shadow: 0 4px 24px rgba(27, 133, 243, 0.25);
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
	}
	.lb-panel > * {
		grid-area: 1 / 1;
	}
	.lb-content {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	/* ── Podium ── */
	.lb-podium {
		display: flex;
		justify-content: center;
		align-items: flex-end;
		gap: 12px;
		margin-top: 4.5rem;
		padding-bottom: 1rem;
	}
	.lb-podium__slot {
		flex: 0 0 auto;
	}
	.lb-podium__slot--1 {
		order: 2;
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
		border-radius: 50%;
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
					rgba(27, 133, 243, 0.2)
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

	@media (max-width: 380px) {
		.lb-podium {
			gap: 6px;
			transform: scale(0.9);
			transform-origin: bottom center;
		}
	}

	/* [VSocial: reduced-motion removido — spinner siempre a velocidad original] */
</style>
