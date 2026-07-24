<script>
	import { onMount } from 'svelte';
	import { formatHashtags } from '$lib/utils/textFormatting.js';
	import { feed as feedApi } from '$lib/api.js';

	let {
		value = $bindable(''),
		placeholder = '',
		disabled = false,
		rows = 3,
		class: className = '',
		style = '',
		id = '',
		onkeydown = null
	} = $props();

	let textareaEl = $state(null);
	let backdropEl = $state(null);

	// Autocomplete state
	let allTags = $state([]);
	let showDropdown = $state(false);
	let dropdownOptions = $state([]);
	let activeIndex = $state(0);
	let cursorPosition = $state(0);
	let matchStart = $state(0);
	let matchEnd = $state(0);

	onMount(async () => {
		try {
			const data = await feedApi.trendingTags();
			allTags = (data.tags || []).map((t) => t.name);
		} catch (e) {
			console.error('Failed to load tags for autocomplete', e);
		}
	});

	function handleScroll() {
		if (textareaEl && backdropEl) {
			backdropEl.scrollTop = textareaEl.scrollTop;
			backdropEl.scrollLeft = textareaEl.scrollLeft;
		}
	}

	function handleInput(e) {
		value = e.target.value;
		checkAutocomplete();
	}

	function handleKeydownInternal(e) {
		if (showDropdown) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				activeIndex = (activeIndex + 1) % dropdownOptions.length;
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				activeIndex = (activeIndex - 1 + dropdownOptions.length) % dropdownOptions.length;
				return;
			}
			if (e.key === 'Enter' || e.key === 'Tab') {
				e.preventDefault();
				insertTag(dropdownOptions[activeIndex]);
				return;
			}
			if (e.key === 'Escape') {
				showDropdown = false;
				return;
			}
		}

		// Call parent onkeydown if provided
		if (onkeydown) {
			onkeydown(e);
		}

		// Defer check to allow cursor position to update on normal keys
		setTimeout(checkAutocomplete, 10);
	}

	function checkAutocomplete() {
		if (!textareaEl) return;
		cursorPosition = textareaEl.selectionStart;
		const textUpToCursor = value.substring(0, cursorPosition);

		// Match # followed by word characters at the end of the string
		const match = textUpToCursor.match(/(^|\s)#(\w*)$/);

		if (match) {
			const typed = match[2].toLowerCase();
			matchStart = cursorPosition - match[2].length;
			matchEnd = cursorPosition;

			// Filter options
			dropdownOptions = allTags.filter((t) => t.toLowerCase().includes(typed));

			if (dropdownOptions.length > 0) {
				showDropdown = true;
				activeIndex = 0;
			} else {
				showDropdown = false;
			}
		} else {
			showDropdown = false;
		}
	}

	function insertTag(tag) {
		const before = value.substring(0, matchStart);
		const after = value.substring(matchEnd);
		value = before + tag + ' ' + after;
		showDropdown = false;

		// Restore focus and cursor
		setTimeout(() => {
			if (textareaEl) {
				textareaEl.focus();
				const newPos = before.length + tag.length + 1;
				textareaEl.setSelectionRange(newPos, newPos);
			}
		}, 10);
	}

	// Add trailing space so textarea and backdrop always have same height
	let backdropContent = $derived.by(() => {
		let text = value || '';
		if (text.endsWith('\n')) text += ' ';
		return formatHashtags(text);
	});
</script>

<div class="hashtag-wrapper {className}" {style}>
	<div class="hashtag-backdrop" bind:this={backdropEl} aria-hidden="true">
		{@html backdropContent}
	</div>

	<textarea
		{id}
		bind:this={textareaEl}
		{value}
		{placeholder}
		{disabled}
		{rows}
		oninput={handleInput}
		onscroll={handleScroll}
		onkeydown={handleKeydownInternal}
		onclick={checkAutocomplete}
		onkeyup={checkAutocomplete}
		class="hashtag-input"
	></textarea>

	{#if showDropdown}
		<div class="autocomplete-dropdown glass-panel">
			{#each dropdownOptions as option, i}
				<button
					type="button"
					class="autocomplete-item {i === activeIndex ? 'active' : ''}"
					onmousedown={(e) => {
						e.preventDefault();
						insertTag(option);
					}}
				>
					<span class="text-primary font-bold mr-1">#</span>{option}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	/* ── Grid Shell ── */
	.hashtag-wrapper {
		padding: 0 !important;
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: 1fr;
		cursor: var(--cursor-text, text);
		position: relative;
	}

	/* ── Shared geometry for both layers ── */
	.hashtag-backdrop,
	.hashtag-input {
		grid-area: 1 / 1;
		padding: var(--hashtag-padding, 0.62rem 1rem);
		margin: 0;
		font-family: inherit;
		font-size: var(--hashtag-font-size, 0.92rem);
		line-height: var(--hashtag-line-height, 1.6);
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		white-space: pre-wrap;
		word-wrap: break-word;
		word-break: break-word;
		overflow-wrap: break-word;
		tab-size: 8;
		border: none;
		border-radius: inherit;
		outline: none;
		resize: none;
	}

	.hashtag-backdrop {
		z-index: 1;
		color: var(--text-primary);
		background: transparent;
		pointer-events: none;
		overflow: hidden;
	}

	.hashtag-input {
		z-index: 2;
		position: relative;
		color: transparent !important;
		caret-color: var(--text-primary) !important;
		background: transparent !important;
		cursor: var(--cursor-text, text) !important;
		overflow-y: auto;
		&::placeholder {
			color: var(--text-muted);
			opacity: 0.7;
		}
	}

	.hashtag-input::selection {
		background: rgba(34, 211, 238, 0.25);
		color: transparent;
	}

	/* ── Autocomplete Dropdown ── */
	.autocomplete-dropdown {
		position: absolute;
		bottom: calc(100% + 4px);
		left: 0;
		z-index: 50;
		width: 250px;
		max-height: 200px;
		overflow-y: auto;
		padding: 4px;
		border-radius: 12px;
		background: var(--bg-panel, rgba(15, 23, 42, 0.9));
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
	}

	.autocomplete-item {
		width: 100%;
		text-align: left;
		padding: 8px 12px;
		background: transparent;
		border: none;
		border-radius: 8px;
		color: var(--text-primary);
		font-size: 0.88rem;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.autocomplete-item.active,
	.autocomplete-item:hover {
		background: rgba(34, 211, 238, 0.15);
	}

	/* ── Fix text alignment drift ── */
	:global(.hashtag-backdrop .hashtag-link) {
		font-weight: inherit !important;
	}
</style>
