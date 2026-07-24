<script>
	import { themeStore, setTheme, THEME_OPTIONS } from '$lib/stores/theme.svelte.js';
	import { fly } from 'svelte/transition';
	import { onMount } from 'svelte';

	let { compact = false, align = 'right', class: extraClass = '' } = $props();

	let isOpen = $state(false);
	let wrapperRef = $state(null);

	function toggleDropdown(e) {
		e?.stopPropagation();
		isOpen = !isOpen;
	}

	function handleSelect(themeId, e) {
		e?.stopPropagation();
		setTheme(themeId);
		isOpen = false;
	}

	onMount(() => {
		function handleClickOutside(e) {
			if (wrapperRef && !wrapperRef.contains(e.target)) {
				isOpen = false;
			}
		}
		function handleKeyDown(e) {
			if (e.key === 'Escape' && isOpen) {
				isOpen = false;
			}
		}
		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<div
	class="vs-theme-selector-wrap {extraClass}"
	bind:this={wrapperRef}
	style="position: relative; display: inline-block;"
>
	{#if compact}
		<button
			type="button"
			onclick={toggleDropdown}
			class="aero-icon-btn vs-theme-trigger-compact"
			class:is-active={isOpen}
			title={themeStore.label}
			aria-label={themeStore.label}
			aria-expanded={isOpen}
			aria-haspopup="listbox"
			style="flex: 0 0 38px; min-width: 38px; min-height: 38px;"
		>
			<span class="material-icons-round" style="font-size: 20px;">
				{themeStore.icon}
			</span>
		</button>
	{:else}
		<button
			type="button"
			onclick={toggleDropdown}
			class="vs-theme-trigger-btn"
			class:is-active={isOpen}
			aria-expanded={isOpen}
			aria-haspopup="listbox"
			style="flex: 0 0 auto; min-width: 44px; min-height: 44px;"
		>
			<span class="material-icons-round theme-trigger-icon">{themeStore.icon}</span>
			<span class="theme-trigger-name">{themeStore.name}</span>
			<span class="material-icons-round theme-trigger-chevron" class:rotated={isOpen}>
				expand_more
			</span>
		</button>
	{/if}

	{#if isOpen}
		<div
			class="vs-theme-dropdown glass-panel"
			class:align-left={align === 'left'}
			class:align-right={align === 'right'}
			transition:fly={{ y: -8, duration: 220 }}
			role="listbox"
			tabindex="-1"
			aria-label="Seleccionar tema"
		>
			<div class="vs-theme-dropdown-header">
				<span class="material-icons-round header-icon">palette</span>
				<span>Tema visual</span>
			</div>

			<div class="vs-theme-options-list">
				{#each THEME_OPTIONS as opt (opt.id)}
					{@const isSelected = themeStore.value === opt.id}
					<button
						type="button"
						class="vs-theme-option-item"
						class:is-selected={isSelected}
						onclick={(e) => handleSelect(opt.id, e)}
						role="option"
						aria-selected={isSelected}
					>
						<div class="option-icon-box {opt.id}">
							<span class="material-icons-round">{opt.icon}</span>
						</div>

						<div class="option-text-col">
							<span class="option-name">{opt.name}</span>
							<span class="option-desc">{opt.desc}</span>
						</div>

						{#if isSelected}
							<span class="material-icons-round option-check"> check </span>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.vs-theme-selector-wrap {
		z-index: var(--z-dropdown, 100);
	}

	.vs-theme-trigger-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 14px;
		border-radius: var(--radius-full, 9999px);
		background: var(--glass-bg);
		border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.15));
		color: var(--text-primary, #ffffff);
		font-family: var(--font-sans);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		backdrop-filter: var(--glass-blur, blur(14px));
		box-shadow: var(--shadow-xs), var(--glass-inset-highlight);
		transition:
			transform var(--t-spring, 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)),
			border-color var(--t-base, 0.25s ease-out),
			background var(--t-base, 0.25s ease-out),
			box-shadow var(--t-base, 0.25s ease-out);
		user-select: none;
	}

	.vs-theme-trigger-btn:hover,
	.vs-theme-trigger-btn.is-active {
		background: var(--bg-overlay, rgba(255, 255, 255, 0.12));
		border-color: rgba(27, 133, 243, 0.4);
		box-shadow:
			var(--shadow-sm),
			0 0 12px rgba(27, 133, 243, 0.25);
		transform: translateY(-1px);
	}

	.theme-trigger-icon {
		font-size: 18px;
		color: var(--accent-blue-base, #1b85f3);
	}

	.theme-trigger-name {
		line-height: 1;
	}

	.theme-trigger-chevron {
		font-size: 18px;
		color: var(--text-secondary, rgba(255, 255, 255, 0.6));
		transition: transform var(--t-base, 0.25s ease-out);
	}

	.theme-trigger-chevron.rotated {
		transform: rotate(180deg);
	}

	.vs-theme-trigger-compact.is-active {
		background: var(--bg-overlay, rgba(255, 255, 255, 0.12));
		color: var(--accent-blue-base, #1b85f3);
		border-color: rgba(27, 133, 243, 0.4);
		box-shadow: 0 0 12px rgba(27, 133, 243, 0.3);
	}

	.vs-theme-dropdown {
		position: absolute;
		top: calc(100% + 8px);
		min-width: 220px;
		padding: 10px;
		border-radius: var(--radius-lg, 20px);
		background: var(--bg-surface, rgba(20, 25, 35, 0.95));
		border: 1px solid var(--border-glass, rgba(255, 255, 255, 0.15));
		box-shadow:
			var(--glass-shadow),
			0 16px 36px rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(20px) saturate(1.4);
		-webkit-backdrop-filter: blur(20px) saturate(1.4);
		z-index: 1000;
	}

	.vs-theme-dropdown.align-right {
		right: 0;
		left: auto;
	}

	.vs-theme-dropdown.align-left {
		left: 0;
		right: auto;
	}

	.vs-theme-dropdown-header {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px 10px 10px;
		border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
		margin-bottom: 6px;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary, rgba(255, 255, 255, 0.6));
	}

	.header-icon {
		font-size: 16px;
		color: var(--accent-blue-base, #1b85f3);
	}

	.vs-theme-options-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.vs-theme-option-item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 8px 10px;
		border-radius: var(--radius-md, 14px);
		background: transparent;
		border: 1px solid transparent;
		color: var(--text-primary, #ffffff);
		font-family: var(--font-sans);
		cursor: pointer;
		text-align: left;
		transition:
			background var(--t-fast, 0.15s ease-out),
			border-color var(--t-fast, 0.15s ease-out),
			transform var(--t-spring, 0.45s cubic-bezier(0.34, 1.56, 0.64, 1));
	}

	.vs-theme-option-item:hover {
		background: rgba(255, 255, 255, 0.08);
		transform: translateX(2px);
	}

	.vs-theme-option-item.is-selected {
		background: rgba(27, 133, 243, 0.15);
		border-color: rgba(27, 133, 243, 0.35);
		box-shadow: 0 4px 14px rgba(27, 133, 243, 0.15);
	}

	.option-icon-box {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-sm, 10px);
		background: rgba(255, 255, 255, 0.06);
		color: var(--text-primary, #ffffff);
		flex: 0 0 32px;
		min-width: 32px;
		min-height: 32px;
	}

	.option-icon-box.light {
		color: #f59e0b;
		background: rgba(245, 158, 11, 0.15);
	}

	.option-icon-box.dark {
		color: #1b85f3;
		background: rgba(27, 133, 243, 0.15);
	}

	.option-icon-box.midnight {
		color: #a855f7;
		background: rgba(168, 85, 247, 0.15);
	}

	.option-text-col {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}

	.option-name {
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.2;
		color: var(--text-primary, #ffffff);
	}

	.option-desc {
		font-size: 0.725rem;
		color: var(--text-secondary, rgba(255, 255, 255, 0.55));
		line-height: 1.2;
		margin-top: 2px;
	}

	.option-check {
		font-size: 18px;
		color: var(--accent-blue-base, #1b85f3);
		flex: 0 0 auto;
	}
</style>
