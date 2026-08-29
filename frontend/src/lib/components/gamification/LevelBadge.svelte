<script>
	import { scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { goto } from '$app/navigation';
	import { uiStore } from '$lib/stores/ui.svelte.js';

	let { level = 1, size = 'md', showText = false, interactive = true } = $props();

	const popoverId = Symbol('level-badge');
	let showPopup = $derived(uiStore.isPopoverOpen(popoverId));

	const TIER_CONFIG = {
		1: {
			tier: 1,
			name: 'Novato',
			badgeTitle: 'Rango Acero • Novato',
			icon: 'shield',
			minLevel: 1,
			maxLevel: 4,
			color: '#94a3b8',
			desc: 'Rango inicial de membresía. Comienza tu viaje en Voom! interactuando, publicando y ganando tus primeros puntos de XP.'
		},
		2: {
			tier: 2,
			name: 'Explorador',
			badgeTitle: 'Rango Esmeralda • Explorador',
			icon: 'eco',
			minLevel: 5,
			maxLevel: 9,
			color: '#10b981',
			desc: 'Rango Esmeralda para exploradores activos. Desbloqueado al alcanzar el Nivel 5 por tu constante participación en la comunidad.'
		},
		3: {
			tier: 3,
			name: 'Avanzado',
			badgeTitle: 'Rango Zafiro • Avanzado',
			icon: 'bolt',
			minLevel: 10,
			maxLevel: 14,
			color: '#1b85f3',
			desc: 'Rango Zafiro para miembros avanzados. Reconocimiento a usuarios con alto engagement, publicaciones destacadas y comunidad activa.'
		},
		4: {
			tier: 4,
			name: 'Veterano',
			badgeTitle: 'Rango Diamante • Veterano',
			icon: 'diamond',
			minLevel: 15,
			maxLevel: 19,
			color: '#06b6d4',
			desc: 'Rango Diamante Cibernético. Distintivo reservado para los creadores y miembros más consolidados y leales de la plataforma.'
		},
		5: {
			tier: 5,
			name: 'Élite',
			badgeTitle: 'Rango Oro Solar • Élite',
			icon: 'workspace_premium',
			minLevel: 20,
			maxLevel: 29,
			color: '#f59e0b',
			desc: 'Rango Oro Solar Élite. Uno de los mayores honores en Voom! para usuarios pilares con máxima reputación e influencia.'
		},
		6: {
			tier: 6,
			name: 'Mítico',
			badgeTitle: 'Rango Cósmico • Mítico',
			icon: 'auto_awesome',
			minLevel: 30,
			maxLevel: 99,
			color: '#a855f7',
			desc: 'Rango Mítico Supremo. Nivel legendario con aura prismática líquida, máxima notoriedad y beneficios exclusivos en la red.'
		}
	};

	let tier = $derived(getTier(level));
	let tierData = $derived(TIER_CONFIG[tier] || TIER_CONFIG[1]);
	let tooltipText = $derived(
		interactive
			? `Nivel ${level} • ${tierData.name} (Clic para ver detalles)`
			: `Nivel ${level} • ${tierData.name}`
	);

	function getTier(lvl) {
		const num = Number(lvl) || 1;
		if (num >= 30) return 6;
		if (num >= 20) return 5;
		if (num >= 15) return 4;
		if (num >= 10) return 3;
		if (num >= 5) return 2;
		return 1;
	}

	let badgeContainerEl = $state(null);

	function togglePopup(e) {
		if (!interactive) return;
		if (e) {
			e.preventDefault();
			e.stopPropagation();
		}
		uiStore.togglePopover(popoverId);
	}

	function closePopup(e) {
		if (showPopup && badgeContainerEl && !badgeContainerEl.contains(e.target)) {
			uiStore.closePopover(popoverId);
		}
	}

	function handleKeyDown(e) {
		if (!interactive) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			e.stopPropagation();
			togglePopup();
		} else if (e.key === 'Escape' && showPopup) {
			e.preventDefault();
			e.stopPropagation();
			uiStore.closePopover(popoverId);
		}
	}

	function handleLeaderboardClick(e) {
		e.preventDefault();
		e.stopPropagation();
		uiStore.closePopover(popoverId);
		goto('/leaderboard');
	}
