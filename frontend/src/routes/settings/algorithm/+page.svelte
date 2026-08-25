<script>
	import { slide } from 'svelte/transition';
	import { feed as feedApi } from '$lib/api.js';
	import SettingsMessage from '$lib/components/settings/SettingsMessage.svelte';

	let { data } = $props();

	let saving = $state(false);
	let message = $state({ type: '', text: '' });

	// Algorithm weight fields — precargados desde el load del layout
	// svelte-ignore state_referenced_locally
	const s = data.settings ?? {};
	let wInterests = $state(s.w_interests ?? 50);
	let wInteractions = $state(s.w_interactions ?? 40);
	let wSocial = $state(s.w_social ?? 30);
	let wPopularity = $state(s.w_popularity ?? 20);
	let wRecency = $state(s.w_recency ?? 70);
	let wDiversity = $state(s.w_diversity ?? 15);
	let feedMode = $state(s.feed_mode ?? 'intelligent');

	// Derived: sum of algorithm weights for percentage calculations
	let totalWeight = $derived(
		Math.max(
			1,
			Number(wInterests) +
				Number(wInteractions) +
				Number(wSocial) +
				Number(wPopularity) +
				Number(wRecency) +
				Number(wDiversity)
		)
	);

	const FEED_MODES = [
		{
			id: 'retention',
			icon: 'auto_awesome',
			title: 'Descubrimiento',
			tag: 'Para Ti',
			desc: 'Contenido viral y nuevos creadores, estilo "For You". Los pesos se optimizan automáticamente.'
		},
		{
			id: 'intelligent',
			icon: 'tune',
			title: 'Feed Inteligente',
			tag: 'Personalizado',
			desc: 'Tú controlas la mezcla exacta con los seis pesos de abajo. Máximo control.'
		},
		{
			id: 'radar',
			icon: 'bolt',
			title: 'Radar en Vivo',
			tag: 'Cronológico',
			desc: 'Línea de tiempo pura: lo más reciente de quienes sigues, sin reordenar por algoritmo.'
		}
	];

	const PRESETS = [
		{
			id: 'balanced',
			icon: 'balance',
			label: 'Equilibrado',
			w: { interests: 50, interactions: 40, social: 45, popularity: 30, recency: 60, diversity: 25 }
		},
		{
			id: 'discovery',
			icon: 'explore',
			label: 'Descubrimiento',
			w: { interests: 70, interactions: 25, social: 15, popularity: 85, recency: 70, diversity: 80 }
		},
		{
			id: 'close',
			icon: 'favorite',
			label: 'Círculo cercano',
			w: { interests: 30, interactions: 80, social: 90, popularity: 15, recency: 55, diversity: 10 }
		},
		{
			id: 'fresh',
			icon: 'schedule',
			label: 'Recientes',
			w: {
				interests: 25,
				interactions: 30,
				social: 40,
				popularity: 20,
				recency: 100,
				diversity: 20
			}
		},
		{
			id: 'viral',
			icon: 'trending_up',
			label: 'Solo virales',
			w: {
				interests: 35,
				interactions: 15,
				social: 10,
				popularity: 100,
				recency: 50,
				diversity: 40
			}
		}
	];

	const DEFAULT_WEIGHTS = {
		interests: 50,
		interactions: 40,
		social: 30,
		popularity: 20,
		recency: 70,
		diversity: 15
	};

	function selectMode(id) {
		feedMode = id;
	}

	function applyPreset(preset) {
		feedMode = 'intelligent';
		wInterests = preset.w.interests;
		wInteractions = preset.w.interactions;
		wSocial = preset.w.social;
		wPopularity = preset.w.popularity;
		wRecency = preset.w.recency;
		wDiversity = preset.w.diversity;
	}

	function resetWeights() {
		wInterests = DEFAULT_WEIGHTS.interests;
		wInteractions = DEFAULT_WEIGHTS.interactions;
		wSocial = DEFAULT_WEIGHTS.social;
		wPopularity = DEFAULT_WEIGHTS.popularity;
		wRecency = DEFAULT_WEIGHTS.recency;
		wDiversity = DEFAULT_WEIGHTS.diversity;
	}

	let activePreset = $derived(
		PRESETS.find(
			(p) =>
				Number(wInterests) === p.w.interests &&
				Number(wInteractions) === p.w.interactions &&
				Number(wSocial) === p.w.social &&
				Number(wPopularity) === p.w.popularity &&
				Number(wRecency) === p.w.recency &&
				Number(wDiversity) === p.w.diversity
		)?.id || null
	);

	const WEIGHT_LABELS = {
		interests: 'tus intereses temáticos',
		interactions: 'creadores con los que interactúas',
		social: 'personas que sigues',
		popularity: 'publicaciones populares',
		recency: 'lo más reciente',
		diversity: 'variedad de creadores'
	};
	let feedSummary = $derived.by(() => {
		if (feedMode === 'radar')
			return 'Verás las publicaciones más recientes de quienes sigues, en orden cronológico estricto.';
		if (feedMode === 'retention')
			return 'El sistema elige por ti: contenido viral, fresco y variado para descubrir gente nueva.';
		const ranked = [
			{ k: 'interests', v: Number(wInterests) },
			{ k: 'interactions', v: Number(wInteractions) },
			{ k: 'social', v: Number(wSocial) },
			{ k: 'popularity', v: Number(wPopularity) },
			{ k: 'recency', v: Number(wRecency) },
			{ k: 'diversity', v: Number(wDiversity) }
		].sort((a, b) => b.v - a.v);
		return `Tu feed prioriza sobre todo ${WEIGHT_LABELS[ranked[0].k]} y ${WEIGHT_LABELS[ranked[1].k]}.`;
	});

	async function saveAlgorithmSettings(e) {
		e.preventDefault();
		if (saving) return;
		saving = true;
		message = { type: '', text: '' };

		try {
			const payload = {
				w_interests: Number(wInterests),
				w_interactions: Number(wInteractions),
				w_social: Number(wSocial),
				w_popularity: Number(wPopularity),
				w_recency: Number(wRecency),
				w_diversity: Number(wDiversity),
				feed_mode: feedMode
			};
			await feedApi.preferences.update(payload);
			message = { type: 'success', text: '¡Preferencias del algoritmo guardadas con éxito!' };
		} catch (err) {
			message = {
				type: 'error',
				text: err?.message ?? 'Error al guardar las preferencias del feed.'
			};
		} finally {
			saving = false;
		}
	}

	const CHART_BARS = [
		{
			key: 'interests',
			label: 'Intereses',
			color: 'linear-gradient(to top, var(--aero-sky), var(--aero-blue))'
		},
		{
			key: 'interactions',
			label: 'Interacciones',
			color: 'linear-gradient(to top, #a855f7, #d946ef)'
		},
		{
			key: 'social',
			label: 'Social',
			color: 'linear-gradient(to top, var(--aero-coral), var(--aero-rose))'
		},
		{ key: 'popularity', label: 'Popularidad', color: 'linear-gradient(to top, #ef4444, #f97316)' },
		{
			key: 'recency',
			label: 'Recencia',
			color: 'linear-gradient(to top, var(--aero-mint), #059669)'
		},
		{
			key: 'diversity',
			label: 'Diversidad',
			color: 'linear-gradient(to top, #fcd34d, var(--aero-amber))'
		}
	];
	let weightValues = $derived({
		interests: wInterests,
		interactions: wInteractions,
		social: wSocial,
		popularity: wPopularity,
		recency: wRecency,
		diversity: wDiversity
	});
