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
			class="vs-theme-dropdown"
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
		background: var(--bg-surface-solid);
		border: 1px solid var(--border-subtle);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		backdrop-filter: var(--glass-blur, blur(14px));
		box-shadow: var(--shadow-xs);
		transition:
			transform var(--t-spring, 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)),
			border-color var(--t-base, 0.25s ease-out),
			background var(--t-base, 0.25s ease-out),
			color var(--t-base, 0.25s ease-out),
			box-shadow var(--t-base, 0.25s ease-out);
		user-select: none;
	}

	.vs-theme-trigger-btn:hover,
	.vs-theme-trigger-btn.is-active {
		background: var(--bg-surface-hover);
		color: var(--accent-blue-base);
		border-color: rgba(var(--accent-blue-rgb), 0.4);
		box-shadow:
			var(--shadow-sm),
			0 0 12px rgba(var(--accent-blue-rgb), 0.25);
		transform: translateY(-1px);
	}

	.vs-theme-trigger-compact {
		background: var(--bg-surface-solid);
		border: 1px solid var(--border-subtle);
		color: var(--text-primary);
		box-shadow: var(--shadow-xs);
		transition: all 0.2s var(--ease-spring);
	}

	.vs-theme-trigger-compact:hover,
	.vs-theme-trigger-compact.is-active {
		background: var(--bg-surface-hover);
		color: var(--accent-blue-base);
		border-color: rgba(var(--accent-blue-rgb), 0.45);
		box-shadow: 0 0 12px rgba(var(--accent-blue-rgb), 0.25);
		transform: scale(1.08);
	}

	.theme-trigger-icon {
		font-size: 18px;
		color: var(--accent-blue-base);
	}

	.theme-trigger-name {
		line-height: 1;
	}

	.theme-trigger-chevron {
		font-size: 18px;
		color: var(--text-muted);
		transition: transform var(--t-base, 0.25s ease-out);
	}

	.theme-trigger-chevron.rotated {
		transform: rotate(180deg);
	}

	.vs-theme-dropdown {
		position: absolute;
		top: calc(100% + 8px);
		min-width: 230px;
		padding: 10px;
		border-radius: var(--radius-lg, 20px);
		background: var(--bg-surface-solid);
		border: 1px solid var(--border-subtle);
		box-shadow:
			0 16px 40px rgba(0, 0, 0, 0.25),
			0 2px 8px rgba(0, 0, 0, 0.08);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		z-index: 1000;
		color: var(--text-primary);
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
		border-bottom: 1px solid var(--border-subtle);
		margin-bottom: 6px;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
	}

	.header-icon {
		font-size: 16px;
		color: var(--accent-blue-base);
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
		color: var(--text-primary);
		font-family: var(--font-sans);
		cursor: pointer;
		text-align: left;
		transition:
			background var(--t-fast, 0.15s ease-out),
			border-color var(--t-fast, 0.15s ease-out),
			color var(--t-fast, 0.15s ease-out),
			transform var(--t-spring, 0.45s cubic-bezier(0.34, 1.56, 0.64, 1));
	}

	.vs-theme-option-item:hover {
		background: var(--bg-surface-hover);
		color: var(--text-primary);
		transform: translateX(2px);
	}

	.vs-theme-option-item.is-selected {
		background: rgba(var(--accent-blue-rgb), 0.12);
		border-color: rgba(var(--accent-blue-rgb), 0.3);
		color: var(--accent-blue-base);
		box-shadow: 0 2px 8px rgba(var(--accent-blue-rgb), 0.12);
	}

	.option-icon-box {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-sm, 10px);
		background: var(--bg-surface-hover);
		border: 1px solid var(--border-subtle);
		color: var(--text-primary);
		flex: 0 0 32px;
		min-width: 32px;
		min-height: 32px;
	}

	.option-icon-box.light {
		color: #f59e0b;
		background: rgba(245, 158, 11, 0.15);
		border-color: rgba(245, 158, 11, 0.25);
	}

	.option-icon-box.dark {
		color: #1b85f3;
		background: rgba(var(--accent-blue-rgb), 0.15);
		border-color: rgba(var(--accent-blue-rgb), 0.25);
	}

	.option-icon-box.midnight {
		color: #22d3ee;
		background: rgba(34, 211, 238, 0.15);
		border-color: rgba(34, 211, 238, 0.25);
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
		color: var(--text-primary);
	}

	.option-desc {
		font-size: 0.725rem;
		color: var(--text-muted);
		line-height: 1.2;
		margin-top: 2px;
	}

	.option-check {
		font-size: 18px;
		color: var(--accent-blue-base);
		flex: 0 0 auto;
	}
</style>
