<script>
	import { scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	let { role = 'user', isVerified = false, size = '16px', interactive = false } = $props();

	let badgeType = $derived.by(() => {
		if (role === 'super_admin' || role === 'admin') return 'admin';
		if (role === 'moderator') return 'moderator';
		if (role === 'support') return 'support';
		if (role === 'team') return 'team';
		if (isVerified) return 'verified';
		return 'none';
	});

	let badgeData = $derived.by(() => {
		if (badgeType === 'admin') {
			return {
				icon: 'admin_panel_settings',
				color: 'var(--badge-admin)',
				title: 'Administrador del Sistema',
				desc: 'Esta cuenta pertenece a la administración oficial de V-SOCIAL con privilegios plenos.',
				linkText: 'Conocer más'
			};
		}
		if (badgeType === 'moderator') {
			return {
				icon: 'shield',
				color: 'var(--badge-moderator)',
				title: 'Moderador Oficial',
				desc: 'Esta cuenta pertenece a un moderador oficial, encargado de mantener la comunidad segura.',
				linkText: 'Ver directrices'
			};
		}
		if (badgeType === 'support') {
			return {
				icon: 'support_agent',
				color: 'var(--badge-support)',
				title: 'Soporte V-SOCIAL',
				desc: 'Esta cuenta pertenece al equipo oficial de soporte, encargados de verificaciones y asistencia humana.',
				linkText: 'Contactar Soporte'
			};
		}
		if (badgeType === 'team') {
			return {
				icon: 'military_tech',
				color: 'var(--badge-team)',
				title: 'Equipo V-SOCIAL',
				desc: 'Esta cuenta pertenece a un miembro central del equipo de desarrollo o staff de V-SOCIAL.',
				linkText: 'Conocer al equipo'
			};
		}
		if (badgeType === 'verified') {
			return {
				icon: 'verified',
				color: 'var(--badge-verified)',
				title: 'Cuenta verificada',
				desc: 'Esta cuenta está verificada porque se trata de una figura destacada o cuenta autenticada.',
				linkText: 'Más información'
			};
		}
		return { icon: '', color: '', title: '', desc: '', linkText: '' };
	});

	let showPopup = $state(false);

	let badgeEl = $state(null);

	function togglePopup(_e) {
		if (!interactive) return;
		if (badgeType === 'none') return;
		showPopup = !showPopup;
	}

	function closePopup(e) {
		// Si el clic fue dentro del popup (el badge o su wrapper), no cerrar
		if (badgeEl && badgeEl.contains(e.target)) return;
		showPopup = false;
	}
</script>

<svelte:window onclick={closePopup} />

{#if badgeType !== 'none'}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={badgeEl}
		class="custom-badge-wrapper {interactive ? 'is-interactive' : ''}"
		role={interactive ? 'button' : 'presentation'}
		tabindex={interactive ? '0' : '-1'}
		onclick={togglePopup}
		style="--badge-color: {badgeData.color}; --badge-size: {size};"
	>
		<span class="material-icons-round badge-icon">{badgeData.icon}</span>

		{#if showPopup}
			<div
				class="badge-popup glass-panel aero-modal"
				transition:scale={{ duration: 300, start: 0.9, easing: quintOut }}
				onclick={(e) => {
					if (!e.target.closest('a')) {
						e.stopPropagation();
					}
				}}
			>
				<div class="popup-header">
					<span class="popup-title">{badgeData.title}</span>
				</div>

				<div class="popup-body">
					<span class="material-icons-round popup-body-icon" style="color: {badgeData.color}"
						>{badgeData.icon}</span
					>
					<p class="popup-desc">
						{badgeData.desc} <a href="/about/verified" class="popup-link">{badgeData.linkText}</a>
					</p>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.custom-badge-wrapper {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-left: 6px;
		border-radius: 6px;
		outline: none;
		transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
		background: color-mix(in srgb, var(--badge-color) 15%, transparent);
		border: 1px solid color-mix(in srgb, var(--badge-color) 30%, transparent);
		padding: 2px 4px;
		box-shadow:
			0 2px 6px color-mix(in srgb, var(--badge-color) 15%, transparent),
			inset 0 1px 0 rgba(255, 255, 255, 0.05);
	}

	.custom-badge-wrapper.is-interactive {
		cursor: pointer;
	}

	.custom-badge-wrapper.is-interactive:hover {
		background: color-mix(in srgb, var(--badge-color) 25%, transparent);
		border-color: color-mix(in srgb, var(--badge-color) 50%, transparent);
	}

	.badge-icon {
		font-size: var(--badge-size);
		color: var(--badge-color);
		transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
		line-height: 1;
	}

	.custom-badge-wrapper.is-interactive:hover .badge-icon {
		transform: scale(1.15) rotate(5deg);
	}

	.badge-popup {
		position: absolute;
		top: 130%;
		left: 50%;
		transform: translateX(-50%);
		width: 250px;
		background:
			radial-gradient(circle at top right, rgba(255, 255, 255, 0.03), transparent 60%),
			rgba(10, 14, 20, 0.85);
		backdrop-filter: blur(25px);
		-webkit-backdrop-filter: blur(25px);
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow:
			0 15px 45px rgba(0, 0, 0, 0.6),
			inset 0 1px 0 rgba(255, 255, 255, 0.1),
			0 0 25px var(--badge-color, rgba(0, 0, 0, 0));
		border-radius: 12px;
		padding: 14px;
		z-index: 1000;
		cursor: default;
		color: var(--text-primary);
		overflow: hidden;
	}

	/* Glare effect inside popup */
	.badge-popup::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 30%;
		background: linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 0%, transparent 100%);
		pointer-events: none;
		border-radius: 16px 16px 0 0;
	}

	/* Flecha del popup */
	.badge-popup::before {
		content: '';
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		border-width: 8px;
		border-style: solid;
		border-color: transparent transparent rgba(15, 20, 25, 0.95) transparent;
		z-index: 2;
	}

	.popup-header {
		margin-bottom: 12px;
	}

	.popup-title {
		font-size: 1rem;
		font-weight: 800;
		color: #ffffff;
		letter-spacing: -0.02em;
	}

	.popup-body {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}

	.popup-body-icon {
		font-size: 24px;
		margin-top: 2px;
	}

	.popup-desc {
		font-size: 0.85rem;
		line-height: 1.35;
		color: rgba(255, 255, 255, 0.75);
		margin: 0;
	}

	.popup-link {
		color: var(--aero-blue);
		text-decoration: none;
		font-weight: 600;
		transition: color 0.2s;
	}

	.popup-link:hover {
		color: #fff;
		text-decoration: underline;
	}
</style>
