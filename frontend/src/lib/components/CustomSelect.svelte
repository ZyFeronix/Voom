<script>
	import { clickOutside } from '$lib/actions/clickOutside.js';

	let {
		value = $bindable(),
		options = [],
		placeholder = 'Seleccionar...',
		label = '',
		id = '',
		name = '',
		disabled = false,
		required = false,
		size = 'md',
		icon = '',
		class: className = '',
		triggerClass = '',
		menuClass = '',
		fullWidth = true,
		onchange
	} = $props();

	let open = $state(false);
	let btnEl = $state(null);
	let wrapperEl = $state(null);
	let menuEl = $state(null);
	let dropDirection = $state('down');
	let highlightedIndex = $state(-1);

	// Normaliza las opciones admitiendo objetos { value, label, icon, desc, disabled }, { id, label } o primitivos
	let normalizedOptions = $derived(
		(options || []).map((opt) => {
			if (opt !== null && typeof opt === 'object') {
				const val = opt.value !== undefined ? opt.value : opt.id !== undefined ? opt.id : opt;
				const lbl =
					opt.label !== undefined ? opt.label : opt.name !== undefined ? opt.name : String(val);
				return {
					value: val,
					label: lbl,
					icon: opt.icon || null,
					desc: opt.desc || opt.description || null,
					disabled: !!opt.disabled
				};
			}
			return {
				value: opt,
				label: String(opt),
				icon: null,
				desc: null,
				disabled: false
			};
		})
	);

	let selectedOption = $derived(normalizedOptions.find((o) => o.value === value) || null);

	let displayLabel = $derived(selectedOption ? selectedOption.label : placeholder);
	let displayIcon = $derived(selectedOption?.icon || icon || null);

	function calculateDirection() {
		if (btnEl) {
			const rect = btnEl.getBoundingClientRect();
			const spaceBelow = window.innerHeight - rect.bottom;
			const spaceAbove = rect.top;
			if (spaceBelow < 240 && spaceAbove > spaceBelow) {
				dropDirection = 'up';
			} else {
				dropDirection = 'down';
			}
		}
	}

	function toggleOpen(e) {
		if (disabled) return;
		if (e) {
			e.preventDefault();
			e.stopPropagation();
		}
		if (!open) {
			calculateDirection();
			open = true;
			// Resaltar la opción seleccionada inicialmente
			const curIdx = normalizedOptions.findIndex((o) => o.value === value);
			highlightedIndex = curIdx >= 0 ? curIdx : 0;
			scrollToHighlighted();
		} else {
			closeMenu();
		}
	}

	function closeMenu() {
		open = false;
		highlightedIndex = -1;
	}

	function selectOption(opt) {
		if (!opt || opt.disabled) return;
		value = opt.value;
		closeMenu();
		if (onchange) onchange(opt.value);
		if (btnEl) btnEl.focus();
	}

	function scrollToHighlighted() {
		setTimeout(() => {
			if (menuEl && highlightedIndex >= 0) {
				const items = menuEl.querySelectorAll('.custom-select-item');
				if (items[highlightedIndex]) {
					items[highlightedIndex].scrollIntoView({ block: 'nearest' });
				}
			}
		}, 10);
	}

	function handleKeyDown(e) {
		if (disabled) return;

		if (!open) {
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				toggleOpen();
			}
			return;
		}

		if (e.key === 'Escape') {
			e.preventDefault();
			closeMenu();
			if (btnEl) btnEl.focus();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			let next = highlightedIndex + 1;
			while (next < normalizedOptions.length && normalizedOptions[next].disabled) {
				next++;
			}
			if (next < normalizedOptions.length) {
				highlightedIndex = next;
				scrollToHighlighted();
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			let prev = highlightedIndex - 1;
			while (prev >= 0 && normalizedOptions[prev].disabled) {
				prev--;
			}
			if (prev >= 0) {
				highlightedIndex = prev;
				scrollToHighlighted();
			}
		} else if (e.key === 'Home') {
			e.preventDefault();
			const first = normalizedOptions.findIndex((o) => !o.disabled);
			if (first >= 0) {
				highlightedIndex = first;
				scrollToHighlighted();
			}
		} else if (e.key === 'End') {
			e.preventDefault();
			for (let i = normalizedOptions.length - 1; i >= 0; i--) {
				if (!normalizedOptions[i].disabled) {
					highlightedIndex = i;
					scrollToHighlighted();
					break;
				}
			}
		} else if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			if (highlightedIndex >= 0 && normalizedOptions[highlightedIndex]) {
				selectOption(normalizedOptions[highlightedIndex]);
			}
		} else if (e.key === 'Tab') {
			closeMenu();
		}
	}
</script>

