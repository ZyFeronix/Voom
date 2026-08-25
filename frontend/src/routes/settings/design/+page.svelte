<script>
	import { fade, slide } from 'svelte/transition';
	import { beforeNavigate, goto } from '$app/navigation';
	import { users as usersApi, media as mediaApi } from '$lib/api.js';
	import { uiStore } from '$lib/stores/ui.svelte.js';
	import {
		DESIGN_LIMITS,
		DEFAULT_PRIMARY_COLOR,
		ALLOWED_BLOCK_TYPES
	} from '$lib/design/sanitize.js';
	import ProfileThemeShell from '$lib/components/profile/ProfileThemeShell.svelte';
	import ProfileHeaderCard from '$lib/components/profile/ProfileHeaderCard.svelte';
	import ProfileBlocks from '$lib/components/profile/ProfileBlocks.svelte';
	import FancySlider from '$lib/components/ui/FancySlider.svelte';

	/* ══════════════════════════ Constantes ══════════════════════════ */

	const PRESETS = [
		{
			id: 'ocean',
			name: 'Océano',
			icon: 'water_drop',
			primary_color: '#1b85f3',
			bg_color: '',
			bg_image_url: '',
			glass_blur: 15,
			glass_opacity: 0.8
		},
		{
			id: 'sunset',
			name: 'Atardecer',
			icon: 'wb_twilight',
			primary_color: '#f3684b',
			bg_color: '#241019',
			bg_image_url: '',
			glass_blur: 18,
			glass_opacity: 0.7
		},
		{
			id: 'neon',
			name: 'Neón',
			icon: 'bolt',
			primary_color: '#b026ff',
			bg_color: '#0a0614',
			bg_image_url: '',
			glass_blur: 24,
			glass_opacity: 0.6
		},
		{
			id: 'forest',
			name: 'Bosque',
			icon: 'forest',
			primary_color: '#22c55e',
			bg_color: '#0c1712',
			bg_image_url: '',
			glass_blur: 16,
			glass_opacity: 0.75
		},
		{
			id: 'aurora',
			name: 'Aurora',
			icon: 'blur_on',
			primary_color: '#00d4aa',
			bg_color: '#071a18',
			bg_image_url: '',
			glass_blur: 20,
			glass_opacity: 0.65
		},
		{
			id: 'mono',
			name: 'Mono',
			icon: 'contrast',
			primary_color: '#334155',
			bg_color: '',
			bg_image_url: '',
			glass_blur: 10,
			glass_opacity: 0.9
		}
	];

	const COLOR_SWATCHES = [
		'#1b85f3',
		'#00d4aa',
		'#22c55e',
		'#f3684b',
		'#e84a72',
		'#b026ff',
		'#f5b40a',
		'#334155'
	];

	/** Hex válido o cadena vacía (= heredar del tema). */
	const HEX_FIELD_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$|^$/i;

	const BLOCK_CATALOG = [
		{ type: 'bio', label: 'Bloque de texto', icon: 'notes', dynamic: true },
		{ type: 'links', label: 'Lista de enlaces', icon: 'link', dynamic: true },
		{ type: 'feed', label: 'Últimas publicaciones', icon: 'dynamic_feed', dynamic: false },
		{ type: 'photos', label: 'Galería de fotos', icon: 'collections', dynamic: false }
	];

	function makeBlock(type, suffix = '') {
		switch (type) {
			case 'bio':
				return { id: `bio-${suffix}${Date.now().toString(36)}`, type, enabled: true, content: '' };
			case 'links':
				return { id: `links-${suffix}${Date.now().toString(36)}`, type, enabled: true, links: [] };
			default:
				return { id: `${type}-${suffix}${Date.now().toString(36)}`, type, enabled: true };
		}
	}

	function defaultLayout() {
		return [
			makeBlock('bio'),
			makeBlock('links'),
			makeBlock('feed'),
			Object.assign(makeBlock('photos'), { enabled: false })
		];
	}

	/**
	 * Normaliza el layout guardado PRESERVANDO el orden original del array
	 * (incluye el tipo legacy "text" → "bio"). Los singletons (feed/photos)
	 * se deduplican conservando la PRIMERA aparición, in situ.
	 */
	function normalizeLoadedBlocks(raw) {
		let arr = raw;
		if (typeof raw === 'string') {
			try {
				arr = JSON.parse(raw);
			} catch {
				return defaultLayout();
			}
		}
		if (!Array.isArray(arr)) return defaultLayout();

		const seenIds = new Set();
		const seenSingletons = new Set();
		const out = [];

		for (const entry of arr) {
			if (!entry || typeof entry !== 'object') continue;
			const type = entry.type === 'text' ? 'bio' : String(entry.type ?? '').toLowerCase();
			if (!ALLOWED_BLOCK_TYPES.includes(type)) continue;

			const isDynamic = BLOCK_CATALOG.find((c) => c.type === type)?.dynamic !== false;
			if (!isDynamic) {
				if (seenSingletons.has(type)) continue;
				seenSingletons.add(type);
			}

			let id = typeof entry.id === 'string' && entry.id ? entry.id : `${type}-${out.length}`;
			while (seenIds.has(id)) id = `${id}-x`;
			seenIds.add(id);

			const block = { id, type, enabled: entry.enabled !== false };
			if (type === 'bio') block.content = String(entry.content ?? '');
			if (type === 'links')
				block.links = Array.isArray(entry.links)
					? entry.links
							.filter((l) => l && typeof l === 'object')
							.map((l) => ({ title: String(l.title ?? ''), url: String(l.url ?? '') }))
					: [];
			out.push(block);
		}

		return out.length ? out : defaultLayout();
	}

	/* ══════════════════════════ Estado ══════════════════════════ */

	let loading = $state(true);
	let saving = $state(false);
	let justSaved = $state(false);
	let feedback = $state(null); // { kind: 'ok'|'error'|'warn', lines: [] }

	let activeTab = $state('style'); // 'style' | 'blocks'
	let panelOpen = $state(typeof window !== 'undefined' ? window.innerWidth > 900 : true);
	let showCssModal = $state(false);
	let previewMobile = $state(false);

	let me = $state(null);

	let design = $state({
		primaryColor: DEFAULT_PRIMARY_COLOR,
		bgColor: '',
		bgImageUrl: '',
		glassBlur: 15,
		glassOpacity: 0.8,
		fontFamily: '',
		customFontUrl: '',
		customCss: '',
		blocks: []
	});

	let snapshotJson = $state('');

	function serializeCurrent() {
		return JSON.stringify([
			design.primaryColor,
			design.bgColor,
			design.bgImageUrl,
			design.glassBlur,
			design.glassOpacity,
			design.fontFamily,
			design.customFontUrl,
			design.customCss,
			design.blocks.map((b) =>
				b.type === 'bio'
					? { i: b.id, t: b.type, e: b.enabled, c: b.content }
					: b.type === 'links'
						? { i: b.id, t: b.type, e: b.enabled, l: b.links.map((x) => [x.title, x.url]) }
						: { i: b.id, t: b.type, e: b.enabled }
			)
		]);
	}

	let isDirty = $derived(snapshotJson !== '' && serializeCurrent() !== snapshotJson);

	/* ── Carga inicial ── */

	function applyServerCustomization(c) {
		design.primaryColor = c.primary_color || DEFAULT_PRIMARY_COLOR;
		design.bgColor = c.bg_color || '';
		design.bgImageUrl = c.bg_image_url || '';
		design.glassBlur = Number.isFinite(Number(c.glass_blur)) ? Number(c.glass_blur) : 15;
		design.glassOpacity = Number.isFinite(Number(c.glass_opacity))
			? Math.min(1, Math.max(0.2, Number(c.glass_opacity)))
			: 0.8;
		design.fontFamily = c.font_family || '';
		design.customFontUrl = c.custom_font_url || '';
		design.customCss = typeof c.custom_css === 'string' ? c.custom_css : '';
		design.blocks = normalizeLoadedBlocks(c.blocks_layout);
		snapshotJson = serializeCurrent();
	}

	async function loadDesign() {
		try {
			const res = await usersApi.me();
			me = res?.user ?? null;
			if (res?.user?.customization) applyServerCustomization(res.user.customization);
			else {
				design.blocks = defaultLayout();
				snapshotJson = serializeCurrent();
			}
		} catch (err) {
			feedback = { kind: 'error', lines: [err?.message || 'No se pudo cargar tu diseño.'] };
			design.blocks = defaultLayout();
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void loadDesign();
	});

	/* ── Guardado / reset ── */

	async function saveDesign() {
		if (saving) return;
		saving = true;
		feedback = null;
		try {
			const res = await usersApi.updateCustomization({
				primary_color: design.primaryColor,
				bg_color: design.bgColor,
				bg_image_url: design.bgImageUrl,
				glass_blur: design.glassBlur,
				glass_opacity: design.glassOpacity,
				font_family: design.fontFamily,
				custom_font_url: design.customFontUrl,
				custom_css: design.customCss,
				blocks_layout: design.blocks
			});
			if (res?.customization) applyServerCustomization(res.customization);
			else snapshotJson = serializeCurrent();
			const warnLines = Array.isArray(res?.warnings) ? res.warnings : [];
			feedback = warnLines.length
				? { kind: 'warn', lines: ['Diseño guardado con avisos:', ...warnLines] }
				: { kind: 'ok', lines: ['¡Diseño guardado! Tu perfil ya luce el nuevo estilo.'] };
			if (!warnLines.length) {
				justSaved = true;
				setTimeout(() => (justSaved = false), 1800);
			}
			setTimeout(() => {
				if (feedback?.kind === 'ok') feedback = null;
			}, 3500);
		} catch (err) {
			feedback = { kind: 'error', lines: [err?.message || 'Error al guardar el diseño.'] };
		} finally {
			saving = false;
		}
	}

	async function resetDesign() {
		if (!isDirty) return;
		const ok = await uiStore.requestConfirm({
			title: 'Descartar cambios',
			message: '¿Volver al diseño guardado? Se perderán las modificaciones sin guardar.',
			danger: true,
			confirmText: 'Descartar'
		});
		if (!ok) return;
		if (me?.customization) applyServerCustomization(me.customization);
		else {
			design.blocks = defaultLayout();
			snapshotJson = serializeCurrent();
		}
		feedback = { kind: 'ok', lines: ['Cambios descartados.'] };
		setTimeout(() => {
			if (feedback?.lines?.[0] === 'Cambios descartados.') feedback = null;
		}, 2000);
	}

	/*
	 * Guard de navegación con flag de escape anti-bucle: cancel() es síncrono
	 * ANTES de cualquier await (contrato SvelteKit); el modal resuelve async y,
	 * si confirma, bypassGuard deja pasar el goto() definitivo. El componente
	 * se desmonta al navegar → no hace falta resetear el flag.
	 */
	let bypassGuard = false;

	beforeNavigate(async ({ cancel, to }) => {
		if (bypassGuard || !isDirty || !to) return;

		cancel(); // 1. Cancela la navegación síncronamente

		const confirmed = await uiStore.requestConfirm({
			title: 'Cambios sin guardar',
			message: '¿Seguro que quieres salir? Se perderán las modificaciones en el diseño.',
			danger: true,
			confirmText: 'Salir sin guardar'
		});

		if (confirmed) {
			bypassGuard = true; // 2. Desactiva el guard para el salto definitivo
			goto(to.url);
		}
	});

	$effect(() => {
		const handler = (e) => {
			if (!isDirty) return;
			e.preventDefault();
			e.returnValue = '';
		};
		window.addEventListener('beforeunload', handler);
		return () => window.removeEventListener('beforeunload', handler);
	});

	/* ── Preview ── */

	let previewCustomization = $derived({
		primary_color: design.primaryColor,
		bg_color: design.bgColor,
		bg_image_url: design.bgImageUrl,
		glass_blur: design.glassBlur,
		glass_opacity: design.glassOpacity,
		font_family: design.fontFamily,
		custom_font_url: design.customFontUrl,
		custom_css: design.customCss,
		blocks_layout: JSON.stringify(design.blocks)
	});

	/* ── Presets ── */

	async function applyPreset(preset) {
		if (isDirty) {
			const ok = await uiStore.requestConfirm({
				title: 'Aplicar preset',
				message: 'El preset reemplazará color, fondo y cristal actuales (sin guardar). ¿Continuar?',
				confirmText: 'Aplicar'
			});
			if (!ok) return;
		}
		design.primaryColor = preset.primary_color;
		design.bgColor = preset.bg_color;
		design.bgImageUrl = preset.bg_image_url;
		design.glassBlur = preset.glass_blur;
		design.glassOpacity = preset.glass_opacity;
	}

	/* ── Subidas ── */

	async function uploadAsset(file, context) {
		const fd = new FormData();
		fd.append('file', file);
		fd.append('context', context);
		const res = await mediaApi.upload(fd);
		if (!res?.success) throw new Error(res?.error || 'No se pudo subir el archivo.');
		return res.url;
	}

	async function handleFontUpload(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		e.target.value = '';
		feedback = null;
		try {
			design.customFontUrl = await uploadAsset(file, 'font');
			if (!design.fontFamily)
				design.fontFamily =
					file.name
						.split('.')[0]
						.replace(/[^a-zA-Z0-9 _-]/g, '')
						.slice(0, DESIGN_LIMITS.FONT_FAMILY_MAX) || 'MiFuente';
			feedback = { kind: 'ok', lines: ['Fuente subida. Escribe su nombre si quieres ajustarlo.'] };
			setTimeout(() => {
				if (feedback?.kind === 'ok') feedback = null;
			}, 2500);
		} catch (err) {
			feedback = { kind: 'error', lines: [err?.message || 'Error al subir la fuente.'] };
		}
	}

	async function handleBgUpload(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		e.target.value = '';
		feedback = null;
		try {
			design.bgImageUrl = await uploadAsset(file, 'post');
		} catch (err) {
			feedback = { kind: 'error', lines: [err?.message || 'Error al subir la imagen.'] };
		}
	}

	/* ── Bloques: orden con Pointer Events (ratón + táctil) ── */

	let blocksListEl = $state(null);
	let dragIndex = $state(-1);
	let overIndex = $state(-1);

	function dragStart(i, e) {
		dragIndex = i;
		overIndex = i;
		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {}
	}

	function dragMove(e) {
		if (dragIndex < 0 || !blocksListEl) return;
		const target = document.elementFromPoint(e.clientX, e.clientY);
		const row = target?.closest?.('[data-block-row]');
		overIndex = row ? Number(row.getAttribute('data-block-row')) : overIndex;
	}

	function dragEnd() {
		if (dragIndex >= 0 && overIndex >= 0 && overIndex !== dragIndex)
			moveBlock(dragIndex, overIndex);
		dragIndex = -1;
		overIndex = -1;
	}

	function moveBlock(from, to) {
		const arr = [...design.blocks];
		if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return;
		const [item] = arr.splice(from, 1);
		arr.splice(to, 0, item);
		design.blocks = arr;
	}

	function toggleBlock(index) {
		const block = design.blocks[index];
		if (!block) return;
		block.enabled = !block.enabled;
	}

	function removeBlock(index) {
		design.blocks = design.blocks.filter((_, i) => i !== index);
	}

	function countBlocksOfType(type) {
		return design.blocks.filter((b) => b.type === type).length;
	}

	function addBlock(type) {
		if (design.blocks.length >= DESIGN_LIMITS.BLOCKS_MAX) {
			feedback = { kind: 'error', lines: [`Máximo ${DESIGN_LIMITS.BLOCKS_MAX} bloques.`] };
			return;
		}
		design.blocks = [...design.blocks, makeBlock(type)];
		activeTab = 'blocks';
	}

	function addLink(block) {
		if ((block.links?.length ?? 0) >= DESIGN_LIMITS.LINKS_PER_BLOCK_MAX) return;
		block.links = [...(block.links ?? []), { title: '', url: 'https://' }];
	}

	function removeLink(block, linkIndex) {
		block.links = block.links.filter((_, i) => i !== linkIndex);
	}

	let cssCharCount = $derived((design.customCss || '').length);
	let cssTooLong = $derived(cssCharCount > DESIGN_LIMITS.CUSTOM_CSS_MAX);

	/* ── Validación inline (paridad con lo que el servidor aceptará) ── */

	let primaryColorInvalid = $derived(!HEX_FIELD_RE.test(design.primaryColor.trim()));
	let bgColorInvalid = $derived(!HEX_FIELD_RE.test(design.bgColor.trim()));
	let bgUrlInvalid = $derived(
		design.bgImageUrl.trim() !== '' && !design.bgImageUrl.trim().startsWith('/uploads/')
	);
	let saveBlocked = $derived(primaryColorInvalid || bgColorInvalid || bgUrlInvalid || cssTooLong);

	function commitHex(field, previous) {
		const value = design[field].trim();
		if (!HEX_FIELD_RE.test(value)) design[field] = previous;
	}

	/** Restaura TODO el diseño a los valores de fábrica (requiere guardar). */
	async function factoryReset() {
		const ok = await uiStore.requestConfirm({
			title: 'Restaurar diseño por defecto',
			message:
				'Se limpiarán color, fondo, cristal, fuente, CSS y bloques. Deberás guardar para aplicarlo.',
			danger: true,
			confirmText: 'Restaurar'
		});
		if (!ok) return;
		design.primaryColor = DEFAULT_PRIMARY_COLOR;
		design.bgColor = '';
		design.bgImageUrl = '';
		design.glassBlur = 15;
		design.glassOpacity = 0.8;
		design.fontFamily = '';
		design.customFontUrl = '';
		design.customCss = '';
		design.blocks = defaultLayout();
		feedback = {
			kind: 'ok',
			lines: ['Diseño restaurado a valores por defecto. Pulsa Guardar para aplicarlo.']
		};
	}

	/* ── Sync panel ↔ canvas: resalta en el preview el bloque bajo el cursor ── */

	let highlightedBlockId = $state(null);
	let previewCanvasEl = $state(null);
	let previewScrollEl = $state(null);
	let syncTimer = null;

	function focusBlock(id) {
		highlightedBlockId = id;
		// Intención de hover: 140ms de gracia evita disparos fantasma cuando el
		// cursor está quieto y el listado aparece debajo de él al abrir el tab.
		clearTimeout(syncTimer);
		syncTimer = setTimeout(() => {
			const node = previewCanvasEl?.querySelector(`[data-block-id="${CSS.escape(id)}"]`);
			const scroller = previewScrollEl;
			if (!node || !scroller) return;
			/* Scroll MANUAL acotado al scroller del preview: scrollIntoView()
			   burbujearía hasta el documento y lanzaría la página entera. */
			const sRect = scroller.getBoundingClientRect();
			const nRect = node.getBoundingClientRect();
			if (nRect.top >= sRect.top && nRect.bottom <= sRect.bottom) return; // ya visible
			const delta = nRect.top + nRect.height / 2 - (sRect.top + sRect.height / 2);
			scroller.scrollTo({ top: scroller.scrollTop + delta, behavior: 'smooth' });
		}, 140);
	}

	function blurBlock() {
		clearTimeout(syncTimer);
		highlightedBlockId = null;
	}

	// Al salir del tab Bloques, ningún bloque queda resaltado en el lienzo.
	$effect(() => {
		if (activeTab !== 'blocks') blurBlock();
	});
