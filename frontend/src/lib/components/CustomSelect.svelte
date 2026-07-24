<script>
	let {
		value = $bindable(),
		options = [],
		placeholder = 'Seleccionar...',
		label = '',
		onchange
	} = $props();
	let open = $state(false);
	let btnEl = $state(null);
	let wrapperEl = $state(null);
	let dropDirection = $state('down');

	function toggleOpen(e) {
		e.preventDefault();
		if (!open) {
			if (btnEl) {
				const rect = btnEl.getBoundingClientRect();
				const spaceBelow = window.innerHeight - rect.bottom;
				const spaceAbove = rect.top;
				if (spaceBelow < 220 && spaceAbove > spaceBelow) {
					dropDirection = 'up';
				} else {
					dropDirection = 'down';
				}
			}
			open = true;
		} else {
			open = false;
		}
	}

	function selectOption(val) {
		value = val;
		open = false;
		if (onchange) onchange(val);
	}

	function handleWindowClick(e) {
		if (open && wrapperEl && !wrapperEl.contains(e.target)) {
			open = false;
		}
	}
</script>

<svelte:window onclick={handleWindowClick} />

<div class="custom-select-wrapper" bind:this={wrapperEl}>
	{#if label}
		<span class="form-label">{label}</span>
	{/if}
	<button
		type="button"
		class="aero-select select-btn"
		class:is-open={open}
		bind:this={btnEl}
		onclick={toggleOpen}
	>
		<span class="select-value">{options.find((o) => o.value === value)?.label || placeholder}</span>
		<span class="material-icons-round select-chevron" class:rotated={open}>expand_more</span>
	</button>

	{#if open}
		<div class="custom-select-menu drop-{dropDirection}">
			{#each options as opt}
				<button
					type="button"
					class="custom-select-item"
					class:selected={value === opt.value}
					onclick={() => selectOption(opt.value)}
				>
					{#if value === opt.value}
						<span class="material-icons-round check-icon">check</span>
					{/if}
					<span class="item-label">{opt.label}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.custom-select-wrapper {
		position: relative;
		width: 100%;
	}

	.form-label {
		margin-bottom: 6px;
		display: block;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.select-btn {
		width: 100%;
		text-align: left;
		display: flex;
		justify-content: space-between;
		align-items: center;
		cursor: pointer;
		padding-right: 12px;
		margin: 0;
		transition: all 0.2s ease;
	}

	.select-btn:hover {
		border-color: var(--aero-sky);
		box-shadow: 0 0 0 2px rgba(74, 171, 223, 0.1);
	}

	.select-btn:focus-visible {
		outline: none;
		border-color: var(--aero-sky);
		box-shadow: 0 0 0 3px rgba(74, 171, 223, 0.2);
	}

	.select-value {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.select-chevron {
		font-size: 1.2rem;
		color: var(--text-muted);
		transition: transform 0.25s ease;
		flex-shrink: 0;
	}

	.select-chevron.rotated {
		transform: rotate(180deg);
	}

	.select-btn.is-open {
		border-color: var(--aero-sky);
		box-shadow: 0 0 0 2px rgba(74, 171, 223, 0.15);
	}

	.custom-select-menu {
		position: absolute;
		left: 0;
		width: 100%;
		z-index: var(--z-dropdown);
		background: rgba(15, 23, 42, 0.75); /* Darker aero base */
		backdrop-filter: blur(24px) saturate(1.5);
		-webkit-backdrop-filter: blur(24px) saturate(1.5);
		border: 1px solid var(--glass-border);
		border-radius: var(--radius-md);
		overflow: hidden;
		box-shadow:
			0 12px 40px rgba(0, 0, 0, 0.35),
			0 0 0 1px rgba(255, 255, 255, 0.05);
		display: flex;
		flex-direction: column;
	}

	.custom-select-menu.drop-down {
		top: calc(100% + 6px);
		animation: menuSlideDown 0.2s var(--ease-spring);
	}

	.custom-select-menu.drop-up {
		bottom: calc(100% + 6px);
		animation: menuSlideUp 0.2s var(--ease-spring);
	}

	@keyframes menuSlideDown {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes menuSlideUp {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.custom-select-item {
		background: transparent;
		border: none;
		color: var(--text-primary);
		padding: 10px 14px;
		text-align: left;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.15s ease;
		display: flex;
		align-items: center;
		gap: 8px;
		position: relative;
	}

	.custom-select-item::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 3px;
		background: transparent;
		transition: background 0.15s ease;
		border-radius: 0 2px 2px 0;
	}

	.custom-select-item:hover {
		background: rgba(74, 171, 223, 0.08);
	}

	.custom-select-item:hover::before {
		background: var(--aero-sky);
	}

	.custom-select-item:active {
		background: rgba(74, 171, 223, 0.15);
	}

	.custom-select-item:focus-visible {
		outline: none;
		background: rgba(74, 171, 223, 0.1);
	}

	.custom-select-item:focus-visible::before {
		background: var(--aero-sky);
	}

	.custom-select-item.selected {
		background: rgba(74, 171, 223, 0.1);
		color: var(--aero-blue);
		font-weight: 600;
	}

	.custom-select-item.selected::before {
		background: var(--aero-blue);
	}

	.check-icon {
		font-size: 16px;
		color: var(--aero-blue);
		flex-shrink: 0;
	}

	.item-label {
		flex: 1;
	}
</style>