</script>

<svelte:head>
	<title>Feed y Algoritmo — VSocial</title>
</svelte:head>

<div class="glass-card panel-card" class:is-saving={saving}>
	<SettingsMessage {message} />

	<div class="section-content">
		<div>
			<h3 class="section-title">Feed & Algoritmo</h3>
			<p class="section-subtitle">
				Controla exactamente cómo se prioriza el contenido en tu página de inicio.
			</p>
		</div>

		<!-- Mode selector cards -->
		<div class="mode-cards">
			{#each FEED_MODES as m (m.id)}
				<button
					type="button"
					class="mode-card"
					class:active={feedMode === m.id}
					onclick={() => selectMode(m.id)}
				>
					<div class="mode-card-head">
						<span class="material-icons-round mode-card-icon">{m.icon}</span>
						<span class="mode-card-tag">{m.tag}</span>
					</div>
					<span class="mode-card-title">{m.title}</span>
					<span class="mode-card-desc">{m.desc}</span>
				</button>
			{/each}
		</div>

		<!-- Live summary -->
		<div class="feed-summary">
			<span class="material-icons-round">insights</span>
			<span>{feedSummary}</span>
		</div>

		<form onsubmit={saveAlgorithmSettings} class="form-container">
			<!-- Presets (only relevant in intelligent mode) -->
			{#if feedMode === 'intelligent'}
				<div class="presets-block" transition:slide={{ duration: 250 }}>
					<div class="presets-head">
						<span class="form-label" style="margin: 0;">Perfiles rápidos</span>
						<button type="button" class="reset-btn" onclick={resetWeights}>
							<span class="material-icons-round">restart_alt</span> Restablecer
						</button>
					</div>
					<div class="presets-row">
						{#each PRESETS as p (p.id)}
							<button
								type="button"
								class="preset-chip"
								class:active={activePreset === p.id}
								onclick={() => applyPreset(p)}
							>
								<span class="material-icons-round">{p.icon}</span>
								<span>{p.label}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Bar Chart weight distribution -->
			<div class="chart-container" class:dimmed={feedMode !== 'intelligent'}>
				<h4 class="chart-title">Distribución de Pesos</h4>
				<div class="chart-bars">
					{#each CHART_BARS as bar (bar.key)}
						{@const pct = (weightValues[bar.key] / totalWeight) * 100}
						<div class="bar-col">
							<span class="bar-pct-text">{pct.toFixed(0)}%</span>
							<div class="bar-fill" style="height: {pct}%; background: {bar.color};"></div>
						</div>
					{/each}
				</div>
				<div class="chart-labels-row">
					<span>Intereses</span>
					<span>Interac.</span>
					<span>Social</span>
					<span>Popular</span>
					<span>Recencia</span>
					<span>Diversidad</span>
				</div>
			</div>

			<!-- Sliders grid -->
			<div
				class="sliders-grid"
				style={feedMode !== 'intelligent' ? 'opacity: 0.5; pointer-events: none;' : ''}
			>
				<div class="slider-group">
					<div class="slider-header">
						<span>Intereses Temáticos</span>
						<span class="slider-value-text">{wInterests}</span>
					</div>
					<p class="slider-desc">Prioriza contenido con hashtags que sueles disfrutar.</p>
					<input type="range" min="0" max="100" bind:value={wInterests} class="aero-range" />
				</div>

				<div class="slider-group">
					<div class="slider-header">
						<span>Interacciones Previas</span>
						<span class="slider-value-text">{wInteractions}</span>
					</div>
					<p class="slider-desc">Publicaciones de creadores con los que sueles reaccionar.</p>
					<input type="range" min="0" max="100" bind:value={wInteractions} class="aero-range" />
				</div>

				<div class="slider-group">
					<div class="slider-header">
						<span>Círculo Social</span>
						<span class="slider-value-text">{wSocial}</span>
					</div>
					<p class="slider-desc">Prioriza publicaciones de personas que sigues directamente.</p>
					<input type="range" min="0" max="100" bind:value={wSocial} class="aero-range" />
				</div>

				<div class="slider-group">
					<div class="slider-header">
						<span>Popularidad del Post</span>
						<span class="slider-value-text">{wPopularity}</span>
					</div>
					<p class="slider-desc">Favorece publicaciones virales con mucha actividad en la red.</p>
					<input type="range" min="0" max="100" bind:value={wPopularity} class="aero-range" />
				</div>

				<div class="slider-group">
					<div class="slider-header">
						<span>Recencia / Tiempo</span>
						<span class="slider-value-text">{wRecency}</span>
					</div>
					<p class="slider-desc">Favorece publicaciones de las últimas horas.</p>
					<input type="range" min="0" max="100" bind:value={wRecency} class="aero-range" />
				</div>

				<div class="slider-group">
					<div class="slider-header">
						<span>Diversidad de Creadores</span>
						<span class="slider-value-text">{wDiversity}</span>
					</div>
					<p class="slider-desc">
						Evita mostrar demasiadas publicaciones seguidas del mismo usuario.
					</p>
					<input type="range" min="0" max="100" bind:value={wDiversity} class="aero-range" />
				</div>
			</div>

			<div class="algo-footer">
				<p class="algo-hint">
					<span class="material-icons-round">lightbulb</span>
					{#if feedMode === 'intelligent'}
						Ajusta los pesos o elige un perfil rápido, luego guarda.
					{:else}
						Los pesos manuales solo aplican en el modo <strong>Feed Inteligente</strong>.
					{/if}
				</p>
				<button type="submit" class="btn-aero-primary" style="padding: 10px 24px;">
					<span class="btn-spinner" class:show={saving}>
						<span class="loading loading-spinner loading-xs"></span>
					</span>
					<span>Guardar Preferencias</span>
				</button>
			</div>
		</form>
	</div>
</div>
