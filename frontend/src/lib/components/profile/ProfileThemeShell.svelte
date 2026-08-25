<script>
	/**
	 * ProfileThemeShell — fuente única de verdad visual de la personalización
	 * de perfil. Lo consumen TANTO el perfil público (/u/[username]) como el
	 * lienzo del editor (/settings/design), garantizando paridad WYSIWYG.
	 *
	 * Responsabilidades:
	 *  - Aplicar las variables CSS del usuario (--bg-main, --accent-blue-base,
	 *    --accent-blue-rgb, --glass-blur, --glass-opacity, fuentes).
	 *  - Contraste automático (force-light / force-dark por luminancia).
	 *  - Inyección SEGURA de @font-face y del CSS custom: los valores se
	 *    re-sanitizan en render (neutraliza filas legacy maliciosas) y se
	 *    escapan antes de interpolarlos en strings CSS.
	 *  - Contención anti-overlay: `position: relative` ancla los overlays al
	 *    wrapper y `isolation: isolate` impide que NADA estilizado por el
	 *    usuario pinte por encima del chrome global (TopBar, modales, nav).
	 *    Deliberadamente SIN contain:paint (crearía containing block para
	 *    position:fixed y rompería modales no portados dentro del perfil).
	 */
	import { sanitizeCss, isSafeCssUrl } from '$lib/design/sanitize.js';

	let { customization = null, variant = 'page', children } = $props();

	const c = $derived(customization ?? {});

	/* ── Helpers de color/texto ─────────────────────────────────────────── */

	function hexToRgb(hex) {
		if (!hex) return null;
		let h = hex.replace('#', '');
		if (h.length === 3)
			h = h
				.split('')
				.map((x) => x + x)
				.join('');
		if (!/^[0-9a-f]{6}$/i.test(h)) return null;
		return {
			r: parseInt(h.slice(0, 2), 16),
			g: parseInt(h.slice(2, 4), 16),
			b: parseInt(h.slice(4, 6), 16)
		};
	}

	function getLuminance(hex) {
		const rgb = hexToRgb(hex);
		if (!rgb) return 0;
		return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
	}

	/** Escapa texto para interpolarse DENTRO de un valor/identificador CSS. */
	function cssSafeText(value) {
		return String(value ?? '')
			.replace(/[\\'"<>{}();]/g, '')
			.trim();
	}

	/* ── Derivados del customization ────────────────────────────────────── */

	let safeCustomCss = $derived(sanitizeCss(typeof c.custom_css === 'string' ? c.custom_css : ''));

	let fontFamilySafe = $derived(cssSafeText(c.font_family));
	let fontUrlSafe = $derived(
		isSafeCssUrl(String(c.custom_font_url ?? '')) ? String(c.custom_font_url).trim() : ''
	);
	let hasCustomFont = $derived(!!(fontFamilySafe && fontUrlSafe));

	let bgImageUrlSafe = $derived(
		isSafeCssUrl(String(c.bg_image_url ?? '')) ? String(c.bg_image_url).trim() : ''
	);

	let primaryColor = $derived(
		/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c.primary_color ?? '') ? c.primary_color : ''
	);
	let primaryRgb = $derived.by(() => {
		const rgb = hexToRgb(primaryColor);
		return rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '';
	});

	let bgColor = $derived(/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c.bg_color ?? '') ? c.bg_color : '');

	let glassBlur = $derived(
		Number.isFinite(Number(c.glass_blur)) ? Math.min(40, Math.max(0, Number(c.glass_blur))) : ''
	);
	let glassOpacity = $derived(
		Number.isFinite(Number(c.glass_opacity))
			? Math.min(1, Math.max(0.2, Number(c.glass_opacity)))
			: null
	);

	let hasCustomBg = $derived(!!(bgColor || bgImageUrlSafe));
	let isLightBg = $derived(bgImageUrlSafe ? false : bgColor ? getLuminance(bgColor) > 150 : false);

	let wrapperClass = $derived(
		[
			'profile-custom-wrapper',
			variant === 'preview' ? 'is-preview' : '',
			hasCustomBg ? (isLightBg ? 'force-light' : 'force-dark') : '',
			bgImageUrlSafe ? 'has-bg-image' : '',
			glassOpacity != null ? 'has-glass-opacity' : ''
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<svelte:head>
	{#if hasCustomFont}
		{@html `<style>@font-face{font-family:'${fontFamilySafe}';src:url('${fontUrlSafe}');font-display:swap;}</style>`}
	{/if}
	{#if safeCustomCss}
		<!-- Contenido ya re-sanitizado por sanitize.css (scoped a .profile-custom-wrapper) -->
		{@html `<style>${safeCustomCss}</style>`}
	{/if}
</svelte:head>

<div
	class={wrapperClass}
	style:--bg-main={bgColor || undefined}
	style:--accent-blue-base={primaryColor || undefined}
	style:--accent-blue-rgb={primaryRgb || undefined}
	style:--glass-blur={glassBlur !== '' ? `blur(${glassBlur}px) saturate(1.2)` : undefined}
	style:--glass-opacity={glassOpacity ?? undefined}
	style:--font-sans={hasCustomFont ? `'${fontFamilySafe}', sans-serif` : undefined}
	style:--font-display={hasCustomFont ? `'${fontFamilySafe}', sans-serif` : undefined}
	style:--profile-bg={bgImageUrlSafe ? `url('${bgImageUrlSafe}')` : undefined}
>
	{@render children()}
</div>

<style>
	.profile-custom-wrapper {
		position: relative;
		isolation: isolate;
		background-color: var(--bg-main, transparent);
		min-height: calc(100vh - 70px);
		/* svh: altura estable con la barra de URL del móvil expandida (evita el
		   salto de layout cuando el navegador la colapsa al hacer scroll). */
		min-height: calc(100svh - 58px);
		transition: background-color 0.3s ease;
	}

	.profile-custom-wrapper.is-preview {
		position: relative;
		min-height: 100%;
		width: 100%;
	}

	.profile-custom-wrapper.has-bg-image {
		background-image: var(--profile-bg);
		background-position: center center;
		background-size: cover;
		background-repeat: no-repeat;
		background-attachment: fixed;
	}

	.profile-custom-wrapper.is-preview.has-bg-image {
		background-attachment: scroll;
		background-position: center top;
	}

	@media (max-width: 768px) {
		/* En móvil background-attachment: fixed escala la imagen contra el alto
		   total de la página (Android) o la deja estática (iOS), rompiendo el
		   perfil. Con scroll la imagen cubre el contenedor correctamente. */
		.profile-custom-wrapper.has-bg-image {
			background-attachment: scroll;
		}
	}

	.force-dark {
		--text-primary: #ffffff;
		--text-main: #ffffff;
		--text-secondary: rgba(255, 255, 255, 0.7);
		--text-muted: rgba(255, 255, 255, 0.5);
		--border-subtle: rgba(255, 255, 255, 0.15);
		--glass-border: rgba(255, 255, 255, 0.15);
		/* Superficie sólida para la barra de tabs sticky sobre fondos personalizados */
		--bg-surface-solid: #0d1f33;
	}

	.force-light {
		--text-primary: #111111;
		--text-main: #000000;
		--text-secondary: rgba(0, 0, 0, 0.7);
		--text-muted: rgba(0, 0, 0, 0.5);
		--border-subtle: rgba(0, 0, 0, 0.15);
		--glass-border: rgba(0, 0, 0, 0.15);
		--bg-surface-solid: #e8f9f6;
	}

	/* Física del cristal: --glass-opacity vuelve translúcidos SOLO los paneles
	   de vidrio dentro del perfil personalizado (nunca global). Si el navegador
	   no soporta color-mix la declaración cae al background opaco del tema. */
	.profile-custom-wrapper.has-glass-opacity :global(:is(.glass-panel, .glass-card, .aero-glass)) {
		background: color-mix(
			in srgb,
			var(--bg-surface) calc(var(--glass-opacity, 0.8) * 100%),
			transparent
		);
	}
</style>