</script>

<svelte:head>
	<title>Editor de Diseño — VSocial</title>
</svelte:head>

<div class="designer-canvas">
	<!-- ══════════ Chrome unificado: back · título · dispositivo · dirty · guardar ══════════ -->
	<header class="editor-chrome glass-panel">
		<div class="chrome-left">
			<a href="/settings" class="btn-icon" title="Volver a Ajustes" aria-label="Volver a Ajustes">
				<span class="material-icons-round">arrow_back</span>
			</a>
			<a
				href={me?.username ? `/u/${me.username}` : '#'}
				class="btn-icon"
				target="_blank"
				rel="noopener noreferrer"
				title="Ver perfil público"
			>
				<span class="material-icons-round">visibility</span>
			</a>
			<div class="chrome-title">
				<h1>Editor de Diseño</h1>
				{#if me?.username}<span>@{me.username}</span>{/if}
			</div>
		</div>

		<div class="chrome-actions">
			{#if isDirty}
				<span class="dirty-chip" transition:fade>
					<span class="dirty-dot"></span>
					Sin guardar
				</span>
			{/if}
			<div class="device-toggle" role="group" aria-label="Vista previa del dispositivo">
				<button
					type="button"
					class:active={!previewMobile}
					onclick={() => (previewMobile = false)}
					title="Vista escritorio"
					aria-label="Vista escritorio"
				>
					<span class="material-icons-round">desktop_windows</span>
				</button>
				<button
					type="button"
					class:active={previewMobile}
					onclick={() => (previewMobile = true)}
					title="Vista móvil"
					aria-label="Vista móvil"
				>
					<span class="material-icons-round">smartphone</span>
				</button>
			</div>
			<button
				type="button"
				class="btn-save chrome-save"
				class:is-success={justSaved}
				onclick={saveDesign}
				disabled={saving || !isDirty || loading || saveBlocked}
				title={saveBlocked ? 'Corrige los errores marcados en el panel antes de guardar' : ''}
			>
				{#if saving}
					<span class="loading loading-spinner loading-sm"></span>
					Guardando…
				{:else if justSaved}
					<span class="material-icons-round">check_circle</span>
					Guardado
				{:else if saveBlocked && isDirty}
					Revisa los errores
				{:else if isDirty}
					Guardar diseño
				{:else}
					Todo guardado
				{/if}
			</button>
		</div>
	</header>

	<!-- ══════════ Cuerpo: lienzo + panel ══════════ -->
	<div class="editor-body">
		<main class="preview-area">
			<div class="preview-scroll" bind:this={previewScrollEl}>
				<div class="preview-viewport" class:is-mobile={previewMobile}>
					{#if previewMobile}
						<div class="mobile-speaker-bar" aria-hidden="true"></div>
					{/if}
					{#if loading}
						<div class="preview-loading">
							<span class="loading loading-spinner text-primary"></span>
							<span>Cargando tu diseño…</span>
						</div>
					{:else}
						<ProfileThemeShell customization={previewCustomization} variant="preview">
							<div class="preview-profile-container" bind:this={previewCanvasEl}>
								<!-- Cabecera REAL del perfil: mismo componente que /u/[username] -->
								<ProfileHeaderCard
									user={me}
									postsCount={me?.post_count || 0}
									followersCount={me?.follower_count || 0}
									isOwnProfile={true}
									interactive={false}
								/>

								<!-- Bloques REALES: mismos componentes que renderiza /u/[username] -->
								<ProfileBlocks
									username={me?.username ?? ''}
									blocks={design.blocks}
									highlightId={highlightedBlockId}
								/>
							</div>
						</ProfileThemeShell>
					{/if}
				</div>
			</div>
		</main>

		<!-- ══════════ Panel de propiedades ══════════ -->
		{#if panelOpen}
			<aside class="props-panel" transition:slide={{ axis: 'x', duration: 250 }}>
				<nav class="panel-tabs" aria-label="Secciones del editor">
					<button
						aria-current={activeTab === 'style' ? 'true' : undefined}
						class:active={activeTab === 'style'}
						onclick={() => (activeTab = 'style')}
					>
						Estética
					</button>
					<button
						aria-current={activeTab === 'blocks' ? 'true' : undefined}
						class:active={activeTab === 'blocks'}
						onclick={() => (activeTab = 'blocks')}
					>
						Bloques
						{#if isDirty}<span class="tab-dirty-dot"></span>{/if}
					</button>
					<button
						type="button"
						class="panel-close-btn"
						onclick={() => (panelOpen = false)}
						title="Minimizar panel"
						aria-label="Minimizar panel"
					>
						<span class="material-icons-round">chevron_right</span>
					</button>
				</nav>

				<div class="panel-content">
					{#if isDirty && !saveBlocked}
						<div class="discard-row">
							<span class="material-icons-round" aria-hidden="true">edit_note</span>
							<span>Hay cambios sin guardar</span>
							<button type="button" class="discard-link" onclick={resetDesign} disabled={saving}>
								Descartar
							</button>
						</div>
					{/if}
					{#if feedback}
						<div class="feedback {feedback.kind}" role="status" transition:fade={{ duration: 150 }}>
							{#each feedback.lines as line, i (i)}
								<p>{line}</p>
							{/each}
						</div>
					{/if}

					{#if activeTab === 'style'}
						<section class="props-section">
							<h3 class="props-title"><span class="sec-num">01</span> Presets rápidos</h3>
							<div class="presets-grid">
								{#each PRESETS as preset (preset.id)}
									<button
										class="preset-card"
										class:active-preset={design.primaryColor.toLowerCase() ===
											preset.primary_color.toLowerCase() && design.glassBlur === preset.glass_blur}
										onclick={() => applyPreset(preset)}
									>
										<span
											class="preset-swatch"
											style="background: linear-gradient(135deg, {preset.primary_color}, {preset.bg_color
												? preset.bg_color
												: `color-mix(in srgb, ${preset.primary_color} 30%, transparent)`});"
										></span>
										<span class="preset-name">{preset.name}</span>
										<span class="material-icons-round" aria-hidden="true">{preset.icon}</span>
									</button>
								{/each}
							</div>
						</section>

						<section class="props-section">
							<h3 class="props-title"><span class="sec-num">02</span> Colores</h3>
							<div class="prop-col">
								<label class="prop-row" for="primary-color">
									<span>Color primario</span>
									<span class="prop-value" class:invalid={primaryColorInvalid}
										>{design.primaryColor || '—'}</span
									>
								</label>
								<div class="hex-field">
									<label class="hex-chip-wrap" title="Elegir con la paleta de colores">
										<input
											type="color"
											class="native-color-picker"
											value={HEX_FIELD_RE.test(design.primaryColor.trim()) &&
											design.primaryColor.trim().length === 7
												? design.primaryColor.trim()
												: DEFAULT_PRIMARY_COLOR}
											oninput={(e) => (design.primaryColor = e.target.value)}
										/>
										<span
											class="hex-chip"
											class:invalid={primaryColorInvalid}
											style="background: {HEX_FIELD_RE.test(design.primaryColor.trim()) &&
											design.primaryColor.trim()
												? design.primaryColor.trim()
												: 'transparent'};"
											aria-hidden="true"
										></span>
									</label>
									<input
										id="primary-color"
										name="primary-color"
										type="text"
										class="hex-input"
										class:invalid={primaryColorInvalid}
										placeholder="#1b85f3"
										bind:value={design.primaryColor}
										maxlength="7"
										spellcheck="false"
										onblur={() => commitHex('primaryColor', DEFAULT_PRIMARY_COLOR)}
									/>
								</div>
								{#if primaryColorInvalid}
									<p class="field-error">Formato hex inválido. Ejemplos: #1b85f3, #f3c.</p>
								{/if}
								<div class="swatches" role="group" aria-label="Colores sugeridos">
									{#each COLOR_SWATCHES as color (color)}
										<button
											class="swatch"
											class:selected={design.primaryColor === color}
											style="background: {color};"
											onclick={() => (design.primaryColor = color)}
											title={color}
											aria-label="Usar color {color}"
										></button>
									{/each}
								</div>
							</div>
							<div class="prop-col mt-4">
								<label class="prop-row" for="bg-color-hex">
									<span>Color de fondo</span>
									<span class="prop-value" class:invalid={bgColorInvalid}
										>{design.bgColor.trim() || 'Del tema'}</span
									>
								</label>
								<div class="hex-field">
									<label class="hex-chip-wrap" title="Elegir color de fondo con la paleta">
										<input
											type="color"
											class="native-color-picker"
											value={design.bgColor.trim().length === 7 ? design.bgColor.trim() : '#0f172a'}
											oninput={(e) => (design.bgColor = e.target.value)}
										/>
										<span
											class="hex-chip theme-fallback"
											class:active={design.bgColor.trim() !== ''}
											class:invalid={bgColorInvalid}
											style="background: {design.bgColor.trim() &&
											HEX_FIELD_RE.test(design.bgColor.trim())
												? design.bgColor.trim()
												: 'transparent'};"
											title={design.bgColor.trim() ? design.bgColor : 'Color del tema'}
											aria-hidden="true"
										></span>
									</label>
									<input
										id="bg-color-hex"
										name="bg-color-hex"
										type="text"
										class="hex-input"
										class:invalid={bgColorInvalid}
										placeholder="#000000 o vacío (tema)"
										bind:value={design.bgColor}
										maxlength="7"
										spellcheck="false"
										onblur={() => commitHex('bgColor', '')}
									/>
									{#if design.bgColor.trim()}
										<button
											class="btn-icon sm"
											onclick={() => (design.bgColor = '')}
											title="Restablecer al tema"
										>
											<span class="material-icons-round">restart_alt</span>
										</button>
									{/if}
								</div>
								{#if bgColorInvalid}
									<p class="field-error">Formato hex inválido. Déjalo vacío para usar el tema.</p>
								{/if}
							</div>
						</section>

						<section class="props-section">
							<h3 class="props-title"><span class="sec-num">03</span> Fondo inmersivo</h3>
							<div class="prop-col">
								<label class="prop-row" for="bg-image-url">
									<span>Imagen de fondo</span>
									{#if design.bgImageUrl.trim() && !bgUrlInvalid}<span class="prop-value ok"
											>Lista ✓</span
										>{/if}
								</label>
								<input
									id="bg-image-url"
									name="bg-image-url"
									type="text"
									class="text-input"
									class:invalid={bgUrlInvalid}
									placeholder="/uploads/posts/… o sube un archivo"
									bind:value={design.bgImageUrl}
									spellcheck="false"
								/>
								{#if bgUrlInvalid}
									<p class="field-error">
										Solo se permiten rutas subidas al sitio (/uploads/…). Sube un archivo para
										obtener una URL válida.
									</p>
								{/if}
								<div class="upload-zone">
									<input
										id="bg-image-file"
										name="bg-image-file"
										type="file"
										accept="image/png,image/jpeg,image/webp,image/gif"
										onchange={handleBgUpload}
									/>
									<span class="material-icons-round">image</span>
									<span>Sube una imagen (JPG, PNG, WebP, GIF)</span>
								</div>
								{#if design.bgImageUrl}
									<div class="bg-thumb-row">
										<img src={design.bgImageUrl} alt="Previsualización del fondo" />
										<button
											class="btn-icon sm danger"
											onclick={() => (design.bgImageUrl = '')}
											title="Quitar imagen de fondo"
										>
											<span class="material-icons-round">delete</span>
										</button>
									</div>
								{/if}
							</div>
						</section>

						<section class="props-section">
							<h3 class="props-title"><span class="sec-num">04</span> Física del cristal</h3>
							<div class="prop-col">
								<label class="prop-row" for="glass-blur">
									<span>Difuminado</span>
									<span class="prop-value">{design.glassBlur}px</span>
								</label>
								<FancySlider
									id="glass-blur"
									min={0}
									max={40}
									step={1}
									bind:value={design.glassBlur}
									label="Intensidad de difuminado del cristal"
								/>
							</div>
							<div class="prop-col mt-3">
								<label class="prop-row" for="glass-opacity">
									<span>Opacidad de paneles</span>
									<span class="prop-value">{Math.round(design.glassOpacity * 100)}%</span>
								</label>
								<FancySlider
									id="glass-opacity"
									min={0.2}
									max={1}
									step={0.05}
									bind:value={design.glassOpacity}
									label="Opacidad de los paneles de vidrio"
								/>
								<p class="hint">
									Controla cuánto se transparentan las tarjetas de vidrio sobre tu fondo.
								</p>
							</div>
						</section>

						<section class="props-section">
							<h3 class="props-title"><span class="sec-num">05</span> Tipografía</h3>
							<div class="prop-col">
								<div class="upload-zone">
									<input
										id="font-upload"
										name="font-upload"
										type="file"
										accept=".otf,.ttf,.woff,.woff2"
										onchange={handleFontUpload}
									/>
									<span class="material-icons-round">font_download</span>
									<span>Sube una fuente (.otf, .ttf, .woff, .woff2)</span>
								</div>
								{#if design.customFontUrl}
									<label class="prop-row mt-2" for="font-family-name">
										<span>Nombre de la fuente</span>
									</label>
									<input
										id="font-family-name"
										name="font-family-name"
										type="text"
										class="text-input"
										placeholder="MiFuente"
										bind:value={design.fontFamily}
										maxlength={DESIGN_LIMITS.FONT_FAMILY_MAX}
									/>
									<button
										class="btn-icon sm danger mt-2"
										onclick={() => {
											design.customFontUrl = '';
										}}
										title="Quitar fuente personalizada"
									>
										<span class="material-icons-round">delete</span>
										Quitar fuente
									</button>
								{/if}
							</div>
						</section>

						<section class="props-section">
							<h3 class="props-title"><span class="sec-num">06</span> Avanzado</h3>
							<div class="flex-col-center">
								<button class="btn-advanced" onclick={() => (showCssModal = true)}>
									<span class="material-icons-round">code</span>
									Modo avanzado (CSS)
									{#if (design.customCss || '').trim()}<span class="mini-badge">activo</span>{/if}
								</button>
								<button type="button" class="factory-link" onclick={factoryReset}>
									<span class="material-icons-round">restart_alt</span>
									Restaurar diseño por defecto
								</button>
							</div>
						</section>
					{:else if activeTab === 'blocks'}
						<section class="props-section">
							<h3 class="props-title">Estructura del perfil</h3>
							<p class="hint mb-4">
								Arrastra el asa para reordenar, usa las flechas como alternativa y activa o edita
								cada bloque. Se renderizan de verdad en tu perfil.
							</p>

							{#if !design.blocks.length && !loading}
								<p class="empty-note">Sin bloques todavía. Añade uno abajo.</p>
							{/if}

							<div class="blocks-list" bind:this={blocksListEl}>
								{#each design.blocks as block, i (block.id)}
									<article
										class="block-card"
										class:active={block.enabled}
										class:dragging={dragIndex === i}
										class:drop-target={overIndex === i && dragIndex !== -1 && dragIndex !== i}
										class:syncing={highlightedBlockId === block.id}
										data-block-row={i}
										onpointerenter={() => focusBlock(block.id)}
										onpointerleave={blurBlock}
									>
										<div class="block-head">
											<button
												type="button"
												class="drag-handle"
												aria-label="Arrastrar para reordenar {block.type}"
												onpointerdown={(e) => dragStart(i, e)}
												onpointermove={dragMove}
												onpointerup={dragEnd}
												onpointercancel={dragEnd}
											>
												<span class="material-icons-round">drag_indicator</span>
											</button>

											<span class="block-icon material-icons-round" aria-hidden="true">
												{BLOCK_CATALOG.find((c) => c.type === block.type)?.icon ?? 'widgets'}
											</span>
											<span class="block-label truncate">
												{block.type === 'bio'
													? 'Texto'
													: block.type === 'links'
														? 'Enlaces'
														: block.type === 'feed'
															? 'Publicaciones'
															: 'Galería'}
											</span>

											<label class="sr-only" for="block-enable-{i}"
												>Activar bloque {block.type}</label
											>
											<input
												id="block-enable-{i}"
												name="block-enable-{i}"
												type="checkbox"
												class="toggle"
												checked={block.enabled}
												onchange={() => toggleBlock(i)}
											/>

											<div class="order-arrows">
												<button
													type="button"
													class="arrow-btn"
													disabled={i === 0}
													onclick={() => moveBlock(i, i - 1)}
													aria-label="Subir bloque"
												>
													<span class="material-icons-round">expand_less</span>
												</button>
												<button
													type="button"
													class="arrow-btn"
													disabled={i === design.blocks.length - 1}
													onclick={() => moveBlock(i, i + 1)}
													aria-label="Bajar bloque"
												>
													<span class="material-icons-round">expand_more</span>
												</button>
											</div>

											{#if BLOCK_CATALOG.find((c) => c.type === block.type)?.dynamic}
												<button
													type="button"
													class="arrow-btn danger"
													onclick={() => removeBlock(i)}
													aria-label="Eliminar bloque"
													title="Eliminar bloque"
												>
													<span class="material-icons-round">close</span>
												</button>
											{/if}
										</div>

										{#if block.enabled && (block.type === 'bio' || block.type === 'links')}
											<div class="block-editor">
												{#if block.type === 'bio'}
													<label class="editor-caption" for="block-content-{i}"
														>Contenido del texto</label
													>
													<textarea
														id="block-content-{i}"
														name="block-content-{i}"
														bind:value={block.content}
														rows="3"
														maxlength={DESIGN_LIMITS.BLOCK_CONTENT_MAX}
														placeholder="Escribe algo sobre ti…"
													></textarea>
												{:else}
													<span class="editor-caption">Lista de enlaces (https)</span>
													{#each block.links ?? [] as link, li}
														<div class="link-row" key={li}>
															<label class="sr-only" for="link-title-{i}-{li}"
																>Título del enlace {li + 1}</label
															>
															<input
																id="link-title-{i}-{li}"
																name="link-title-{i}-{li}"
																type="text"
																placeholder="Título"
																bind:value={link.title}
																maxlength={DESIGN_LIMITS.LINK_TITLE_MAX}
															/>
															<label class="sr-only" for="link-url-{i}-{li}"
																>URL del enlace {li + 1}</label
															>
															<input
																id="link-url-{i}-{li}"
																name="link-url-{i}-{li}"
																type="url"
																placeholder="https://…"
																bind:value={link.url}
															/>
															<button
																type="button"
																class="arrow-btn danger"
																onclick={() => removeLink(block, li)}
																aria-label="Quitar enlace"
															>
																<span class="material-icons-round">close</span>
															</button>
														</div>
													{/each}
													<button
														type="button"
														class="add-link-btn"
														onclick={() => addLink(block)}
														disabled={(block.links?.length ?? 0) >=
															DESIGN_LIMITS.LINKS_PER_BLOCK_MAX}
													>
														Añadir enlace
													</button>
												{/if}
											</div>
										{:else if block.enabled}
											<p class="auto-note">
												Este bloque se rellena automáticamente con tus publicaciones.
											</p>
										{/if}
									</article>
								{/each}
							</div>

							<h3 class="props-title mt-6">Añadir bloque</h3>
							<div class="add-grid">
								{#each BLOCK_CATALOG as cat (cat.type)}
									{@const single = !cat.dynamic && countBlocksOfType(cat.type) > 0}
									<button
										class="add-tile"
										onclick={() => addBlock(cat.type)}
										disabled={single || design.blocks.length >= DESIGN_LIMITS.BLOCKS_MAX}
										title={single ? 'Ya tienes uno (único)' : ''}
									>
										<span class="material-icons-round">{cat.icon}</span>
										{cat.label}
									</button>
								{/each}
							</div>
						</section>
					{/if}
				</div>
			</aside>
		{:else}
			<button
				type="button"
				class="open-panel-fab glass-card"
				onclick={() => (panelOpen = true)}
				transition:fade
				title="Abrir editor"
			>
				<span class="material-icons-round">palette</span>
			</button>
		{/if}
	</div>
</div>

<!-- ══════════ Modal Power CSS ══════════ -->
{#if showCssModal}
	<div class="css-modal-backdrop" transition:fade={{ duration: 150 }}>
		<div
			class="css-modal glass-panel"
			role="dialog"
			aria-modal="true"
			aria-labelledby="css-modal-title"
		>
			<header class="flex justify-between items-center mb-3">
				<h2 id="css-modal-title" class="modal-title">
					<span class="material-icons-round">terminal</span>
					Power User CSS
				</h2>
				<button
					type="button"
					class="btn-icon"
					onclick={() => (showCssModal = false)}
					aria-label="Cerrar editor CSS"
				>
					<span class="material-icons-round">close</span>
				</button>
			</header>

			<div class="css-hintbox">
				<p>
					<strong>Ámbito automático:</strong> todas tus reglas se aplican SOLO dentro de tu perfil. No
					necesitas prefijar nada: el servidor añade automáticamente el selector raíz por ti.
				</p>
				<p>Ejemplo:</p>
				<pre>.glass-card {'{'} border-radius: 20px; box-shadow: 8px 8px 0 #1b85f3; {'}'}</pre>
				<ul>
					<li>
						No se permiten recursos externos (<code>@import</code>, URLs fuera de este sitio).
					</li>
					<li>Límite de {DESIGN_LIMITS.CUSTOM_CSS_MAX} caracteres.</li>
					<li>
						<code>position: fixed</code> se convierte automáticamente en <code>absolute</code>.
					</li>
				</ul>
			</div>

			<div class="css-snippets-row">
				<span class="snippets-label">Atajos rápidos:</span>
				<button
					type="button"
					class="snippet-chip"
					onclick={() => {
						const snippet =
							'\n.glass-card {\n  border-radius: 24px;\n  border-color: rgba(27, 133, 243, 0.4);\n}\n';
						if (!design.customCss.includes('.glass-card'))
							design.customCss = (design.customCss + snippet).trim();
					}}
				>
					+ Bordes curvados
				</button>
				<button
					type="button"
					class="snippet-chip"
					onclick={() => {
						const snippet =
							'\n.profile-header-card {\n  box-shadow: 0 0 35px rgba(27, 133, 243, 0.35);\n}\n';
						if (!design.customCss.includes('.profile-header-card'))
							design.customCss = (design.customCss + snippet).trim();
					}}
				>
					+ Resplandor neón
				</button>
				<button
					type="button"
					class="snippet-chip"
					onclick={() => {
						const snippet = '\n.pb-card {\n  backdrop-filter: blur(28px) saturate(1.4);\n}\n';
						if (!design.customCss.includes('blur(28px)'))
							design.customCss = (design.customCss + snippet).trim();
					}}
				>
					+ Cristal ultra-glaseado
				</button>
			</div>

			<textarea
				class="code-editor"
				bind:value={design.customCss}
				spellcheck="false"
				placeholder="/* Tus reglas CSS aquí */"
				aria-label="Editor de CSS personalizado"
			></textarea>
			<p class="char-count" class:over={cssTooLong}>
				{cssCharCount} / {DESIGN_LIMITS.CUSTOM_CSS_MAX}
			</p>

			<footer class="flex justify-end gap-2 mt-3">
				<button type="button" class="btn-aero-secondary" onclick={() => (showCssModal = false)}
					>Cerrar</button
				>
				<button
					type="button"
					class="btn-aero-primary"
					onclick={() => (showCssModal = false)}
					disabled={cssTooLong}
				>
					{cssTooLong ? 'CSS demasiado largo' : 'Aplicar al preview'}
				</button>
			</footer>
		</div>
	</div>
{/if}

<style>
	/* ═══ Bloqueo estricto del shell externo en /settings/design ═══ */
	:global(.vs-shell:has(.designer-canvas)) {
		height: 100vh !important;
		max-height: 100vh !important;
		overflow: hidden !important;
	}
	:global(.vs-shell:has(.designer-canvas) .vs-shell__stage) {
		height: 100vh !important;
		max-height: 100vh !important;
		overflow: hidden !important;
	}
	:global(.vs-shell:has(.designer-canvas) .vs-shell__canvas) {
		padding: 0 !important;
		height: calc(100vh - 58px) !important;
		max-height: calc(100vh - 58px) !important;
		overflow: hidden !important;
	}

	/* ═══ Layout general ═══ */
	.designer-canvas {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: calc(100vh - 58px);
		max-height: calc(100vh - 58px);
		min-height: 0;
		margin: 0;
		padding: 0;
		overflow: hidden;
		background-color: var(--bg-canvas);
		background-image:
			radial-gradient(
				900px 420px at 78% -8%,
				color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 7%, transparent),
				transparent 70%
			),
			radial-gradient(color-mix(in srgb, var(--text-main) 5%, transparent) 1px, transparent 1.4px);
		background-size:
			auto,
			26px 26px;
		position: relative;
		box-sizing: border-box;
	}

	/* ── Chrome unificado ── */
	.editor-chrome {
		position: relative;
		top: 0;
		z-index: 120;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		height: 56px;
		min-height: 56px;
		flex-shrink: 0;
		padding: 0 18px;
		border-top: none;
		border-left: none;
		border-right: none;
		border-bottom: 1px solid var(--border-subtle);
		border-radius: 0;
		backdrop-filter: var(--glass-blur, blur(14px) saturate(1.2));
	}
	.chrome-left {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.chrome-title {
		display: flex;
		flex-direction: column;
		line-height: 1.15;
		min-width: 0;
	}
	.chrome-title h1 {
		margin: 0;
		font-size: 0.98rem;
		font-weight: 800;
		color: var(--text-main);
		letter-spacing: -0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.chrome-title span {
		font-size: 0.72rem;
		color: var(--text-muted);
	}
	.chrome-actions {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-shrink: 0;
	}

	.device-toggle {
		display: inline-flex;
		gap: 4px;
		padding: 3px;
		border-radius: 999px;
		background: var(--bg-input);
		border: 1px solid var(--border-subtle);
	}
	.device-toggle button {
		width: 36px;
		height: 30px;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
	}
	.device-toggle button.active {
		background: var(--accent-blue-base, var(--aero-blue));
		color: white;
		box-shadow: 0 2px 8px
			color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 45%, transparent);
	}
	.device-toggle button:hover:not(.active) {
		background: var(--bg-surface-hover);
		color: var(--text-main);
	}

	.dirty-chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 0.74rem;
		font-weight: 700;
		color: var(--amber-warm, #d97706);
		background: color-mix(in srgb, var(--amber-warm, #d97706) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--amber-warm, #d97706) 35%, transparent);
		border-radius: 999px;
		padding: 5px 12px;
	}
	.dirty-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: currentColor;
		animation: pulse-dot 1.4s ease-in-out infinite;
	}
	@keyframes pulse-dot {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.45;
			transform: scale(0.8);
		}
	}

	.btn-save {
		padding: 9px 20px;
		font-size: 0.86rem;
		font-weight: 800;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		gap: 7px;
		white-space: nowrap;
		transition:
			background 0.2s ease,
			transform 0.15s ease,
			box-shadow 0.2s ease;
	}
	.btn-save:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.btn-save.is-success {
		background: linear-gradient(135deg, var(--aero-mint, #00d4aa), #00b894);
		color: #04241e;
		box-shadow: 0 4px 16px color-mix(in srgb, var(--aero-mint, #00d4aa) 45%, transparent);
	}
	.btn-save.is-success .material-icons-round {
		font-size: 17px;
	}

	.editor-body {
		flex: 1 1 0%;
		display: flex;
		align-items: stretch;
		min-height: 0;
		height: calc(100% - 56px);
		overflow: hidden;
	}

	.preview-area {
		flex: 1 1 0%;
		min-width: 0;
		min-height: 0;
		height: 100%;
		position: relative;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.preview-scroll {
		flex: 1 1 0%;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		overscroll-behavior: contain;
		padding: 24px 20px 64px;
		scrollbar-width: thin;
		scrollbar-color: var(--scrollbar-thumb) transparent;
	}
	.preview-scroll::-webkit-scrollbar {
		width: 8px;
	}
	.preview-scroll::-webkit-scrollbar-thumb {
		background: var(--scrollbar-thumb);
		border-radius: 999px;
	}

	.preview-viewport {
		width: 100%;
		max-width: 800px;
		margin: 0 auto;
		border-radius: var(--radius-lg, 22px);
		transition:
			max-width 0.35s cubic-bezier(0.34, 1.3, 0.64, 1),
			box-shadow 0.3s ease,
			border-radius 0.3s ease;
		box-shadow:
			0 12px 36px rgba(0, 0, 0, 0.22),
			0 2px 8px rgba(0, 0, 0, 0.1);
		overflow: hidden;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		position: relative;
	}
	.preview-viewport.is-mobile {
		max-width: 420px;
		border-radius: 36px;
		border: 5px solid color-mix(in srgb, var(--text-main) 14%, var(--bg-surface));
		box-shadow:
			0 24px 56px rgba(0, 0, 0, 0.38),
			0 0 0 1px var(--border-subtle);
		padding-top: 14px;
	}
	.mobile-speaker-bar {
		position: absolute;
		top: 6px;
		left: 50%;
		transform: translateX(-50%);
		width: 44px;
		height: 4px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--text-main) 28%, transparent);
		z-index: 50;
		pointer-events: none;
	}

	.preview-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 96px 0;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	/* Contenedor del preview: aloja el ProfileHeaderCard real + los bloques */
	.preview-profile-container {
		max-width: 800px;
		margin: 0 auto;
		padding: 24px 16px 48px;
	}
	.preview-profile-container :global(.profile-header-card) {
		border-radius: var(--radius-lg, 22px);
	}

	/* ═══ Panel de propiedades ═══ */
	.props-panel {
		width: 400px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		background: var(--bg-surface);
		border-left: 1px solid var(--border-subtle);
		z-index: 105;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.btn-icon {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		color: var(--text-main);
		cursor: pointer;
		text-decoration: none;
		transition: all 0.15s ease;
	}
	.btn-icon:hover {
		transform: scale(1.06);
		color: var(--accent-blue-base, var(--aero-blue));
		background: var(--bg-surface-hover);
	}
	.btn-icon.sm {
		width: 30px;
		height: 30px;
	}
	.btn-icon.sm .material-icons-round {
		font-size: 15px;
	}
	.btn-icon.danger {
		color: var(--aero-rose, #e84a72);
	}
	.btn-icon.danger:hover {
		background: color-mix(in srgb, var(--aero-rose, #e84a72) 12%, transparent);
	}

	.panel-tabs {
		display: flex;
		flex-shrink: 0; /* los tabs nunca se comprimen ni desaparecen al scrollear */
		border-bottom: 1px solid var(--border-subtle);
		background: color-mix(in srgb, var(--text-main) 3%, transparent);
	}
	.panel-tabs button {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		padding: 13px 0;
		font-size: 0.86rem;
		font-weight: 700;
		color: var(--text-muted);
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		transition: all 0.15s ease;
		position: relative;
	}
	.panel-tabs button:hover {
		color: var(--text-main);
	}
	.panel-tabs button.active {
		color: var(--accent-blue-base, var(--aero-blue));
		border-bottom-color: var(--accent-blue-base, var(--aero-blue));
	}
	.panel-close-btn {
		flex: 0 0 42px !important;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-muted);
		border: none;
		border-bottom: 2px solid transparent !important;
		background: transparent;
		cursor: pointer;
		transition:
			color 0.15s ease,
			background 0.15s ease;
	}
	.panel-close-btn:hover {
		color: var(--text-main);
		background: var(--bg-surface-hover);
	}
	.tab-dirty-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--amber-warm, #d97706);
	}

	.panel-content {
		flex: 1;
		overflow-y: auto;
		padding: 18px 20px 28px;
		scrollbar-width: thin;
		scrollbar-color: var(--scrollbar-thumb) transparent;
		min-height: 0;
	}
	.panel-content::-webkit-scrollbar {
		width: 8px;
	}
	.panel-content::-webkit-scrollbar-thumb {
		background: var(--scrollbar-thumb);
		border-radius: 999px;
	}

	.feedback {
		border-radius: var(--radius-sm, 12px);
		padding: 12px 14px;
		margin-bottom: 16px;
		font-size: 0.82rem;
		line-height: 1.45;
		border: 1px solid transparent;
	}
	.feedback p {
		margin: 0 0 3px;
	}
	.feedback p:last-child {
		margin-bottom: 0;
	}
	.feedback.ok {
		background: color-mix(in srgb, var(--aero-mint, #00d4aa) 10%, transparent);
		border-color: color-mix(in srgb, var(--aero-mint, #00d4aa) 30%, transparent);
		color: var(--text-main);
	}
	.feedback.error {
		background: color-mix(in srgb, var(--aero-rose, #e84a72) 10%, transparent);
		border-color: color-mix(in srgb, var(--aero-rose, #e84a72) 30%, transparent);
		color: var(--text-main);
	}
	.feedback.warn {
		background: color-mix(in srgb, var(--amber-warm, #d97706) 10%, transparent);
		border-color: color-mix(in srgb, var(--amber-warm, #d97706) 30%, transparent);
		color: var(--text-main);
	}

	.props-section {
		margin-bottom: 26px;
	}
	.props-title {
		font-size: 0.72rem;
		text-transform: uppercase;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		margin: 0 0 10px;
	}

	.prop-col {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.prop-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.88rem;
		font-weight: 650;
		color: var(--text-main);
		margin: 0;
	}
	.prop-value {
		font-family: ui-monospace, monospace;
		font-size: 0.74rem;
		color: var(--text-muted);
		text-transform: uppercase;
	}
	.prop-value.ok {
		color: var(--aero-mint, #00d4aa);
	}
	.prop-value.invalid {
		color: var(--aero-rose, #e84a72);
		font-weight: 700;
	}
	.field-error {
		margin: 2px 0 0;
		font-size: 0.74rem;
		line-height: 1.4;
		color: var(--aero-rose, #e84a72);
	}

	/* Campo hex con chip de color en vivo */
	.hex-field {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.hex-chip-wrap {
		position: relative;
		width: 34px;
		height: 30px;
		flex-shrink: 0;
		cursor: pointer;
		border-radius: 8px;
		display: inline-flex;
		transition: transform 0.15s ease;
	}
	.hex-chip-wrap:hover {
		transform: scale(1.06);
	}
	.native-color-picker {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
		padding: 0;
		border: none;
		z-index: 2;
	}
	.hex-chip {
		width: 34px;
		height: 30px;
		border-radius: 8px;
		flex-shrink: 0;
		border: 1px solid var(--border-subtle);
		background-color: var(--bg-surface-hover, rgba(127, 127, 127, 0.15));
		background-image:
			linear-gradient(
				45deg,
				rgba(127, 127, 127, 0.18) 25%,
				transparent 25%,
				transparent 75%,
				rgba(127, 127, 127, 0.18) 75%
			),
			linear-gradient(
				45deg,
				rgba(127, 127, 127, 0.18) 25%,
				transparent 25%,
				transparent 75%,
				rgba(127, 127, 127, 0.18) 75%
			);
		background-size: 10px 10px;
		background-position:
			0 0,
			5px 5px;
	}
	.hex-chip.theme-fallback::after {
		content: 'tema';
		display: block;
		font-size: 0.55rem;
		text-align: center;
		line-height: 28px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.hex-chip.active::after,
	.hex-chip:not(.theme-fallback)::after {
		content: none;
	}
	.hex-chip.invalid {
		border-color: var(--aero-rose, #e84a72);
	}
	.hex-input.invalid,
	.text-input.invalid {
		border-color: var(--aero-rose, #e84a72);
	}
	.hex-input:focus,
	.text-input:focus {
		outline: none;
	}
	.hint {
		font-size: 0.75rem;
		color: var(--text-muted);
		line-height: 1.4;
		margin: 0;
	}
	.empty-note {
		text-align: center;
		color: var(--text-muted);
		font-size: 0.85rem;
		padding: 24px 0;
	}

	/* Sliders: FancySlider (100% custom, sin <input type="range">) */

	.hex-input,
	.text-input {
		background: var(--bg-input, var(--bg-surface));
		border: 1px solid var(--border-subtle);
		border-radius: 8px;
		padding: 8px 11px;
		font-size: 0.85rem;
		color: var(--text-main);
		width: 100%;
		transition: border-color 0.15s ease;
	}
	.hex-input:focus,
	.text-input:focus {
		outline: none;
		border-color: var(--accent-blue-base, var(--aero-blue));
	}

	.swatches {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.swatch {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		transition:
			transform 0.12s ease,
			border-color 0.12s ease;
	}
	.swatch:hover {
		transform: scale(1.12);
	}
	.swatch.selected {
		border-color: var(--text-main);
		box-shadow: 0 0 0 2px var(--bg-surface) inset;
	}

	.presets-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}
	.preset-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 7px;
		padding: 12px 8px 10px;
		border-radius: var(--radius-sm, 12px);
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		color: var(--text-main);
		font-size: 0.76rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.preset-card:hover {
		transform: translateY(-3px);
		border-color: var(--accent-blue-base, var(--aero-blue));
		box-shadow: var(--shadow-md);
	}
	.preset-card.active-preset {
		border-color: var(--accent-blue-base, var(--aero-blue));
		box-shadow: 0 0 0 2px
			color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 40%, transparent);
		background: color-mix(
			in srgb,
			var(--accent-blue-base, var(--aero-blue)) 10%,
			var(--bg-surface)
		);
	}
	.preset-card .material-icons-round {
		font-size: 17px;
		color: var(--accent-blue-base, var(--aero-blue));
	}
	.preset-swatch {
		width: 100%;
		height: 30px;
		border-radius: 8px;
	}

	.upload-zone {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 5px;
		padding: 18px 14px;
		border: 2px dashed
			color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 40%, transparent);
		border-radius: var(--radius-sm, 12px);
		background: color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 5%, transparent);
		color: var(--text-muted);
		font-size: 0.78rem;
		text-align: center;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.upload-zone:hover {
		background: color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 10%, transparent);
	}
	.upload-zone input[type='file'] {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
		z-index: 1;
	}
	.upload-zone .material-icons-round {
		font-size: 26px;
		color: var(--accent-blue-base, var(--aero-blue));
	}

	.bg-thumb-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.bg-thumb-row img {
		width: 120px;
		height: 56px;
		object-fit: cover;
		border-radius: 8px;
		border: 1px solid var(--border-subtle);
	}

	.mt-2 {
		margin-top: 8px;
	}
	.mt-3 {
		margin-top: 12px;
	}
	.mt-4 {
		margin-top: 16px;
	}
	.mt-6 {
		margin-top: 24px;
	}
	.mb-4 {
		margin-bottom: 16px;
	}
	.pb-2 {
		padding-bottom: 8px;
	}
	.pb-4 {
		padding-bottom: 16px;
	}
	.flex {
		display: flex;
	}
	.grow {
		flex: 1;
	}
	.items-center {
		align-items: center;
	}
	.justify-between {
		justify-content: space-between;
	}
	.justify-end {
		justify-content: flex-end;
	}
	.gap-2 {
		gap: 8px;
	}
	.truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.text-center {
		text-align: center;
	}

	.btn-advanced {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		background: transparent;
		border: 1px dashed var(--accent-blue-base, var(--aero-blue));
		color: var(--accent-blue-base, var(--aero-blue));
		padding: 9px 18px;
		border-radius: 999px;
		font-size: 0.84rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s ease;
	}
	.btn-advanced:hover {
		background: color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 10%, transparent);
	}
	.mini-badge {
		font-size: 0.62rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: var(--aero-mint, #00d4aa);
		color: #04241e;
		border-radius: 999px;
		padding: 2px 8px;
	}

	.flex-col-center {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}
	.factory-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-size: 0.76rem;
		font-weight: 650;
		cursor: pointer;
		text-decoration: underline dotted;
		text-underline-offset: 3px;
		transition:
			color 0.15s ease,
			transform 0.15s ease;
	}
	.factory-link:hover {
		color: var(--aero-rose, #e84a72);
		transform: translateY(-1px);
	}
	.factory-link .material-icons-round {
		font-size: 14px;
	}

	/* Fila de descarte (panel, cuando hay cambios sin guardar) */
	.discard-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.76rem;
		color: var(--text-muted);
		background: color-mix(in srgb, var(--amber-warm, #d97706) 8%, transparent);
		border: 1px dashed color-mix(in srgb, var(--amber-warm, #d97706) 30%, transparent);
		border-radius: var(--radius-sm, 12px);
		padding: 8px 12px;
		margin-bottom: 14px;
	}
	.discard-row .material-icons-round {
		font-size: 16px;
		color: var(--amber-warm, #d97706);
	}
	.discard-link {
		margin-left: auto;
		background: transparent;
		border: none;
		color: var(--aero-rose, #e84a72);
		font-size: 0.76rem;
		font-weight: 700;
		cursor: pointer;
		text-decoration: underline dotted;
		text-underline-offset: 3px;
		padding: 2px 4px;
	}
	.discard-link:hover {
		color: var(--aero-rose, #e84a72);
		text-decoration-style: solid;
	}
	.discard-link:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Número de sección (01–06) */
	.sec-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 18px;
		padding: 0 5px;
		border-radius: 6px;
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		color: white;
		background: linear-gradient(
			135deg,
			var(--accent-blue-base, var(--aero-blue)),
			var(--accent-blue-light, var(--aero-sky))
		);
		box-shadow: 0 2px 6px
			color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 35%, transparent);
	}

	.open-panel-fab {
		position: fixed;
		right: 24px;
		bottom: 90px;
		width: 54px;
		height: 54px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--accent-blue-base, var(--aero-blue));
		font-size: 24px;
		cursor: pointer;
		z-index: 106;
		box-shadow: var(--shadow-lg);
		border: none;
	}
	.open-panel-fab:hover {
		transform: scale(1.07);
	}

	/* ═══ Bloques (editor) ═══ */
	.blocks-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
		scrollbar-width: thin;
		scrollbar-color: var(--scrollbar-thumb) transparent;
	}
	.block-card {
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm, 12px);
		background: var(--bg-surface);
		padding: 10px 12px;
		opacity: 0.62;
		transition:
			opacity 0.15s ease,
			box-shadow 0.15s ease,
			outline 0.1s ease;
	}
	.block-card.active {
		opacity: 1;
	}
	.block-card.dragging {
		opacity: 0.45;
	}
	.block-card.drop-target {
		box-shadow: 0 0 0 2px var(--accent-blue-base, var(--aero-blue));
	}
	.block-card.syncing {
		border-color: var(--accent-blue-base, var(--aero-blue));
		background: color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 6%, var(--bg-surface));
	}
	.block-head {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
	}
	.drag-handle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 34px;
		border: none;
		background: transparent;
		color: var(--text-muted);
		cursor: grab;
		touch-action: none;
		border-radius: 8px;
	}
	.drag-handle:hover {
		background: var(--bg-surface-hover);
		color: var(--text-main);
	}
	.drag-handle:active {
		cursor: grabbing;
	}
	.drag-handle .material-icons-round {
		font-size: 19px;
	}
	.block-icon {
		font-size: 19px;
		color: var(--text-muted);
	}
	.block-card.active .block-icon {
		color: var(--accent-blue-base, var(--aero-blue));
	}
	.block-label {
		flex: 1;
		font-size: 0.87rem;
		font-weight: 700;
		color: var(--text-main);
	}

	.toggle {
		appearance: none;
		width: 34px;
		height: 19px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--text-main) 18%, transparent);
		position: relative;
		cursor: pointer;
		transition: background 0.15s ease;
		flex-shrink: 0;
		margin: 0;
	}
	.toggle::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 15px;
		height: 15px;
		border-radius: 50%;
		background: white;
		transition: left 0.15s ease;
	}
	.toggle:checked {
		background: var(--accent-blue-base, var(--aero-blue));
	}
	.toggle:checked::after {
		left: 17px;
	}

	.order-arrows {
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	.arrow-btn {
		border: none;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		padding: 1px 3px;
		display: flex;
		border-radius: 6px;
	}
	.arrow-btn:hover:not(:disabled) {
		background: var(--bg-surface-hover);
		color: var(--text-main);
	}
	.arrow-btn:disabled {
		opacity: 0.25;
		cursor: default;
	}
	.arrow-btn.danger {
		color: var(--aero-rose, #e84a72);
	}
	.arrow-btn.danger:hover {
		background: color-mix(in srgb, var(--aero-rose, #e84a72) 12%, transparent);
	}
	.arrow-btn .material-icons-round {
		font-size: 16px;
	}

	.block-editor {
		margin-top: 10px;
		padding-top: 10px;
		border-top: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.editor-caption {
		font-size: 0.73rem;
		color: var(--text-muted);
		font-weight: 650;
	}
	.block-editor textarea {
		width: 100%;
		min-height: 84px;
		background: var(--bg-input, var(--bg-surface));
		border: 1px solid var(--border-subtle);
		border-radius: 8px;
		padding: 8px 10px;
		font-size: 0.85rem;
		color: var(--text-main);
		resize: vertical;
		font-family: inherit;
	}
	.block-editor textarea:focus {
		outline: none;
		border-color: var(--accent-blue-base, var(--aero-blue));
	}
	.link-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.link-row input {
		flex: 1 1 140px;
		min-width: 0;
		background: var(--bg-input, var(--bg-surface));
		border: 1px solid var(--border-subtle);
		border-radius: 8px;
		padding: 7px 9px;
		font-size: 0.8rem;
		color: var(--text-main);
		min-width: 0;
	}
	.link-row input:focus {
		outline: none;
		border-color: var(--accent-blue-base, var(--aero-blue));
	}
	.link-row input:first-of-type {
		width: 92px;
		flex-shrink: 0;
	}
	.link-row input:nth-of-type(2) {
		flex: 1;
	}
	.add-link-btn {
		align-self: flex-start;
		background: transparent;
		border: 1px dashed var(--border-subtle);
		color: var(--accent-blue-base, var(--aero-blue));
		border-radius: 999px;
		padding: 5px 13px;
		font-size: 0.76rem;
		font-weight: 700;
		cursor: pointer;
	}
	.add-link-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.auto-note {
		margin: 8px 0 0;
		font-size: 0.75rem;
		color: var(--text-muted);
		font-style: italic;
		text-align: center;
	}

	.add-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.add-tile {
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 11px 13px;
		border-radius: var(--radius-sm, 12px);
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		color: var(--text-main);
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s ease;
	}
	.add-tile:hover:not(:disabled) {
		border-color: var(--accent-blue-base, var(--aero-blue));
		transform: translateY(-2px);
	}
	.add-tile:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.add-tile .material-icons-round {
		font-size: 19px;
		color: var(--accent-blue-base, var(--aero-blue));
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}

	/* ═══ Modal CSS ═══ */
	.css-modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(8px);
		z-index: 300;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 18px;
	}
	.css-modal {
		width: 100%;
		max-width: 720px;
		max-height: calc(100vh - 40px);
		overflow-y: auto;
		padding: 24px;
		border-radius: var(--radius-lg, 22px);
		background: var(--bg-surface);
	}
	.modal-title {
		display: flex;
		align-items: center;
		gap: 9px;
		margin: 0;
		font-size: 1.15rem;
		font-weight: 800;
		color: var(--text-main);
	}
	.modal-title .material-icons-round {
		color: var(--accent-blue-base, var(--aero-blue));
	}
	.css-hintbox {
		border-radius: var(--radius-sm, 12px);
		background: color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 7%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 18%, transparent);
		padding: 14px 16px;
		font-size: 0.82rem;
		line-height: 1.55;
		color: var(--text-secondary);
		margin-bottom: 14px;
	}
	.css-hintbox p {
		margin: 0 0 6px;
	}
	.css-hintbox strong {
		color: var(--text-main);
	}
	.css-hintbox pre {
		background: rgba(0, 0, 0, 0.35);
		color: #e6edf3;
		padding: 9px 12px;
		border-radius: 8px;
		font-size: 0.76rem;
		overflow-x: auto;
		margin: 8px 0;
	}
	.css-hintbox ul {
		margin: 6px 0 0;
		padding-left: 18px;
	}
	.css-snippets-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		margin-bottom: 12px;
	}
	.snippets-label {
		font-size: 0.76rem;
		font-weight: 700;
		color: var(--text-muted);
	}
	.snippet-chip {
		padding: 5px 12px;
		border-radius: 999px;
		font-size: 0.74rem;
		font-weight: 650;
		background: color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 10%, transparent);
		color: var(--accent-blue-base, var(--aero-blue));
		border: 1px solid color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 28%, transparent);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.snippet-chip:hover {
		background: color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 22%, transparent);
		transform: translateY(-1px);
	}
	.code-editor {
		width: 100%;
		min-height: 300px;
		font-family: 'Fira Code', ui-monospace, 'Courier New', monospace;
		font-size: 0.83rem;
		line-height: 1.55;
		background: #0d1117;
		color: #e6edf3;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: var(--radius-sm, 12px);
		padding: 16px;
		resize: vertical;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
	}
	.code-editor::-webkit-scrollbar {
		width: 8px;
	}
	.code-editor::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.22);
		border-radius: 999px;
	}
	.code-editor:focus {
		outline: none;
		border-color: var(--accent-blue-base, var(--aero-blue));
	}
	.char-count {
		margin: 6px 2px 0;
		font-size: 0.72rem;
		color: var(--text-muted);
		text-align: right;
		font-family: ui-monospace, monospace;
	}
	.char-count.over {
		color: var(--aero-rose, #e84a72);
		font-weight: 700;
	}

	/* ═══ Responsive: chrome compacto + panel bottom-sheet ═══ */
	@media (max-width: 900px) {
		/* En móvil vuelve el flujo natural: la página puede crecer (preview largo
		   + bottom-sheet) y el chrome sticky engancha al documento con normalidad. */
		.designer-canvas {
			height: auto;
			min-height: calc(100svh - 58px);
			margin-bottom: 0;
		}
		.editor-chrome {
			padding: 8px 12px;
			gap: 10px;
		}
		.chrome-title h1 {
			font-size: 0.88rem;
			max-width: 30vw;
		}
		.chrome-actions {
			gap: 8px;
		}
		.dirty-chip {
			font-size: 0;
			gap: 0;
			padding: 6px 9px;
		}
		.dirty-dot {
			width: 9px;
			height: 9px;
		}
		.chrome-save {
			padding: 8px 14px;
			font-size: 0.78rem;
		}

		.editor-body {
			flex-direction: column;
			height: auto;
			min-height: calc(100vh - 58px - 52px);
		}
		.preview-scroll {
			padding: 10px 10px 220px; /* clearance para el bottom-sheet */
		}

		.props-panel {
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			top: auto;
			width: 100%;
			height: 62vh;
			max-height: 62vh;
			border-left: none;
			border-top: 1px solid var(--border-subtle);
			border-radius: 22px 22px 0 0;
			box-shadow:
				0 -8px 32px rgba(var(--accent-blue-rgb), 0.15),
				var(--shadow-glow);
			z-index: 140;
		}
		.panel-content {
			padding: 16px;
		}
		.open-panel-fab {
			bottom: 24px;
			right: 18px;
		}
	}
</style>