<div
	class="custom-select-wrapper size-{size} {className}"
	class:is-open={open}
	class:is-disabled={disabled}
	class:full-width={fullWidth}
	bind:this={wrapperEl}
	use:clickOutside={closeMenu}
>
	{#if label}
		<label for={id || undefined} class="form-label">{label}</label>
	{/if}

	{#if name}
		<input type="hidden" {name} {value} {required} />
	{/if}

	<button
		type="button"
		{id}
		class="aero-select select-btn {triggerClass}"
		class:is-open={open}
		class:has-value={!!selectedOption}
		{disabled}
		aria-haspopup="listbox"
		aria-expanded={open}
		bind:this={btnEl}
		onclick={toggleOpen}
		onkeydown={handleKeyDown}
	>
		<div class="select-left-content">
			{#if displayIcon}
				<span class="material-icons-round select-leading-icon">{displayIcon}</span>
			{/if}
			<span class="select-value" class:is-placeholder={!selectedOption}>
				{displayLabel}
			</span>
		</div>
		<span class="material-icons-round select-chevron" class:rotated={open}>expand_more</span>
	</button>

	{#if open}
		<div
			class="custom-select-menu drop-{dropDirection} {menuClass}"
			bind:this={menuEl}
			role="listbox"
			tabindex="-1"
		>
			{#each normalizedOptions as opt, i}
				<button
					type="button"
					class="custom-select-item"
					class:selected={value === opt.value}
					class:highlighted={highlightedIndex === i}
					class:disabled={opt.disabled}
					disabled={opt.disabled}
					role="option"
					aria-selected={value === opt.value}
					onclick={() => selectOption(opt)}
					onmouseenter={() => {
						if (!opt.disabled) highlightedIndex = i;
					}}
				>
					{#if opt.icon}
						<span class="material-icons-round item-icon">{opt.icon}</span>
					{/if}
					<div class="item-text-wrap">
						<span class="item-label">{opt.label}</span>
						{#if opt.desc}
							<span class="item-desc">{opt.desc}</span>
						{/if}
					</div>
					{#if value === opt.value}
						<span class="material-icons-round check-icon">check</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.custom-select-wrapper {
		position: relative;
		display: inline-flex;
		flex-direction: column;
		vertical-align: middle;
		user-select: none;
	}

	.custom-select-wrapper.full-width {
		width: 100%;
		display: flex;
	}

	.custom-select-wrapper.is-open {
		z-index: var(--z-dropdown, 100);
	}

	.custom-select-wrapper.is-disabled {
		opacity: 0.5;
		cursor: not-allowed;
		pointer-events: none;
	}

	.form-label {
		margin-bottom: 6px;
		display: block;
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-muted, #94a3b8);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	/* Trigger button base */
	.select-btn {
		width: 100%;
		text-align: left;
		display: flex;
		justify-content: space-between;
		align-items: center;
		cursor: pointer;
		margin: 0;
		background: var(--bg-surface, rgba(15, 23, 42, 0.65));
		backdrop-filter: var(--glass-blur, blur(16px) saturate(1.2));
		-webkit-backdrop-filter: var(--glass-blur, blur(16px) saturate(1.2));
		border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12));
		color: var(--text-primary, #f8fafc);
		font-family: var(--font-sans, inherit);
		box-shadow: var(--shadow-xs, 0 1px 2px rgba(0, 0, 0, 0.05));
		transition:
			border-color 0.2s var(--ease-out),
			box-shadow 0.2s var(--ease-out),
			background 0.2s var(--ease-out);
		position: relative;
	}

	/* Sizes */
	.size-sm .select-btn {
		padding: 5px 8px;
		font-size: 0.75rem;
		border-radius: var(--radius-xs, 6px);
		min-height: 28px;
		gap: 6px;
	}

	.size-md .select-btn {
		padding: 9px 12px;
		font-size: 0.875rem;
		border-radius: var(--radius-sm, 10px);
		min-height: 38px;
		gap: 8px;
	}

	.size-lg .select-btn {
		padding: 12px 16px;
		font-size: 1rem;
		border-radius: var(--radius-md, 14px);
		min-height: 46px;
		gap: 10px;
	}

	.select-left-content {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.select-leading-icon {
		font-size: 1.1rem;
		color: var(--aero-sky, #2eb4ff);
		flex-shrink: 0;
	}

	.size-sm .select-leading-icon {
		font-size: 0.95rem;
	}

	.select-btn:hover:not(:disabled) {
		border-color: var(--aero-sky, #2eb4ff);
		background: var(--bg-surface-hover, rgba(30, 41, 59, 0.7));
		box-shadow: 0 0 0 2px rgba(46, 180, 255, 0.12);
	}

	.select-btn:focus-visible {
		outline: none;
		border-color: var(--aero-sky, #2eb4ff);
		box-shadow: 0 0 0 3px rgba(46, 180, 255, 0.25);
	}

	.select-btn.is-open {
		border-color: var(--aero-sky, #2eb4ff);
		box-shadow: 0 0 0 2px rgba(46, 180, 255, 0.2);
	}

	.select-value {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
	}

	.select-value.is-placeholder {
		color: var(--text-muted, #94a3b8);
		font-weight: 400;
	}

	.select-chevron {
		font-size: 1.2rem;
		color: var(--text-muted, #94a3b8);
		transition: transform 0.25s var(--ease-spring);
		flex-shrink: 0;
	}

	.size-sm .select-chevron {
		font-size: 1rem;
	}

	.select-chevron.rotated {
		transform: rotate(180deg);
		color: var(--aero-sky, #2eb4ff);
	}

	/* Dropdown menu container */
	.custom-select-menu {
		position: absolute;
		left: 0;
		width: 100%;
		min-width: 100%;
		max-height: 260px;
		overflow-y: auto;
		overscroll-behavior: contain;
		z-index: var(--z-dropdown, 100);
		background: var(--bg-surface, #0f172a);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12));
		border-top: 1px solid var(--glass-border-t, rgba(255, 255, 255, 0.45));
		border-radius: var(--radius-md, 14px);
		box-shadow:
			0 12px 36px rgba(0, 0, 0, 0.38),
			0 2px 8px rgba(0, 0, 0, 0.15),
			0 0 0 1px rgba(255, 255, 255, 0.05);
		display: flex;
		flex-direction: column;
		padding: 4px;
		gap: 2px;
	}

	/* Scrollbar styling */
	.custom-select-menu::-webkit-scrollbar {
		width: 5px;
	}

	.custom-select-menu::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.18);
		border-radius: 4px;
	}

	.custom-select-menu::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.custom-select-menu::-webkit-scrollbar-track {
		background: transparent;
	}

	.custom-select-menu.drop-down {
		top: calc(100% + 5px);
		animation: aeroSelectSlideDown 0.22s var(--ease-spring);
	}

	.custom-select-menu.drop-up {
		bottom: calc(100% + 5px);
		animation: aeroSelectSlideUp 0.22s var(--ease-spring);
	}

	@keyframes aeroSelectSlideDown {
		from {
			opacity: 0;
			transform: translateY(-6px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes aeroSelectSlideUp {
		from {
			opacity: 0;
			transform: translateY(6px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* Dropdown Item */
	.custom-select-item {
		background: transparent;
		border: none;
		color: var(--text-primary, #f8fafc);
		padding: 8px 10px;
		text-align: left;
		font-size: 0.875rem;
		cursor: pointer;
		transition:
			background 0.15s var(--ease-out),
			color 0.15s var(--ease-out);
		display: flex;
		align-items: center;
		gap: 8px;
		position: relative;
		border-radius: var(--radius-xs, 6px);
		width: 100%;
		font-family: var(--font-sans, inherit);
	}

	.size-sm .custom-select-item {
		padding: 5px 8px;
		font-size: 0.75rem;
	}

	.size-lg .custom-select-item {
		padding: 10px 14px;
		font-size: 0.95rem;
	}

	.item-icon {
		font-size: 1.1rem;
		color: var(--text-muted, #94a3b8);
		flex-shrink: 0;
		transition: color 0.15s ease;
	}

	.size-sm .item-icon {
		font-size: 0.9rem;
	}

	.item-text-wrap {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.item-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		line-height: 1.25;
	}

	.item-desc {
		font-size: 0.72rem;
		color: var(--text-secondary, #94a3b8);
		opacity: 0.8;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.custom-select-item:hover:not(.disabled),
	.custom-select-item.highlighted:not(.disabled) {
		background: rgba(27, 133, 243, 0.12);
		color: var(--text-primary, #ffffff);
	}

	.custom-select-item:hover:not(.disabled) .item-icon,
	.custom-select-item.highlighted:not(.disabled) .item-icon {
		color: var(--aero-sky, #2eb4ff);
	}

	.custom-select-item.selected {
		background: rgba(27, 133, 243, 0.18);
		color: var(--aero-blue, #1b85f3);
		font-weight: 600;
	}

	.custom-select-item.selected .item-icon {
		color: var(--aero-blue, #1b85f3);
	}

	.check-icon {
		font-size: 16px;
		color: var(--aero-blue, #1b85f3);
		flex-shrink: 0;
		animation: checkIn 0.2s var(--ease-spring);
	}

	.size-sm .check-icon {
		font-size: 14px;
	}

	@keyframes checkIn {
		from {
			opacity: 0;
			transform: scale(0.6);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.custom-select-item.disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