</script>

<svelte:window onclick={closePopup} />

<div
	bind:this={badgeContainerEl}
	class="level-badge-container {interactive ? 'is-interactive' : ''}"
>
	{#if interactive}
		<button
			type="button"
			class="level-badge level-badge--{size} tier-{tier}"
			class:is-tier6={tier === 6}
			class:is-active-popup={showPopup}
			aria-label="Nivel {level}, rango {tierData.name}"
			aria-haspopup="dialog"
			aria-expanded={showPopup}
			title={tooltipText}
			onclick={togglePopup}
			onkeydown={handleKeyDown}
			style="--tier-color: {tierData.color};"
		>
			<!-- Reflejo orgánico suave de cristal sin líneas divisorias -->
			<div class="level-badge__shine" aria-hidden="true"></div>

			<!-- Shimmer dinámico para Tier 6 -->
			{#if tier === 6}
				<div class="level-badge__liquid-shine" aria-hidden="true"></div>
			{/if}

			<span class="level-badge__content">
				<span class="level-badge__prefix">Lv</span>
				<span class="level-badge__num">{level}</span>
			</span>
		</button>
	{:else}
		<div
			class="level-badge level-badge--{size} tier-{tier}"
			class:is-tier6={tier === 6}
			role="status"
			aria-label="Nivel {level}, rango {tierData.name}"
			title={tooltipText}
			style="--tier-color: {tierData.color};"
		>
			<!-- Reflejo orgánico suave de cristal sin líneas divisorias -->
			<div class="level-badge__shine" aria-hidden="true"></div>

			<!-- Shimmer dinámico para Tier 6 -->
			{#if tier === 6}
				<div class="level-badge__liquid-shine" aria-hidden="true"></div>
			{/if}

			<span class="level-badge__content">
				<span class="level-badge__prefix">Lv</span>
				<span class="level-badge__num">{level}</span>
			</span>
		</div>
	{/if}

	{#if showPopup}
		<div
			class="level-popup"
			transition:scale={{ duration: 240, start: 0.92, easing: quintOut }}
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			onmouseenter={(e) => e.stopPropagation()}
			onmouseleave={(e) => e.stopPropagation()}
			onpointerenter={(e) => e.stopPropagation()}
			role="dialog"
			tabindex="-1"
			aria-label="Información de Nivel {level}"
		>
			<div class="popup-header">
				<div
					class="popup-icon-bubble"
					style="background: color-mix(in srgb, {tierData.color} 20%, transparent); border-color: color-mix(in srgb, {tierData.color} 45%, transparent);"
				>
					<span class="material-icons-round popup-icon" style="color: {tierData.color}">
						{tierData.icon}
					</span>
				</div>
				<div class="popup-header-info">
					<span class="popup-title">{tierData.badgeTitle}</span>
					<span class="popup-subtitle">Nivel {level} alcanzado</span>
				</div>
			</div>

			<div class="popup-body">
				<p class="popup-desc">{tierData.desc}</p>

				<div class="popup-tier-track">
					<span class="popup-tier-tag">Rango de Nivel:</span>
					<span class="popup-tier-val">Nv. {tierData.minLevel} – {tierData.maxLevel}</span>
				</div>

				<a href="/leaderboard" class="popup-link-btn" onclick={handleLeaderboardClick}>
					<span>Ver Tabla de Clasificación</span>
					<span class="material-icons-round text-[16px]">chevron_right</span>
				</a>
			</div>
		</div>
	{/if}
</div>

{#if showText && size === 'lg'}
	<div class="level-badge__label">
		Nivel {level} • {tierData.name}
	</div>
{/if}

<style>
	.level-badge-container {
		position: relative;
		display: inline-flex;
		align-items: center;
		vertical-align: middle;
	}

	.level-badge {
		position: relative;
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		font-weight: 800;
		border: 1px solid transparent;
		backdrop-filter: blur(10px) saturate(1.2);
		-webkit-backdrop-filter: blur(10px) saturate(1.2);
		overflow: hidden;
		user-select: none;
		cursor: default;
		line-height: 1;
		outline: none;
		transition:
			transform 0.22s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
			box-shadow 0.22s var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
			border-color 0.2s ease,
			filter 0.2s ease;
	}

	.level-badge-container.is-interactive .level-badge {
		cursor: pointer;
	}

	.level-badge-container.is-interactive .level-badge:hover {
		transform: translateY(-1px) scale(1.04);
	}

	.level-badge-container.is-interactive .level-badge:active {
		transform: scale(0.96);
	}

	.level-badge.is-active-popup {
		border-color: var(--tier-color) !important;
		box-shadow: 0 0 16px var(--tier-color) !important;
	}

	/* ══ Tamaños Proporcionales ══ */
	.level-badge--xs {
		height: 18px;
		min-width: 32px;
		padding: 0 5px;
		font-size: 9.5px;
		border-radius: var(--radius-xs, 5px);
		gap: 1.5px;
	}

	.level-badge--sm {
		height: 22px;
		min-width: 38px;
		padding: 0 7px;
		font-size: 11px;
		border-radius: var(--radius-xs, 6px);
		gap: 2px;
	}

	.level-badge--md {
		height: 28px;
		min-width: 48px;
		padding: 0 9px;
		font-size: 12.5px;
		border-radius: var(--radius-sm, 8px);
		gap: 2.5px;
	}

	.level-badge--lg {
		height: 42px;
		min-width: 72px;
		padding: 0 16px;
		font-size: 17px;
		border-radius: var(--radius-md, 12px);
		border-width: 1.5px;
		gap: 3px;
	}

	.level-badge__content {
		position: relative;
		z-index: 2;
		display: inline-flex;
		align-items: baseline;
		gap: inherit;
		white-space: nowrap;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.level-badge__prefix {
		opacity: 0.85;
		font-size: 0.78em;
		text-transform: uppercase;
		font-weight: 800;
		letter-spacing: 0.04em;
		font-family: var(--font-sans, system-ui, sans-serif);
	}

	.level-badge__num {
		font-family: var(--font-display, 'Outfit', system-ui, sans-serif);
		font-weight: 900;
		letter-spacing: -0.02em;
	}

	/* ══ Reflejo Orgánico Convexo (Sin línea divisoria en medio) ══ */
	.level-badge__shine {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: radial-gradient(
			ellipse 140% 90% at 50% -20%,
			rgba(255, 255, 255, 0.42) 0%,
			rgba(255, 255, 255, 0.1) 40%,
			transparent 75%
		);
		pointer-events: none;
		z-index: 1;
	}

	/* ══ Tiers de Nivel — Dark / Midnight ══ */
	.tier-1 {
		background: linear-gradient(135deg, rgba(100, 116, 139, 0.28) 0%, rgba(71, 85, 105, 0.18) 100%);
		border-color: rgba(148, 163, 184, 0.38);
		color: #f1f5f9;
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.22),
			inset 0 1px 0 rgba(255, 255, 255, 0.35);
	}
	.tier-1:hover {
		border-color: rgba(203, 213, 225, 0.65);
		box-shadow:
			0 0 12px rgba(148, 163, 184, 0.4),
			0 2px 6px rgba(0, 0, 0, 0.25),
			inset 0 1px 0 rgba(255, 255, 255, 0.55);
	}

	.tier-2 {
		background: linear-gradient(135deg, rgba(16, 185, 129, 0.34) 0%, rgba(5, 150, 105, 0.22) 100%);
		border-color: rgba(52, 211, 153, 0.55);
		color: #6ee7b7;
		box-shadow:
			0 0 12px rgba(16, 185, 129, 0.32),
			0 2px 6px rgba(0, 0, 0, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.45);
	}
	.tier-2:hover {
		border-color: rgba(110, 231, 183, 0.85);
		box-shadow:
			0 0 18px rgba(16, 185, 129, 0.55),
			0 3px 8px rgba(0, 0, 0, 0.25),
			inset 0 1px 0 rgba(255, 255, 255, 0.65);
	}

	.tier-3 {
		background: linear-gradient(135deg, rgba(27, 133, 243, 0.34) 0%, rgba(37, 99, 235, 0.22) 100%);
		border-color: rgba(96, 165, 250, 0.55);
		color: #93c5fd;
		box-shadow:
			0 0 14px rgba(27, 133, 243, 0.38),
			0 2px 6px rgba(0, 0, 0, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.45);
	}
	.tier-3:hover {
		border-color: rgba(147, 197, 253, 0.85);
		box-shadow:
			0 0 20px rgba(27, 133, 243, 0.6),
			0 3px 8px rgba(0, 0, 0, 0.25),
			inset 0 1px 0 rgba(255, 255, 255, 0.65);
	}

	.tier-4 {
		background: linear-gradient(135deg, rgba(6, 182, 212, 0.34) 0%, rgba(13, 148, 136, 0.22) 100%);
		border-color: rgba(45, 212, 191, 0.58);
		color: #67e8f9;
		box-shadow:
			0 0 16px rgba(6, 182, 212, 0.42),
			0 2px 6px rgba(0, 0, 0, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.5);
	}
	.tier-4:hover {
		border-color: rgba(103, 232, 249, 0.9);
		box-shadow:
			0 0 22px rgba(6, 182, 212, 0.65),
			0 3px 8px rgba(0, 0, 0, 0.25),
			inset 0 1px 0 rgba(255, 255, 255, 0.7);
	}

	.tier-5 {
		background: linear-gradient(135deg, rgba(245, 158, 11, 0.38) 0%, rgba(217, 119, 6, 0.22) 100%);
		border-color: rgba(251, 191, 36, 0.65);
		color: #fde68a;
		box-shadow:
			0 0 18px rgba(245, 158, 11, 0.48),
			0 2px 6px rgba(0, 0, 0, 0.2),
			inset 0 1px 0 rgba(255, 255, 255, 0.55);
	}
	.tier-5:hover {
		border-color: rgba(253, 230, 138, 0.95);
		box-shadow:
			0 0 26px rgba(245, 158, 11, 0.75),
			0 3px 8px rgba(0, 0, 0, 0.25),
			inset 0 1px 0 rgba(255, 255, 255, 0.75);
	}

	.tier-6 {
		background: linear-gradient(
			135deg,
			rgba(6, 182, 212, 0.45) 0%,
			rgba(14, 165, 233, 0.55) 35%,
			rgba(168, 85, 247, 0.45) 70%,
			rgba(16, 185, 129, 0.4) 100%
		);
		border-color: rgba(255, 255, 255, 0.85);
		color: #ffffff;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
		box-shadow:
			0 0 22px rgba(34, 211, 238, 0.6),
			0 2px 6px rgba(0, 0, 0, 0.25),
			inset 0 1px 2px rgba(255, 255, 255, 0.75);
		animation: pulse-glow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
	.tier-6:hover {
		border-color: #ffffff;
		box-shadow:
			0 0 32px rgba(34, 211, 238, 0.85),
			0 0 16px rgba(168, 85, 247, 0.65),
			inset 0 1px 2px rgba(255, 255, 255, 0.9);
	}

	/* ══ Adaptación a Tema Claro (Light Theme) con Alto Contraste ══ */
	:global([data-theme='light']) .tier-1 {
		background: linear-gradient(
			135deg,
			rgba(241, 245, 249, 0.95) 0%,
			rgba(226, 232, 240, 0.9) 100%
		);
		border-color: rgba(148, 163, 184, 0.6);
		color: #1e293b;
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.08),
			inset 0 1px 0 rgba(255, 255, 255, 0.85);
	}

	:global([data-theme='light']) .tier-2 {
		background: linear-gradient(
			135deg,
			rgba(209, 250, 229, 0.95) 0%,
			rgba(167, 243, 208, 0.88) 100%
		);
		border-color: rgba(16, 185, 129, 0.65);
		color: #065f46;
		box-shadow:
			0 2px 6px rgba(16, 185, 129, 0.22),
			inset 0 1px 0 rgba(255, 255, 255, 0.9);
	}

	:global([data-theme='light']) .tier-3 {
		background: linear-gradient(
			135deg,
			rgba(219, 234, 254, 0.95) 0%,
			rgba(191, 219, 254, 0.88) 100%
		);
		border-color: rgba(27, 133, 243, 0.65);
		color: #1e40af;
		box-shadow:
			0 2px 6px rgba(27, 133, 243, 0.22),
			inset 0 1px 0 rgba(255, 255, 255, 0.9);
	}

	:global([data-theme='light']) .tier-4 {
		background: linear-gradient(
			135deg,
			rgba(204, 251, 241, 0.95) 0%,
			rgba(165, 243, 252, 0.88) 100%
		);
		border-color: rgba(13, 148, 136, 0.65);
		color: #0f766e;
		box-shadow:
			0 2px 6px rgba(13, 148, 136, 0.25),
			inset 0 1px 0 rgba(255, 255, 255, 0.9);
	}

	:global([data-theme='light']) .tier-5 {
		background: linear-gradient(
			135deg,
			rgba(254, 243, 199, 0.95) 0%,
			rgba(253, 230, 138, 0.88) 100%
		);
		border-color: rgba(245, 158, 11, 0.7);
		color: #854d0e;
		box-shadow:
			0 2px 6px rgba(245, 158, 11, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.9);
	}

	:global([data-theme='light']) .tier-6 {
		background: linear-gradient(135deg, #0284c7 0%, #0d9488 45%, #7c3aed 100%);
		border-color: rgba(255, 255, 255, 0.95);
		color: #ffffff;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
		box-shadow:
			0 3px 12px rgba(14, 165, 233, 0.45),
			inset 0 1px 1px rgba(255, 255, 255, 0.65);
	}

	/* ══ Popover Interactivo Neo-Aero ══ */
	.level-popup {
		position: absolute;
		top: calc(100% + 8px);
		left: 50%;
		transform: translateX(-50%);
		width: 260px;
		background: #0f172a;
		backdrop-filter: blur(20px) saturate(1.3);
		-webkit-backdrop-filter: blur(20px) saturate(1.3);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: var(--radius-md, 14px);
		box-shadow:
			0 16px 40px rgba(0, 0, 0, 0.75),
			0 0 24px color-mix(in srgb, var(--tier-color, #10b981) 30%, transparent),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
		padding: 14px;
		z-index: var(--z-modal-content, 600);
		color: #f8fafc;
		text-align: left;
		cursor: default;
	}

	/* Flecha superior del popover */
	.level-popup::before {
		content: '';
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		border-width: 6px;
		border-style: solid;
		border-color: transparent transparent rgba(15, 23, 42, 0.92) transparent;
	}

	.popup-header {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 10px;
		padding-bottom: 8px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.popup-icon-bubble {
		width: 34px;
		height: 34px;
		border-radius: var(--radius-xs, 6px);
		border: 1px solid;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.popup-icon {
		font-size: 20px;
	}

	.popup-header-info {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.popup-title {
		font-size: 0.85rem;
		font-weight: 800;
		color: #ffffff;
		line-height: 1.2;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.popup-subtitle {
		font-size: 0.72rem;
		color: rgba(255, 255, 255, 0.6);
		font-weight: 600;
	}

	.popup-body {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.popup-desc {
		font-size: 0.78rem;
		line-height: 1.35;
		color: rgba(255, 255, 255, 0.78);
		margin: 0;
	}

	.popup-tier-track {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.08);
		padding: 4px 8px;
		border-radius: var(--radius-xs, 6px);
		font-size: 0.72rem;
	}

	.popup-tier-tag {
		color: rgba(255, 255, 255, 0.6);
	}

	.popup-tier-val {
		font-weight: 800;
		color: var(--tier-color, #ffffff);
	}

	.popup-link-btn {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 4px;
		padding: 6px 10px;
		background: color-mix(in srgb, var(--tier-color, var(--accent-blue-base)) 20%, transparent);
		border: 1px solid
			color-mix(in srgb, var(--tier-color, var(--accent-blue-base)) 40%, transparent);
		border-radius: var(--radius-xs, 6px);
		color: #ffffff;
		font-size: 0.75rem;
		font-weight: 700;
		text-decoration: none;
		transition: all 0.2s var(--ease-out);
	}

	.popup-link-btn:hover {
		background: color-mix(in srgb, var(--tier-color, var(--accent-blue-base)) 35%, transparent);
		border-color: var(--tier-color, var(--accent-blue-base));
		transform: translateX(2px);
	}

	/* Adaptación Light Theme para el Popover */
	:global([data-theme='light']) .level-popup {
		background: #ffffff;
		border-color: rgba(14, 165, 233, 0.35);
		color: #1e293b;
		box-shadow:
			0 16px 36px rgba(0, 0, 0, 0.22),
			0 0 20px color-mix(in srgb, var(--tier-color, #10b981) 20%, transparent),
			inset 0 1px 0 rgba(255, 255, 255, 0.9);
	}

	:global([data-theme='light']) .level-popup::before {
		border-color: transparent transparent #ffffff transparent;
	}

	:global([data-theme='light']) .popup-header {
		border-bottom-color: rgba(0, 0, 0, 0.06);
	}

	:global([data-theme='light']) .popup-title {
		color: #0f172a;
	}

	:global([data-theme='light']) .popup-subtitle {
		color: #64748b;
	}

	:global([data-theme='light']) .popup-desc {
		color: #334155;
	}

	:global([data-theme='light']) .popup-tier-track {
		background: rgba(0, 0, 0, 0.04);
		border-color: rgba(0, 0, 0, 0.06);
	}

	:global([data-theme='light']) .popup-tier-tag {
		color: #64748b;
	}

	:global([data-theme='light']) .popup-link-btn {
		background: color-mix(in srgb, var(--tier-color, var(--accent-blue-base)) 12%, transparent);
		color: #0f172a;
	}

	:global([data-theme='light']) .popup-link-btn:hover {
		background: color-mix(in srgb, var(--tier-color, var(--accent-blue-base)) 22%, transparent);
	}

	/* ══ Modos de Rendimiento ══ */
	:global([data-perf-mode='true']) .level-badge,
	:global([data-glass-blur='none']) .level-badge,
	:global([data-perf-mode='true']) .level-popup,
	:global([data-glass-blur='none']) .level-popup {
		backdrop-filter: none !important;
		-webkit-backdrop-filter: none !important;
	}

	:global([data-perf-mode='true']) .tier-6,
	:global([data-reduced-motion='true']) .tier-6 {
		animation: none !important;
	}

	:global([data-simplify-shadows='true']) .level-badge,
	:global([data-simplify-shadows='true']) .level-popup {
		box-shadow: none !important;
	}

	.level-badge__liquid-shine {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			135deg,
			transparent 0%,
			rgba(255, 255, 255, 0.45) 50%,
			transparent 100%
		);
		background-size: 200% 200%;
		animation: shine 4s ease infinite;
		pointer-events: none;
		z-index: 1;
	}

	@keyframes pulse-glow {
		0%,
		100% {
			box-shadow:
				0 0 16px rgba(34, 211, 238, 0.4),
				0 2px 6px rgba(0, 0, 0, 0.25),
				inset 0 1px 2px rgba(255, 255, 255, 0.6);
		}
		50% {
			box-shadow:
				0 0 28px rgba(34, 211, 238, 0.75),
				0 3px 8px rgba(0, 0, 0, 0.3),
				inset 0 0 8px rgba(255, 255, 255, 0.4);
		}
	}

	@keyframes shine {
		0% {
			background-position: 0% 50%;
		}
		50% {
			background-position: 100% 50%;
		}
		100% {
			background-position: 0% 50%;
		}
	}

	.level-badge__label {
		margin-top: 6px;
		text-align: center;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}
</style>
