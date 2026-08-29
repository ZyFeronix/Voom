<script>
	import { fade, slide } from 'svelte/transition';
	import { beforeNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { users as usersApi, media as mediaApi } from '$lib/api.js';
	import { uiStore } from '$lib/stores/ui.svelte.js';
	import { appearanceStore } from '$lib/stores/appearance.svelte.js';
	import {
		DESIGN_LIMITS,
		DEFAULT_PRIMARY_COLOR,
		ALLOWED_BLOCK_TYPES
	} from '$lib/design/sanitize.js';
	import ProfileThemeShell from '$lib/components/profile/ProfileThemeShell.svelte';
	import ProfileHeaderCard from '$lib/components/profile/ProfileHeaderCard.svelte';
	import ProfileBlocks from '$lib/components/profile/ProfileBlocks.svelte';
	import FancySlider from '$lib/components/ui/FancySlider.svelte';
	import AccentPicker from '$lib/components/settings/design/AccentPicker.svelte';
	import TypographyDensityPanel from '$lib/components/settings/design/TypographyDensityPanel.svelte';
	import WallpaperPicker from '$lib/components/settings/design/WallpaperPicker.svelte';
	import SnippetGallery from '$lib/components/settings/design/SnippetGallery.svelte';
	import PresetVault from '$lib/components/settings/design/PresetVault.svelte';
	import SurfacePanel from '$lib/components/settings/design/SurfacePanel.svelte';
	import AppPreviewStage from '$lib/components/settings/design/AppPreviewStage.svelte';
	import ThemeSelector from '$lib/components/ThemeSelector.svelte';

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

	let activeTab = $state('style'); // 'style' | 'blocks' (pestañas del editor de PERFIL)
	let panelOpen = $state(typeof window !== 'undefined' ? window.innerWidth > 900 : true);
	let showCssModal = $state(false);
	let localCss = $state(''); // Estado local del modal CSS
	let previewMobile = $state(false);

	// Pestaña del HUB: «Perfil» (editor de perfil) | «Aplicación» (apariencia global)
	const VALID_HUB_TABS = ['profile', 'app'];
	let hubTab = $state(
		VALID_HUB_TABS.includes(page.url.searchParams.get('tab'))
			? page.url.searchParams.get('tab')
			: 'profile'
	);

	function switchHubTab(tab) {
		if (!VALID_HUB_TABS.includes(tab) || hubTab === tab) return;
		hubTab = tab;
		const url = new URL(page.url);
		if (tab === 'app') url.searchParams.set('tab', 'app');
		else url.searchParams.delete('tab');
		goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}

	function goToProfileTab() {
		switchHubTab('profile');
		panelOpen = true;
	}

	/* ── Lint suave del CSS custom (solo avisos) ── */
	let cssLint = $derived.by(() => {
		const css = localCss || '';
		const warnings = [];
		if (!css.trim()) return warnings;
		const opens = (css.match(/\{/g) || []).length;
		const closes = (css.match(/\}/g) || []).length;
		if (opens !== closes) warnings.push('Hay llaves { } desbalanceadas.');
		const externalUrls = css.match(/url\(\s*['"]?(?!['"]?\/uploads\/)(https?:)?\/\/[^)]*\)/gi);
		if (externalUrls?.length)
			warnings.push(
				'Las URLs externas en url() se bloquean al guardar. Usa /uploads/… o sube el archivo.'
			);
		if (/(^|[\s,}])((html|body)\b|#\w+|:root)/i.test(css))
			warnings.push('Los selectores globales (body, html, :root…) quedan limitados a tu perfil.');
		const importants = (css.match(/!important/g) || []).length;
		if (importants >= 5)
			warnings.push(`Muchos !important (${importants}): pueden romper estilos propios.`);
		if (css.length > DESIGN_LIMITS.CUSTOM_CSS_MAX)
			warnings.push('Superas el límite de caracteres: recorta antes de guardar.');
		return warnings;
	});

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
						? {
								i: b.id,
								t: b.type,
								e: b.enabled,
								l: (b.links || []).map((x) => [x?.title || '', x?.url || ''])
							}
						: { i: b.id, t: b.type, e: b.enabled }
			)
		]);
	}

	let isDirty = $derived(snapshotJson !== '' && serializeCurrent() !== snapshotJson);

	let autoSaveTimer = null;
	let profileSyncStatus = $state('idle'); // 'idle' | 'saving' | 'saved' | 'error'
	let autoSaveFlashTimer = null;

	/* Sincroniza la fuente personalizada activa con appearanceStore sin abortar timers de guardado */
	$effect(() => {
		appearanceStore.setCustomFont(design.fontFamily || '', design.customFontUrl || '');
	});

	/* ── Autoguardado debouncado para Perfil ── */
	$effect(() => {
		const currentJson = serializeCurrent();
		const dirty = snapshotJson !== '' && currentJson !== snapshotJson;

		if (dirty && !saveBlocked && !loading) {
			clearTimeout(autoSaveTimer);
			autoSaveTimer = setTimeout(() => {
				if (!saveBlocked && !saving) {
					void saveDesign(true);
				}
			}, 1200);
		} else if (!dirty || saveBlocked) {
			clearTimeout(autoSaveTimer);
		}
	});

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

	async function saveDesign(isAuto = false) {
		if (saving) return;
		if (saveBlocked) return;
		clearTimeout(autoSaveTimer);
		autoSaveTimer = null;
		saving = true;
		profileSyncStatus = 'saving';
		if (!isAuto) feedback = null;
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
			if (!isAuto) {
				feedback = warnLines.length
					? { kind: 'warn', lines: ['Diseño guardado con avisos:', ...warnLines] }
					: { kind: 'ok', lines: ['¡Diseño guardado! Tu perfil ya luce el nuevo estilo.'] };
				setTimeout(() => {
					if (feedback?.kind === 'ok') feedback = null;
				}, 3500);
			}

			justSaved = true;
			profileSyncStatus = 'saved';
			clearTimeout(autoSaveFlashTimer);
			autoSaveFlashTimer = setTimeout(() => {
				justSaved = false;
				profileSyncStatus = 'idle';
			}, 2200);
		} catch (err) {
			profileSyncStatus = 'error';
			if (!isAuto) {
				feedback = { kind: 'error', lines: [err?.message || 'Error al guardar el diseño.'] };
			}
		} finally {
			saving = false;
		}
	}

	async function resetDesign() {
		if (!isDirty) return;
		clearTimeout(autoSaveTimer);
		autoSaveTimer = null;
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
		profileSyncStatus = 'idle';
		feedback = { kind: 'ok', lines: ['Cambios descartados.'] };
		setTimeout(() => {
			if (feedback?.lines?.[0] === 'Cambios descartados.') feedback = null;
		}, 2000);
	}

	/*
	 * Guard de navegación con autoguardado fluido: si hay cambios válidos,
	 * guarda de inmediato sin bloquear al usuario. Si hay errores bloqueantes,
	 * solicita confirmación.
	 */
	let bypassGuard = false;

	beforeNavigate(async ({ cancel, to }) => {
		if (bypassGuard || !to) return;
		appearanceStore.flushSync();
		if (autoSaveTimer) {
			clearTimeout(autoSaveTimer);
			autoSaveTimer = null;
		}
		if (isDirty && !saveBlocked) {
			cancel(); // Bloqueamos navegación hasta que termine el guardado
			try {
				await saveDesign(true);
			} catch {}
			bypassGuard = true;
			goto(to.url);
			return;
		}
		if (isDirty && saveBlocked) {
			cancel();
			const confirmed = await uiStore.requestConfirm({
				title: 'Cambios sin guardar con errores',
				message: 'Hay errores en tu diseño. ¿Seguro que quieres salir y descartar los cambios?',
				danger: true,
				confirmText: 'Salir sin guardar'
			});

			if (confirmed) {
				bypassGuard = true;
				goto(to.url);
			}
		}
	});

	$effect(() => {
		const handler = () => {
			appearanceStore.flushSync();
			if (autoSaveTimer) {
				clearTimeout(autoSaveTimer);
				autoSaveTimer = null;
			}
			if (isDirty && !saveBlocked) {
				void saveDesign(true);
			}
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

	function applyPreset(preset) {
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

	function dragStart(i) {
		dragIndex = i;
		overIndex = i;
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
	let localCssCharCount = $derived((localCss || '').length);
	let localCssTooLong = $derived(localCssCharCount > DESIGN_LIMITS.CUSTOM_CSS_MAX);

	let customCssTextarea = $state(null);
	function getCcssTextarea() {
		return customCssTextarea;
	}

	/* ── Validación inline (paridad con lo que el servidor aceptará) ── */

	let primaryColorInvalid = $derived.by(() => {
		const v = design.primaryColor.trim();
		if (!v) return true;
		if (v.startsWith('#')) return !HEX_FIELD_RE.test(v);
		return !/^[0-9a-fA-F]{3,6}$/.test(v);
	});

	let bgColorInvalid = $derived.by(() => {
		const v = design.bgColor.trim();
		if (!v) return false;
		if (v.startsWith('#')) return !HEX_FIELD_RE.test(v);
		return !/^[0-9a-fA-F]{3,6}$/.test(v);
	});

	let bgUrlInvalid = $derived(
		design.bgImageUrl.trim() !== '' && !design.bgImageUrl.trim().startsWith('/uploads/')
	);
	let saveBlocked = $derived(primaryColorInvalid || bgColorInvalid || bgUrlInvalid || cssTooLong);

	function commitHex(field, previous) {
		let val = design[field].trim();
		if (val && !val.startsWith('#') && /^[0-9a-fA-F]{3,6}$/.test(val)) {
			val = '#' + val;
			design[field] = val;
		}
		if (!HEX_FIELD_RE.test(val)) design[field] = previous;
	}

	/** Restablece la apariencia GLOBAL de la app (pestaña Aplicación). */
	async function resetAppearance() {
		const ok = await uiStore.requestConfirm({
			title: 'Restablecer apariencia',
			message:
				'Volverán a los valores por defecto el acento, la tipografía, la densidad y el fondo de la aplicación. Tu diseño de perfil no se verá afectado.',
			danger: true,
			confirmText: 'Restablecer'
		});
		if (!ok) return;
		appearanceStore.resetAppearance();
	}

	/** Restaura TODO el diseño de perfil a los valores de fábrica (requiere guardar). */
	async function factoryReset() {
		const ok = await uiStore.requestConfirm({
			title: 'Restaurar diseño por defecto',
			message:
				'Se limpiarán color, fondo, cristal, fuente, CSS y bloques del perfil. Deberás pulsar Guardar para aplicarlo.',
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
		clearTimeout(syncTimer);
		syncTimer = setTimeout(() => {
			const node = previewCanvasEl?.querySelector(`[data-block-id="${CSS.escape(id)}"]`);
			const scroller = previewScrollEl;
			if (!node || !scroller) return;
			const sRect = scroller.getBoundingClientRect();
			const nRect = node.getBoundingClientRect();
			if (nRect.top >= sRect.top && nRect.bottom <= sRect.bottom) return;
			const delta = nRect.top + nRect.height / 2 - (sRect.top + sRect.height / 2);
			scroller.scrollTo({ top: scroller.scrollTop + delta, behavior: 'smooth' });
		}, 140);
	}

	function blurBlock() {
		clearTimeout(syncTimer);
		highlightedBlockId = null;
	}

	$effect(() => {
		if (activeTab !== 'blocks') blurBlock();
	});
</script>

<svelte:head>
	<title>Estudio de Diseño — Voom!</title>
</svelte:head>

<svelte:window
	onpointermove={(e) => {
		if (dragIndex >= 0) {
			e.preventDefault();
			dragMove(e);
		}
	}}
	onpointerup={() => {
		if (dragIndex >= 0) dragEnd();
	}}
	onpointercancel={() => {
		if (dragIndex >= 0) dragEnd();
	}}
/>

<div class="designer-canvas">
	<!-- ══════════ Chrome unificado: back · título · switch hub · acciones contextuales ══════════ -->
	<header class="editor-chrome">
		<div class="chrome-left">
			<a
				href="/settings"
				class="btn-icon"
				style="flex: 0 0 38px; min-width: 38px; min-height: 38px;"
				title="Volver al panel de Ajustes"
				aria-label="Volver al panel de Ajustes"
			>
				<span class="material-icons-round">arrow_back</span>
			</a>

			<div class="chrome-title">
				<h1>Estudio de Diseño</h1>
				{#if me?.username}
					<div class="user-meta-sub">
						<span>@{me.username}</span>
						<a
							href={`/u/${me.username}`}
							target="_blank"
							rel="noopener noreferrer"
							class="view-profile-link"
							title="Abrir perfil público en nueva pestaña"
						>
							<span class="material-icons-round">open_in_new</span>
							Ver perfil
						</a>
					</div>
				{/if}
			</div>
		</div>

		<!-- Hub dual central: Perfil (editor visual) | Aplicación (estilo global) -->
		<div class="chrome-center">
			<div class="hub-toggle" role="tablist" aria-label="Ámbito de personalización">
				<button
					type="button"
					role="tab"
					aria-selected={hubTab === 'profile'}
					class:active={hubTab === 'profile'}
					onclick={() => switchHubTab('profile')}
				>
					<span class="material-icons-round hub-tab-icon">person</span>
					<span>Perfil</span>
					{#if isDirty}<span class="hub-dirty-dot" title="Cambios sin guardar"></span>{/if}
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={hubTab === 'app'}
					class:active={hubTab === 'app'}
					onclick={() => switchHubTab('app')}
				>
					<span class="material-icons-round hub-tab-icon">tune</span>
					<span>Aplicación</span>
				</button>
			</div>
		</div>

		<!-- Acciones contextuales a la derecha -->
		<div class="chrome-actions">
			{#if hubTab === 'app'}
				<span
					class="dirty-chip app-sync-chip status-{appearanceStore.syncStatus}"
					transition:fade
					title={appearanceStore.syncStatus === 'saving'
						? 'Guardando cambios en tu cuenta…'
						: appearanceStore.syncStatus === 'saved'
							? 'Todos los ajustes se han guardado con éxito'
							: appearanceStore.syncStatus === 'error'
								? 'Error al guardar los cambios en la cuenta'
								: 'Los cambios se guardan automáticamente en tu cuenta'}
				>
					<span class="dirty-dot" aria-hidden="true"></span>
					<span>
						{appearanceStore.syncStatus === 'saving'
							? 'Guardando…'
							: appearanceStore.syncStatus === 'saved'
								? 'Sincronizado'
								: appearanceStore.syncStatus === 'error'
									? 'Error al guardar'
									: 'Autoguardado en nube'}
					</span>
				</span>
				<button
					type="button"
					class="btn-icon-text chrome-reset-app"
					onclick={resetAppearance}
					title="Restablecer apariencia de la aplicación a valores iniciales"
				>
					<span class="material-icons-round">restart_alt</span>
					<span class="btn-text-label">Restablecer</span>
				</button>
			{:else}
				<span
					class="dirty-chip app-sync-chip status-{profileSyncStatus}"
					transition:fade
					title={profileSyncStatus === 'saving'
						? 'Guardando diseño del perfil en tu cuenta…'
						: profileSyncStatus === 'saved'
							? 'Diseño del perfil guardado con éxito'
							: profileSyncStatus === 'error'
								? 'Error al autoguardar el diseño'
								: isDirty
									? saveBlocked
										? 'Hay errores por corregir'
										: 'Guardando automáticamente en breve…'
									: 'Los cambios se guardan automáticamente en tu cuenta'}
				>
					<span class="dirty-dot" aria-hidden="true"></span>
					<span>
						{profileSyncStatus === 'saving'
							? 'Guardando…'
							: profileSyncStatus === 'saved'
								? 'Sincronizado'
								: profileSyncStatus === 'error'
									? 'Error al guardar'
									: isDirty
										? saveBlocked
											? 'Revisa errores'
											: 'Guardando…'
										: 'Autoguardado en nube'}
					</span>
				</span>

				{#if isDirty}
					<button
						type="button"
						class="btn-discard-chrome"
						onclick={resetDesign}
						disabled={saving}
						title="Descartar cambios no guardados"
					>
						Descartar
					</button>
				{/if}

				<!-- Toggle de vista previa de dispositivo (solo visible en pantallas de escritorio) -->
				<div
					class="device-toggle desktop-only-toggle"
					role="group"
					aria-label="Vista previa del dispositivo"
				>
					<button
						type="button"
						class:active={!previewMobile}
						onclick={() => (previewMobile = false)}
						title="Simular pantalla de escritorio"
						aria-label="Simular pantalla de escritorio"
					>
						<span class="material-icons-round">desktop_windows</span>
					</button>
					<button
						type="button"
						class:active={previewMobile}
						onclick={() => (previewMobile = true)}
						title="Simular pantalla móvil"
						aria-label="Simular pantalla móvil"
					>
						<span class="material-icons-round">smartphone</span>
					</button>
				</div>

				<button
					type="button"
					class="btn-save chrome-save btn-aero-primary"
					class:is-success={justSaved}
					onclick={() => saveDesign(false)}
					disabled={saving || loading || saveBlocked}
					title={saveBlocked ? 'Corrige los errores señalados en el panel antes de guardar' : ''}
				>
					{#if saving}
						<span class="loading loading-spinner loading-sm"></span>
						<span>Guardando…</span>
					{:else if justSaved}
						<span class="material-icons-round">check_circle</span>
						<span>Guardado</span>
					{:else if saveBlocked && isDirty}
						<span>Revisa los errores</span>
					{:else if isDirty}
						<span class="material-icons-round">save</span>
						<span>Guardar ahora</span>
					{:else}
						<span class="material-icons-round">check</span>
						<span>Todo guardado</span>
					{/if}
				</button>
			{/if}

			<div class="chrome-divider" aria-hidden="true"></div>

			<!-- Selector de tema integrado directamente en el header principal -->
			<div class="chrome-theme-selector">
				<ThemeSelector compact={true} align="right" />
			</div>
		</div>
	</header>

	<!-- ══════════ Cuerpo del Estudio (Paneles estrictamente alternados) ══════════ -->
	<div class="editor-body">
		<!-- ── ÁMBITO 1: PERFIL (Lienzo interactivo + Panel lateral) ── -->
		<div
			class="hub-pane hub-pane-profile"
			class:is-active={hubTab === 'profile'}
			aria-hidden={hubTab !== 'profile'}
		>
			<main class="preview-area">
				<div class="preview-scroll" bind:this={previewScrollEl}>
					<div class="preview-viewport" class:is-mobile={previewMobile}>
						{#if previewMobile}
							<div class="mobile-speaker-bar" aria-hidden="true"></div>
						{:else}
							<!-- Mockup de barra de navegador en escritorio -->
							<div class="desktop-mockup-bar" aria-hidden="true">
								<div class="mockup-dots">
									<span class="mockup-dot red"></span>
									<span class="mockup-dot yellow"></span>
									<span class="mockup-dot green"></span>
								</div>
								<div class="mockup-address">
									<span class="material-icons-round lock-ico">lock</span>
									<span>voom.social/u/{me?.username || 'perfil'}</span>
								</div>
								<span class="mockup-badge">Lienzo en vivo</span>
							</div>
						{/if}

						{#if loading}
							<div class="preview-loading">
								<span class="loading loading-spinner text-primary"></span>
								<span>Cargando tu diseño…</span>
							</div>
						{:else}
							<ProfileThemeShell customization={previewCustomization} variant="preview">
								<div class="preview-profile-container" bind:this={previewCanvasEl}>
									<ProfileHeaderCard
										user={me}
										postsCount={me?.post_count || 0}
										followersCount={me?.follower_count || 0}
										isOwnProfile={true}
										interactive={false}
									/>

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

			{#if panelOpen}
				<aside class="props-panel" transition:slide={{ axis: 'x', duration: 250 }}>
					<!-- Tirador superior para arrastre en pantalla táctil/móvil -->
					<div class="mobile-sheet-handle-bar" aria-hidden="true">
						<span class="sheet-drag-pill"></span>
					</div>

					<nav class="panel-tabs" aria-label="Secciones del editor de perfil">
						<button
							aria-current={activeTab === 'style' ? 'true' : undefined}
							class:active={activeTab === 'style'}
							onclick={() => (activeTab = 'style')}
						>
							<span class="material-icons-round tab-ico">palette</span>
							<span>Estética</span>
						</button>
						<button
							aria-current={activeTab === 'blocks' ? 'true' : undefined}
							class:active={activeTab === 'blocks'}
							onclick={() => (activeTab = 'blocks')}
						>
							<span class="material-icons-round tab-ico">view_stream</span>
							<span>Bloques</span>
							{#if isDirty}<span class="tab-dirty-dot"></span>{/if}
						</button>
						<button
							type="button"
							class="panel-close-btn"
							onclick={() => (panelOpen = false)}
							title="Minimizar panel"
							aria-label="Minimizar panel"
						>
							<span class="material-icons-round desktop-close-ico">chevron_right</span>
							<span class="material-icons-round mobile-close-ico">expand_more</span>
						</button>
					</nav>

					<div class="panel-content">
						{#if isDirty && !saveBlocked}
							<div class="discard-row">
								<span class="material-icons-round" aria-hidden="true">
									{profileSyncStatus === 'saving' ? 'sync' : 'auto_mode'}
								</span>
								<span>
									{profileSyncStatus === 'saving'
										? 'Guardando automáticamente…'
										: 'Guardando automáticamente en breve…'}
								</span>
								<button type="button" class="discard-link" onclick={resetDesign} disabled={saving}>
									Descartar
								</button>
							</div>
						{/if}

						{#if feedback}
							<div
								class="feedback {feedback.kind}"
								role="status"
								transition:fade={{ duration: 150 }}
							>
								{#each feedback.lines as line, i (i)}
									<p>{line}</p>
								{/each}
							</div>
						{/if}

						{#if activeTab === 'style'}
							<!-- Presets -->
							<section class="props-section">
								<h3 class="props-title"><span class="sec-num">01</span> Presets rápidos</h3>
								<div class="presets-grid">
									{#each PRESETS as preset (preset.id)}
										{@const isActive =
											design.primaryColor.toLowerCase() === preset.primary_color.toLowerCase() &&
											design.glassBlur === preset.glass_blur}
										<button
											class="preset-card"
											class:active-preset={isActive}
											onclick={() => applyPreset(preset)}
										>
											<span
												class="preset-swatch"
												style="background: linear-gradient(135deg, {preset.primary_color}, {preset.bg_color
													? preset.bg_color
													: `color-mix(in srgb, ${preset.primary_color} 30%, transparent)`});"
											>
												{#if isActive}
													<span class="material-icons-round active-check" aria-hidden="true"
														>check</span
													>
												{/if}
											</span>
											<span class="preset-name">{preset.name}</span>
											<span class="material-icons-round preset-icon" aria-hidden="true"
												>{preset.icon}</span
											>
										</button>
									{/each}
								</div>
							</section>

							<!-- Colores -->
							<section class="props-section">
								<h3 class="props-title"><span class="sec-num">02</span> Colores del perfil</h3>
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
											>
												<span class="material-icons-round chip-icon" aria-hidden="true"
													>colorize</span
												>
											</span>
										</label>
										<input
											id="primary-color"
											name="primary-color"
											type="text"
											class="hex-input"
											class:invalid={primaryColorInvalid}
											placeholder="#1b85f3"
											value={design.primaryColor}
											maxlength="7"
											spellcheck="false"
											oninput={(e) => {
												let v = e.target.value.trim();
												if (v && !v.startsWith('#') && /^[0-9a-fA-F]{1,6}$/.test(v)) {
													v = '#' + v;
												}
												design.primaryColor = v;
											}}
											onblur={() => commitHex('primaryColor', DEFAULT_PRIMARY_COLOR)}
										/>
									</div>
									{#if primaryColorInvalid}
										<p class="field-error">Formato hex inválido. Ejemplos: #1b85f3, #f3c.</p>
									{/if}
									<div class="swatches" role="group" aria-label="Colores sugeridos">
										{#each COLOR_SWATCHES as color (color)}
											<button
												type="button"
												class="swatch"
												class:selected={design.primaryColor.toLowerCase() === color.toLowerCase()}
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
												value={design.bgColor.trim().length === 7
													? design.bgColor.trim()
													: '#0f172a'}
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
												aria-hidden="true"
											>
												<span class="material-icons-round chip-icon" aria-hidden="true"
													>colorize</span
												>
											</span>
										</label>
										<input
											id="bg-color-hex"
											name="bg-color-hex"
											type="text"
											class="hex-input"
											class:invalid={bgColorInvalid}
											placeholder="#000000 o vacío (tema)"
											value={design.bgColor}
											maxlength="7"
											spellcheck="false"
											oninput={(e) => {
												let v = e.target.value.trim();
												if (v && !v.startsWith('#') && /^[0-9a-fA-F]{1,6}$/.test(v)) {
													v = '#' + v;
												}
												design.bgColor = v;
											}}
											onblur={() => commitHex('bgColor', '')}
										/>
										{#if design.bgColor.trim()}
											<button
												class="btn-icon sm"
												onclick={() => (design.bgColor = '')}
												title="Restablecer al color del tema"
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

							<!-- Fondo inmersivo -->
							<section class="props-section">
								<h3 class="props-title"><span class="sec-num">03</span> Fondo inmersivo</h3>
								<div class="prop-col">
									<label class="prop-row" for="bg-image-url">
										<span>Imagen de fondo</span>
										{#if design.bgImageUrl.trim() && !bgUrlInvalid}
											<span class="prop-value ok">Cargada ✓</span>
										{/if}
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
											Solo se permiten rutas locales (/uploads/…). Sube un archivo válido.
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
										<span>Sube una imagen de fondo (JPG, PNG, WebP, GIF)</span>
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

							<!-- Física del cristal -->
							<section class="props-section">
								<h3 class="props-title"><span class="sec-num">04</span> Física del cristal</h3>
								<div class="prop-col">
									<div class="prop-row" id="glass-blur-label">
										<span>Difuminado de paneles</span>
										<span class="prop-value">{design.glassBlur}px</span>
									</div>
									<FancySlider
										id="glass-blur"
										min={0}
										max={40}
										step={1}
										bind:value={design.glassBlur}
										aria-labelledby="glass-blur-label"
										label="Intensidad de difuminado del cristal"
									/>
								</div>
								<div class="prop-col mt-3">
									<div class="prop-row" id="glass-opacity-label">
										<span>Opacidad de superficie</span>
										<span class="prop-value">{Math.round(design.glassOpacity * 100)}%</span>
									</div>
									<FancySlider
										id="glass-opacity"
										min={0.2}
										max={1}
										step={0.05}
										bind:value={design.glassOpacity}
										aria-labelledby="glass-opacity-label"
										label="Opacidad de los paneles de vidrio"
									/>
									<p class="hint">
										Controla la transparencia de las tarjetas de cristal sobre tu fondo.
									</p>
								</div>
							</section>

							<!-- Tipografía -->
							<section class="props-section">
								<h3 class="props-title"><span class="sec-num">05</span> Tipografía del perfil</h3>
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
										<span>Sube una fuente personalizada (.woff2, .woff, .ttf, .otf)</span>
									</div>
									{#if design.customFontUrl}
										<label class="prop-row mt-2" for="font-family-name">
											<span>Nombre de la tipografía</span>
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
											class="btn-icon-text sm danger mt-2"
											onclick={() => {
												design.customFontUrl = '';
											}}
											title="Quitar fuente personalizada"
										>
											<span class="material-icons-round">delete</span>
											<span>Quitar fuente</span>
										</button>
									{/if}
								</div>
							</section>

							<!-- Avanzado -->
							<section class="props-section">
								<h3 class="props-title"><span class="sec-num">06</span> Opciones avanzadas</h3>
								<div class="flex-col-center">
									<button
										class="btn-advanced"
										onclick={() => {
											localCss = design.customCss || '';
											showCssModal = true;
										}}
									>
										<span class="material-icons-round">code</span>
										<span>Modo avanzado (CSS)</span>
										{#if (design.customCss || '').trim()}<span class="mini-badge">activo</span>{/if}
									</button>
									<button type="button" class="factory-link" onclick={factoryReset}>
										<span class="material-icons-round">restart_alt</span>
										Restaurar diseño por defecto
									</button>
								</div>
							</section>
						{:else if activeTab === 'blocks'}
							<!-- Bloques -->
							<section class="props-section">
								<h3 class="props-title">Estructura de Bloques</h3>
								<p class="hint mb-4">
									Arrastra desde el asa para reordenar, usa las flechas táctiles y activa o edita el
									contenido de cada bloque.
								</p>

								{#if !design.blocks.length && !loading}
									<p class="empty-note">No hay bloques agregados todavía. Añade uno abajo.</p>
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
													aria-label="Arrastrar para reordenar bloque {block.type}"
													onpointerdown={(e) => dragStart(i, e)}
												>
													<span class="material-icons-round">drag_indicator</span>
												</button>

												<span class="block-icon material-icons-round" aria-hidden="true">
													{BLOCK_CATALOG.find((c) => c.type === block.type)?.icon ?? 'widgets'}
												</span>

												<div class="block-title-col truncate">
													<span class="block-label">
														{block.type === 'bio'
															? 'Texto / Biografía'
															: block.type === 'links'
																? 'Enlaces'
																: block.type === 'feed'
																	? 'Publicaciones'
																	: 'Galería de fotos'}
													</span>
													<span class="block-status-sub">
														{block.enabled ? 'Visible en perfil' : 'Oculto'}
													</span>
												</div>

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
														<label class="editor-caption" for="block-content-{i}">
															Texto para tu perfil
														</label>
														<textarea
															id="block-content-{i}"
															name="block-content-{i}"
															bind:value={block.content}
															rows="3"
															maxlength={DESIGN_LIMITS.BLOCK_CONTENT_MAX}
															placeholder="Escribe algo sobre ti o tus proyectos…"
														></textarea>
													{:else}
														<span class="editor-caption">Lista de enlaces (con https://)</span>
														{#each block.links ?? [] as link, li (li)}
															<div class="link-row">
																<input
																	id="link-title-{i}-{li}"
																	name="link-title-{i}-{li}"
																	type="text"
																	class="link-title-inp"
																	placeholder="Título"
																	bind:value={link.title}
																	maxlength={DESIGN_LIMITS.LINK_TITLE_MAX}
																/>
																<input
																	id="link-url-{i}-{li}"
																	name="link-url-{i}-{li}"
																	type="url"
																	class="link-url-inp"
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
															<span class="material-icons-round">add</span>
															<span>Añadir enlace</span>
														</button>
													{/if}
												</div>
											{:else if block.enabled}
												<p class="auto-note">
													Este bloque se alimenta dinámicamente con tu actividad en Voom!.
												</p>
											{/if}
										</article>
									{/each}
								</div>

								<h3 class="props-title mt-6">Añadir nuevo bloque</h3>
								<div class="add-grid">
									{#each BLOCK_CATALOG as cat (cat.type)}
										{@const single = !cat.dynamic && countBlocksOfType(cat.type) > 0}
										<button
											class="add-tile"
											onclick={() => addBlock(cat.type)}
											disabled={single || design.blocks.length >= DESIGN_LIMITS.BLOCKS_MAX}
											title={single ? 'Ya existe en tu perfil (elemento único)' : ''}
										>
											<span class="material-icons-round">{cat.icon}</span>
											<span>{cat.label}</span>
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
					title="Abrir panel de edición"
				>
					<span class="material-icons-round">tune</span>
				</button>
			{/if}
		</div>

		<!-- ── ÁMBITO 2: APLICACIÓN (Ajustes de Interfaz + Live Preview Stage) ── -->
		<div
			class="hub-pane hub-pane-app"
			class:is-active={hubTab === 'app'}
			aria-hidden={hubTab !== 'app'}
		>
			<main class="app-pane-area">
				<div class="app-studio-grid">
					<!-- Columna 1: Panel de controles -->
					<div class="app-controls-card">
						<header class="app-pane-head">
							<div class="app-pane-badge">
								<span class="material-icons-round">palette</span>
								<span>Estilo Global</span>
							</div>
							<h2>Apariencia de la Aplicación</h2>
							<p>
								Personaliza el acento, la escala de texto, la densidad y el wallpaper en toda la
								interfaz. Se sincronizan en vivo y se guardan automáticamente en tu cuenta.
							</p>
						</header>

						<div class="app-section-layer layer-presets-accent">
							<section class="props-section app-accent-section">
								<h3 class="props-title"><span class="sec-num">01</span> Presets Frutiger Aero</h3>
								<PresetVault />
								<p class="hint">
									1 clic aplica acento, cristal, geometría, brillo, fuente y modo de fondo. Después
									puedes afinar cada detalle abajo.
								</p>

								<div class="section-subdivider" aria-hidden="true"></div>

								<div class="accent-subblock">
									<h4 class="props-subtitle">Color de acento primario</h4>
									<AccentPicker />
								</div>
							</section>
						</div>

						<div class="app-section-layer layer-surface">
							<section class="props-section app-accent-section">
								<h3 class="props-title">
									<span class="sec-num">02</span> Superficies y Cristal Aero
								</h3>
								<SurfacePanel />
							</section>
						</div>

						<div class="app-section-layer layer-typo">
							<TypographyDensityPanel onGoToProfileTab={goToProfileTab} />
						</div>

						<div class="app-section-layer layer-wallpaper">
							<WallpaperPicker />
						</div>

						{#if appearanceStore.syncStatus === 'saved'}
							<p class="app-saved-note" transition:fade={{ duration: 150 }}>
								<span class="material-icons-round">cloud_done</span>
								Configuración sincronizada con tu cuenta
							</p>
						{:else if appearanceStore.syncStatus === 'error'}
							<p class="app-saved-note error" transition:fade={{ duration: 150 }}>
								<span class="material-icons-round">cloud_off</span>
								No se pudo sincronizar con la cuenta. Revisa tu conexión.
							</p>
						{/if}
					</div>

					<!-- Columna 2: Stage de previsualización en vivo -->
					<div class="app-preview-column">
						<AppPreviewStage />
					</div>
				</div>
			</main>
		</div>
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
					<strong>Ámbito seguro automático:</strong> todas tus reglas se aplican únicamente dentro de
					tu perfil. El servidor añade automáticamente el selector raíz por ti.
				</p>
				<p>Ejemplo:</p>
				<pre>.glass-card {'{'} border-radius: 20px; box-shadow: 0 8px 24px rgba(27, 133, 243, 0.3); {'}'}</pre>
				<ul>
					<li>Sin recursos externos (<code>@import</code> o URLs externas bloqueadas).</li>
					<li>Límite de {DESIGN_LIMITS.CUSTOM_CSS_MAX} caracteres.</li>
					<li>
						<code>position: fixed</code> se transforma automáticamente en <code>absolute</code>.
					</li>
				</ul>
			</div>

			<div class="css-snippets-row">
				<SnippetGallery getTextarea={getCcssTextarea} onInsert={(v) => (localCss = v)} />
			</div>

			{#if cssLint.length}
				<div class="css-lint" role="status">
					<span class="material-icons-round">info</span>
					<ul>
						{#each cssLint as warning, i (i)}
							<li>{warning}</li>
						{/each}
					</ul>
				</div>
			{/if}

			<textarea
				class="code-editor"
				bind:this={customCssTextarea}
				bind:value={localCss}
				spellcheck="false"
				placeholder="/* Escribe tus reglas CSS aquí */"
				aria-label="Editor de CSS personalizado"
			></textarea>
			<p class="char-count" class:over={localCssTooLong}>
				{localCssCharCount} / {DESIGN_LIMITS.CUSTOM_CSS_MAX}
			</p>

			<footer class="flex justify-end gap-2 mt-3">
				<button type="button" class="btn-aero-secondary" onclick={() => (showCssModal = false)}>
					Cancelar
				</button>
				<button
					type="button"
					class="btn-aero-primary"
					onclick={() => {
						design.customCss = localCss;
						showCssModal = false;
					}}
					disabled={localCssTooLong}
				>
					{localCssTooLong ? 'CSS demasiado largo' : 'Aplicar al lienzo'}
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
		height: 100vh !important;
		max-height: 100vh !important;
		overflow: hidden !important;
	}

	/* ═══ Layout general ═══ */
	.designer-canvas {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100vh;
		max-height: 100vh;
		min-height: 0;
		margin: 0;
		padding: 0;
		overflow: hidden;
		font-size: 16px;
		line-height: 1.5;
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

	:global(html[data-wallpaper='true'] .designer-canvas) {
		background-color: transparent !important;
	}
	:global(html[data-wallpaper='true'] .aero-bg-wrapper) {
		opacity: 0.18 !important;
	}

	/* ── Chrome unificado (Header principal anclado al tope con centrado geométrico) ── */
	.editor-chrome {
		position: relative;
		top: 0;
		left: 0;
		right: 0;
		z-index: 120;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		height: 58px;
		min-height: 58px;
		flex-shrink: 0;
		padding: 0 20px;
		border-bottom: 1px solid var(--border-subtle);
		background: color-mix(in srgb, var(--bg-surface-solid, var(--bg-surface)) 94%, transparent);
		backdrop-filter: var(--glass-blur, blur(16px) saturate(1.2));
		-webkit-backdrop-filter: var(--glass-blur, blur(16px) saturate(1.2));
		border-radius: 0;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
	}

	.chrome-left {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
		justify-self: start;
	}

	.chrome-title {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
		min-width: 0;
	}
	.chrome-title h1 {
		margin: 0;
		font-size: 0.96rem;
		font-weight: 800;
		color: var(--text-main);
		letter-spacing: -0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.user-meta-sub {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.72rem;
		color: var(--text-muted);
	}
	.view-profile-link {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		color: var(--accent-blue-base, var(--aero-blue));
		text-decoration: none;
		font-weight: 650;
		transition: color 0.15s ease;
	}
	.view-profile-link:hover {
		color: var(--accent-blue-light, var(--aero-sky));
		text-decoration: underline;
	}
	.view-profile-link .material-icons-round {
		font-size: 11px;
	}

	.chrome-center {
		display: flex;
		align-items: center;
		justify-content: center;
		justify-self: center;
	}

	/* Toggle de Hub Central */
	.hub-toggle {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 4px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--bg-surface) 80%, transparent);
		border: 1px solid var(--border-subtle);
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15);
	}
	.hub-toggle [role='tab'] {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 18px;
		border: none;
		background: transparent;
		color: var(--text-muted);
		font-size: 0.82rem;
		font-weight: 750;
		border-radius: 999px;
		cursor: pointer;
		transition:
			color 0.2s ease,
			background 0.2s ease,
			transform 0.24s var(--ease-spring),
			box-shadow 0.24s ease;
	}
	.hub-toggle [role='tab']:hover:not(.active) {
		color: var(--text-main);
		background: var(--bg-surface-hover);
	}
	.hub-toggle [role='tab'].active {
		background: linear-gradient(
			135deg,
			var(--accent-blue-base, var(--aero-blue)),
			var(--accent-blue-light, var(--aero-sky))
		);
		color: #ffffff;
		box-shadow:
			0 4px 14px color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 45%, transparent),
			inset 0 1px 0 rgba(255, 255, 255, 0.45);
		transform: translateY(-1px) scale(1.02);
	}
	.hub-tab-icon {
		font-size: 16px;
	}
	.hub-dirty-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #ffd76a;
		box-shadow: 0 0 6px #ffd76a;
	}

	.chrome-actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
		justify-self: end;
	}

	.chrome-divider {
		width: 1px;
		height: 22px;
		background: var(--border-subtle);
		margin: 0 4px;
		flex-shrink: 0;
	}

	.chrome-theme-selector {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.device-toggle {
		display: inline-flex;
		gap: 3px;
		padding: 3px;
		border-radius: 999px;
		background: var(--bg-input);
		border: 1px solid var(--border-subtle);
	}
	.device-toggle button {
		width: 34px;
		height: 28px;
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
		gap: 7px;
		font-size: 0.74rem;
		font-weight: 700;
		color: var(--amber-warm, #d97706);
		background: color-mix(in srgb, var(--amber-warm, #d97706) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--amber-warm, #d97706) 35%, transparent);
		border-radius: 999px;
		padding: 5px 12px;
	}
	.dirty-dot {
		width: 7px;
		height: 7px;
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

	.app-sync-chip {
		color: var(--aero-mint, #00d4aa);
		background: color-mix(in srgb, var(--aero-mint, #00d4aa) 12%, transparent);
		border-color: color-mix(in srgb, var(--aero-mint, #00d4aa) 35%, transparent);
		transition: all 0.2s ease;
	}
	.app-sync-chip.status-saving {
		color: var(--aero-amber, #f5a623);
		background: color-mix(in srgb, var(--aero-amber, #f5a623) 12%, transparent);
		border-color: color-mix(in srgb, var(--aero-amber, #f5a623) 35%, transparent);
	}
	.app-sync-chip.status-saved {
		color: var(--aero-mint, #00d4aa);
		background: color-mix(in srgb, var(--aero-mint, #00d4aa) 12%, transparent);
		border-color: color-mix(in srgb, var(--aero-mint, #00d4aa) 35%, transparent);
	}
	.app-sync-chip.status-error {
		color: var(--aero-rose, #ec4899);
		background: color-mix(in srgb, var(--aero-rose, #ec4899) 12%, transparent);
		border-color: color-mix(in srgb, var(--aero-rose, #ec4899) 35%, transparent);
	}

	.btn-discard-chrome {
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-size: 0.78rem;
		font-weight: 650;
		cursor: pointer;
		padding: 6px 8px;
		transition: color 0.15s ease;
	}
	.btn-discard-chrome:hover {
		color: var(--aero-rose, #ec4899);
	}

	.btn-icon-text {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 6px 12px;
		border-radius: 999px;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		color: var(--text-muted);
		font-size: 0.76rem;
		font-weight: 650;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.btn-icon-text:hover {
		color: var(--text-main);
		background: var(--bg-surface-hover);
		border-color: var(--accent-blue-base, var(--aero-blue));
	}
	.btn-icon-text.danger {
		color: var(--aero-rose, #ec4899);
	}
	.btn-icon-text.danger:hover {
		background: color-mix(in srgb, var(--aero-rose, #ec4899) 10%, transparent);
		border-color: var(--aero-rose, #ec4899);
	}
	.btn-icon-text .material-icons-round {
		font-size: 15px;
	}

	.btn-save {
		padding: 8px 18px;
		font-size: 0.84rem;
		font-weight: 800;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		gap: 7px;
		white-space: nowrap;
		cursor: pointer;
		transition:
			background 0.2s ease,
			transform 0.15s var(--ease-spring),
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
	.btn-save .material-icons-round {
		font-size: 16px;
	}

	/* ═══ Cuerpo del editor ═══ */
	.editor-body {
		flex: 1 1 0%;
		display: flex;
		align-items: stretch;
		min-height: 0;
		height: auto;
		overflow: hidden;
		position: relative;
	}

	/* Paneles en capas con transición suave y física fluida */
	.hub-pane {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
		transform: scale(0.985) translateY(8px);
		transition:
			opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1),
			transform 0.34s cubic-bezier(0.34, 1.25, 0.64, 1),
			visibility 0.28s ease;
		will-change: opacity, transform;
	}
	.hub-pane.is-active {
		opacity: 1;
		visibility: visible;
		pointer-events: auto;
		transform: scale(1) translateY(0);
	}

	.hub-pane-profile {
		display: flex;
		flex-direction: row;
		align-items: stretch;
	}

	.hub-pane-app {
		display: flex;
		flex-direction: column;
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

	.preview-viewport {
		width: 100%;
		max-width: 840px;
		margin: 0 auto;
		border-radius: var(--radius-lg, 22px);
		transition:
			max-width 0.35s cubic-bezier(0.34, 1.3, 0.64, 1),
			box-shadow 0.3s ease,
			border-radius 0.3s ease;
		box-shadow:
			0 16px 44px rgba(0, 0, 0, 0.28),
			0 2px 8px rgba(0, 0, 0, 0.1);
		overflow: hidden;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		position: relative;
	}
	.preview-viewport.is-mobile {
		max-width: 420px;
		border-radius: 36px;
		border: 6px solid color-mix(in srgb, var(--text-main) 16%, var(--bg-surface));
		box-shadow:
			0 24px 56px rgba(0, 0, 0, 0.42),
			0 0 0 1px var(--border-subtle);
		padding-top: 14px;
	}

	/* Ajuste de estadísticas dentro del viewport para evitar desbordes */
	.preview-viewport :global(.profile-stats-bar) {
		flex-wrap: wrap;
	}
	.preview-viewport.is-mobile :global(.profile-stats-bar) {
		margin: 8px 12px 0 12px;
		padding: 8px 4px;
		gap: 6px;
		justify-content: space-around;
	}
	.preview-viewport.is-mobile :global(.profile-stats-bar .stat-col) {
		gap: 4px;
		font-size: 0.78rem;
	}

	.mobile-speaker-bar {
		position: absolute;
		top: 6px;
		left: 50%;
		transform: translateX(-50%);
		width: 46px;
		height: 4px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--text-main) 28%, transparent);
		z-index: 50;
		pointer-events: none;
	}

	/* Mockup de ventana en escritorio */
	.desktop-mockup-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 9px 16px;
		border-bottom: 1px solid var(--border-subtle);
		background: color-mix(in srgb, var(--bg-surface) 90%, transparent);
		backdrop-filter: blur(10px);
		gap: 12px;
	}
	.mockup-dots {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.mockup-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
	}
	.mockup-dot.red {
		background: #ff5f56;
	}
	.mockup-dot.yellow {
		background: #ffbd2e;
	}
	.mockup-dot.green {
		background: #27c93f;
	}

	.mockup-address {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 14px;
		background: var(--bg-input, rgba(0, 0, 0, 0.12));
		border: 1px solid var(--border-subtle);
		border-radius: 999px;
		font-size: 0.72rem;
		font-family: var(--font-mono, monospace);
		color: var(--text-muted);
		max-width: 260px;
		flex: 1;
		justify-content: center;
	}
	.mockup-address .lock-ico {
		font-size: 11px;
		color: var(--aero-mint, #00d4aa);
	}
	.mockup-badge {
		font-size: 0.68rem;
		font-weight: 750;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
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

	.preview-profile-container {
		max-width: 840px;
		margin: 0 auto;
		padding: 24px 18px 56px;
	}

	/* ═══ Estudio de Aplicación (Layout 2 Columnas) ═══ */
	.app-pane-area {
		flex: 1 1 0%;
		width: 100%;
		height: 100%;
		min-height: 0;
		padding: 24px;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: thin;
		scrollbar-color: var(--scrollbar-thumb) transparent;
	}
	.app-studio-grid {
		display: grid;
		grid-template-columns: minmax(360px, 540px) minmax(320px, 480px);
		gap: 28px;
		max-width: 1140px;
		margin: 0 auto;
		width: 100%;
		align-items: flex-start;
	}

	.app-controls-card {
		border-radius: var(--radius-lg, 22px);
		padding: 26px 28px 36px;
		border: 1px solid var(--border-subtle);
		display: flex;
		flex-direction: column;
		gap: 24px;
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur, blur(14px) saturate(1.2));
		-webkit-backdrop-filter: var(--glass-blur, blur(14px) saturate(1.2));
		position: relative;
		overflow: visible !important;
	}

	.app-section-layer {
		position: relative;
		width: 100%;
	}
	.app-section-layer.layer-presets-accent {
		z-index: 10;
	}
	.app-section-layer.layer-surface {
		z-index: 20;
	}
	.app-section-layer.layer-typo {
		z-index: 50;
	}
	.app-section-layer.layer-wallpaper {
		z-index: 10;
	}

	.section-subdivider {
		height: 1px;
		width: 100%;
		background: var(--border-subtle);
		margin: 16px 0 14px;
	}
	.accent-subblock {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.props-subtitle {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-main);
	}

	.app-preview-column {
		position: sticky;
		top: 16px;
	}

	.app-pane-head {
		display: flex;
		flex-direction: column;
		gap: 6px;
		border-bottom: 1px solid var(--border-subtle);
		padding-bottom: 18px;
	}
	.app-pane-badge {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--accent-blue-base, var(--aero-blue));
	}
	.app-pane-badge .material-icons-round {
		font-size: 14px;
	}
	.app-pane-head h2 {
		margin: 0;
		font-size: 1.2rem;
		font-weight: 800;
		font-family: var(--font-display);
		color: var(--text-main);
		letter-spacing: -0.01em;
	}
	.app-pane-head p {
		margin: 0;
		font-size: 0.84rem;
		line-height: 1.55;
		color: var(--text-secondary);
	}

	.app-saved-note {
		display: flex;
		align-items: center;
		gap: 7px;
		margin: 8px 0 0;
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--aero-mint, #00d4aa);
	}
	.app-saved-note.error {
		color: var(--aero-rose, #ec4899);
	}
	.app-saved-note .material-icons-round {
		font-size: 17px;
	}

	/* ═══ Panel lateral de propiedades (Perfil) ═══ */
	.props-panel {
		width: 410px;
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

	.mobile-sheet-handle-bar {
		display: none;
	}

	.panel-tabs {
		display: flex;
		flex-shrink: 0;
		border-bottom: 1px solid var(--border-subtle);
		background: color-mix(in srgb, var(--text-main) 3%, transparent);
	}
	.panel-tabs button {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		padding: 14px 0;
		font-size: 0.85rem;
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
	.panel-tabs .tab-ico {
		font-size: 16px;
	}

	.panel-close-btn {
		flex: 0 0 44px !important;
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
	.mobile-close-ico {
		display: none;
	}

	.panel-content {
		flex: 1;
		overflow-y: auto;
		padding: 20px 22px 32px;
		scrollbar-width: thin;
		scrollbar-color: var(--scrollbar-thumb) transparent;
		min-height: 0;
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
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.74rem;
		text-transform: uppercase;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		margin: 0 0 12px;
	}

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

	.prop-col {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.prop-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.86rem;
		font-weight: 650;
		color: var(--text-main);
		margin: 0;
	}
	.prop-value {
		font-family: var(--font-mono, monospace);
		font-size: 0.76rem;
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

	.hex-field {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.hex-chip-wrap {
		position: relative;
		width: 38px;
		height: 34px;
		flex-shrink: 0;
		cursor: pointer;
		border-radius: var(--radius-xs, 8px);
		display: inline-flex;
		transition: transform 0.15s var(--ease-spring);
	}
	.hex-chip-wrap:hover {
		transform: scale(1.08);
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
		width: 38px;
		height: 34px;
		border-radius: var(--radius-xs, 8px);
		flex-shrink: 0;
		border: 1px solid var(--border-subtle);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.hex-chip .chip-icon {
		font-size: 15px;
		color: white;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
		opacity: 0.85;
	}
	.hex-chip.theme-fallback::after {
		content: 'tema';
		display: block;
		font-size: 0.55rem;
		text-align: center;
		line-height: 32px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.hex-chip.active::after {
		content: none;
	}
	.hex-chip.invalid {
		border-color: var(--aero-rose, #e84a72);
	}

	.hex-input,
	.text-input {
		background: var(--bg-input, var(--bg-surface));
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xs, 8px);
		padding: 8px 12px;
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
	.hex-input.invalid,
	.text-input.invalid {
		border-color: var(--aero-rose, #e84a72);
	}

	.swatches {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.swatch {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		transition:
			transform 0.15s var(--ease-spring),
			border-color 0.15s ease;
	}
	.swatch:hover {
		transform: scale(1.15);
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
		gap: 6px;
		padding: 10px 8px 8px;
		border-radius: var(--radius-sm, 12px);
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
		color: var(--text-main);
		font-size: 0.76rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.18s var(--ease-spring);
	}
	.preset-card:hover {
		transform: translateY(-2px);
		border-color: var(--accent-blue-base, var(--aero-blue));
		box-shadow: var(--shadow-sm);
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
	.preset-swatch {
		width: 100%;
		height: 32px;
		border-radius: var(--radius-xs, 8px);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.active-check {
		font-size: 16px;
		color: white;
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
	}
	.preset-icon {
		font-size: 16px;
		color: var(--accent-blue-base, var(--aero-blue));
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
		border-radius: var(--radius-xs, 8px);
		border: 1px solid var(--border-subtle);
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

	.open-panel-fab {
		position: fixed;
		right: 24px;
		bottom: 90px;
		width: 52px;
		height: 52px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--accent-blue-base, var(--aero-blue));
		font-size: 24px;
		cursor: pointer;
		z-index: 106;
		box-shadow: var(--shadow-lg);
		border: 1px solid var(--border-subtle);
		background: var(--bg-surface);
	}
	.open-panel-fab:hover {
		transform: scale(1.08);
	}

	/* ═══ Bloques ═══ */
	.blocks-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.block-card {
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm, 12px);
		background: var(--bg-surface);
		padding: 12px 14px;
		opacity: 0.65;
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
		font-size: 20px;
		color: var(--text-muted);
	}
	.block-card.active .block-icon {
		color: var(--accent-blue-base, var(--aero-blue));
	}
	.block-title-col {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.block-label {
		font-size: 0.86rem;
		font-weight: 750;
		color: var(--text-main);
	}
	.block-status-sub {
		font-size: 0.68rem;
		color: var(--text-muted);
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
	}
	.arrow-btn {
		border: none;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		padding: 1px 4px;
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
		font-size: 0.74rem;
		color: var(--text-muted);
		font-weight: 700;
	}
	.block-editor textarea {
		width: 100%;
		min-height: 84px;
		background: var(--bg-input, var(--bg-surface));
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xs, 8px);
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
		display: grid;
		grid-template-columns: 100px 1fr 30px;
		align-items: center;
		gap: 8px;
	}
	.link-row input {
		background: var(--bg-input, var(--bg-surface));
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-xs, 8px);
		padding: 7px 9px;
		font-size: 0.8rem;
		color: var(--text-main);
		min-width: 0;
	}
	.link-row input:focus {
		outline: none;
		border-color: var(--accent-blue-base, var(--aero-blue));
	}
	.add-link-btn {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		background: transparent;
		border: 1px dashed var(--border-subtle);
		color: var(--accent-blue-base, var(--aero-blue));
		border-radius: 999px;
		padding: 6px 14px;
		font-size: 0.76rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.add-link-btn:hover {
		background: color-mix(in srgb, var(--accent-blue-base, var(--aero-blue)) 10%, transparent);
	}
	.add-link-btn .material-icons-round {
		font-size: 15px;
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

	.hint {
		font-size: 0.76rem;
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
	.flex {
		display: flex;
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

	.css-lint {
		display: flex;
		gap: 8px;
		align-items: flex-start;
		margin-top: 10px;
		padding: 10px 12px;
		border-radius: var(--radius-sm, 10px);
		border: 1px solid color-mix(in srgb, var(--aero-amber, #f5a623) 40%, transparent);
		background: color-mix(in srgb, var(--aero-amber, #f5a623) 8%, transparent);
	}
	.css-lint .material-icons-round {
		font-size: 16px;
		color: var(--aero-amber, #f5a623);
		margin-top: 1px;
	}
	.css-lint ul {
		margin: 0;
		padding-left: 14px;
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--text-secondary);
	}

	/* ═══ Responsive: pantallas medianas (laptops con sidebar expandida) ═══ */
	@media (max-width: 1150px) {
		.editor-chrome {
			padding: 0 14px;
		}
		.chrome-title h1 {
			font-size: 0.9rem;
		}
		.user-meta-sub {
			font-size: 0.68rem;
		}
		.btn-save {
			padding: 7px 12px;
			font-size: 0.8rem;
		}
	}

	/* ═══ Responsive: móvil y pantallas pequeñas ═══ */
	@media (max-width: 900px) {
		.designer-canvas {
			height: 100svh;
			min-height: 100svh;
		}

		.editor-chrome {
			padding: 8px 14px;
			gap: 8px;
			display: flex;
			flex-wrap: wrap;
			height: auto;
			min-height: 56px;
		}

		.chrome-left {
			gap: 8px;
		}
		.chrome-title h1 {
			font-size: 0.88rem;
		}
		.user-meta-sub {
			display: none;
		}

		.chrome-center {
			order: 3;
			width: 100%;
			justify-content: center;
			padding-bottom: 4px;
		}
		.hub-toggle [role='tab'] {
			padding: 5px 12px;
			font-size: 0.76rem;
		}

		.chrome-actions {
			gap: 6px;
		}
		.desktop-only-toggle {
			display: none !important;
		}
		.btn-text-label {
			display: none;
		}

		.editor-body {
			flex-direction: column;
			height: auto;
			min-height: 0;
			flex: 1 1 0%;
		}

		.hub-pane-profile {
			flex-direction: column;
		}

		/* Studio de Aplicación en móvil */
		.app-pane-area {
			padding: 12px;
		}
		.app-studio-grid {
			grid-template-columns: 1fr;
			gap: 16px;
		}
		.app-controls-card {
			padding: 18px 16px 24px;
		}
		.app-preview-column {
			position: static;
		}

		.preview-scroll {
			padding: 10px 10px 240px;
		}

		/* Bottom sheet móvil */
		.mobile-sheet-handle-bar {
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 8px 0 4px;
			cursor: pointer;
		}
		.sheet-drag-pill {
			width: 36px;
			height: 4px;
			border-radius: 999px;
			background: color-mix(in srgb, var(--text-main) 25%, transparent);
		}

		.props-panel {
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			top: auto;
			width: 100%;
			height: 60vh;
			max-height: 60vh;
			border-left: none;
			border-top: 1px solid var(--border-subtle);
			border-radius: 20px 20px 0 0;
			box-shadow:
				0 -8px 32px rgba(var(--accent-blue-rgb), 0.18),
				var(--shadow-glow);
			z-index: 140;
		}

		.desktop-close-ico {
			display: none;
		}
		.mobile-close-ico {
			display: inline-block;
			font-size: 22px;
		}

		.panel-content {
			padding: 14px 16px 36px;
		}

		.open-panel-fab {
			bottom: 24px;
			right: 18px;
		}
	}
</style>
