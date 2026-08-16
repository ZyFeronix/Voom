<script>
	let { onSelect, onClose, variant = 'absolute' } = $props();

	const EMOJI_CATEGORIES = [
		{
			name: 'Sonrisas',
			icon: '😀',
			emojis: [
				'😀',
				'😃',
				'😄',
				'😁',
				'😆',
				'😅',
				'😂',
				'🤣',
				'🥲',
				'😊',
				'😇',
				'🙂',
				'🙃',
				'😉',
				'😌',
				'😍',
				'🥰',
				'😘',
				'😗',
				'😙',
				'😚',
				'😋',
				'😛',
				'😝',
				'😜',
				'🤪',
				'🤨',
				'🧐',
				'🤓',
				'😎',
				'🥸',
				'🤩',
				'🥳',
				'😏',
				'😒',
				'😞',
				'😔',
				'😟',
				'😕',
				'🙁',
				'☹️',
				'😣',
				'😖',
				'😫',
				'😩',
				'🥺',
				'😢',
				'😭',
				'😤',
				'😠',
				'😡',
				'🤬',
				'🤯',
				'😳',
				'🥵',
				'🥶',
				'😱',
				'😨',
				'😰',
				'😥',
				'😓',
				'🤗',
				'🤔',
				'🤭',
				'🤫',
				'🤥',
				'😶',
				'😐',
				'😑',
				'😬',
				'🙄',
				'😯',
				'😦',
				'😧',
				'😮',
				'😲',
				'🥱',
				'😴',
				'🤤',
				'😪',
				'😵',
				'🤐',
				'🥴',
				'🤢',
				'🤮',
				'🤧',
				'😷',
				'🤒',
				'🤕',
				'🤑',
				'🤠',
				'😈',
				'👿',
				'👹',
				'👺',
				'🤡',
				'💩',
				'👻',
				'💀',
				'☠️',
				'👽',
				'👾',
				'🤖',
				'🎃',
				'😺',
				'😸',
				'😹',
				'😻',
				'😼',
				'😽',
				'🙀',
				'😿',
				'😾'
			]
		},
		{
			name: 'Gestos',
			icon: '👋',
			emojis: [
				'👋',
				'🤚',
				'🖐',
				'✋',
				'🖖',
				'👌',
				'🤌',
				'🤏',
				'✌️',
				'🤞',
				'🤟',
				'🤘',
				'🤙',
				'👈',
				'👉',
				'👆',
				'🖕',
				'👇',
				'☝️',
				'👍',
				'👎',
				'✊',
				'👊',
				'🤛',
				'🤜',
				'👏',
				'🙌',
				'👐',
				'🤲',
				'🤝',
				'🙏',
				'✍️',
				'💅',
				'🤳',
				'💪',
				'🦾',
				'🦿',
				'🦵',
				'🦶',
				'👂',
				'🦻',
				'👃',
				'🧠',
				'🫀',
				'🫁',
				'🦷',
				'🦴',
				'👀',
				'👁',
				'👅',
				'👄',
				'💋',
				'🩸'
			]
		},
		{
			name: 'Corazones',
			icon: '❤️',
			emojis: [
				'❤️',
				'🧡',
				'💛',
				'💚',
				'💙',
				'💜',
				'🖤',
				'🤍',
				'🤎',
				'💔',
				'❤️‍🔥',
				'❤️‍🩹',
				'❣️',
				'💕',
				'💞',
				'💓',
				'💗',
				'💖',
				'💘',
				'💝'
			]
		}
	];

	let activeTab = $state(0);

	function handleSelect(emoji) {
		if (onSelect) onSelect(emoji);
	}
</script>

<div
	class="emoji-picker {variant === 'inline' ? 'variant-inline' : ''}"
	role="presentation"
	onclick={(e) => e.stopPropagation()}
	onkeydown={(e) => e.stopPropagation()}
	onwheel={(e) => e.stopPropagation()}
>
	<!-- Tabs -->
	<div class="tabs-container">
		{#each EMOJI_CATEGORIES as cat, i}
			<button
				type="button"
				class="tab-btn"
				class:active={activeTab === i}
				onclick={() => (activeTab = i)}
				title={cat.name}
				aria-label={cat.name}
			>
				<span class="tab-icon">{cat.icon}</span>
			</button>
		{/each}
		<div style="flex: 1;"></div>
		{#if onClose}
			<button type="button" class="close-btn" onclick={onClose} title="Cerrar">
				<span class="material-icons-round" style="font-size:16px">close</span>
			</button>
		{/if}
	</div>

	<!-- Grid -->
	<div class="emoji-grid custom-scrollbar" onwheel={(e) => e.stopPropagation()}>
		{#each EMOJI_CATEGORIES[activeTab].emojis as emoji}
			<button
				type="button"
				class="emoji-btn"
				onclick={() => handleSelect(emoji)}
				title={emoji}
				aria-label={emoji}
			>
				<span class="emoji-glyph">{emoji}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.emoji-picker {
		position: absolute;
		bottom: 100%;
		right: 0;
		margin-bottom: 8px;
		width: 280px;
		max-width: 100%;
		padding: 12px;
		z-index: 1000;
		box-sizing: border-box;
		background: var(--bg-sidebar) !important;
		backdrop-filter: var(--glass-blur) !important;
		-webkit-backdrop-filter: var(--glass-blur) !important;
		border: 1px solid var(--glass-border-t, rgba(255, 255, 255, 0.1));
		border-radius: var(--radius-lg, 16px);
		box-shadow: 0 4px 16px rgba(46, 134, 232, 0.06);
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	:global([data-theme='light']) .emoji-picker {
		background: linear-gradient(
			90deg,
			rgba(16, 185, 129, 0.25) 0%,
			rgba(14, 165, 233, 0.35) 100%
		) !important;
		box-shadow:
			0 4px 16px rgba(16, 185, 129, 0.12),
			0 1px 0 rgba(255, 255, 255, 0.6) inset;
	}
	.emoji-picker.variant-inline {
		position: relative;
		bottom: auto;
		right: auto;
		margin-bottom: 0;
		width: 100%;
		max-width: 100%;
		padding: 0;
		box-sizing: border-box;
		z-index: 1;
		box-shadow: none;
		background: transparent !important;
		backdrop-filter: none !important;
		-webkit-backdrop-filter: none !important;
		border: none;
	}
	:global([data-theme='light']) .emoji-picker.variant-inline {
		background: transparent !important;
		box-shadow: none;
	}
	.tabs-container {
		display: flex;
		gap: 6px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--border-subtle);
		align-items: center;
		flex-shrink: 0;
	}
	.tab-btn {
		background: transparent;
		border: none;
		padding: 6px 10px;
		border-radius: var(--radius-sm, 8px);
		cursor: pointer;
		transition: background var(--t-fast);
		line-height: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.tab-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}
	.tab-btn.active {
		background: rgba(255, 255, 255, 0.15);
		box-shadow: var(--shadow-sm);
	}
	.tab-icon {
		font-size: 20px;
		font-family: 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif;
		display: block;
		pointer-events: none;
		line-height: 1;
	}
	.close-btn {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background var(--t-fast),
			color var(--t-fast);
	}
	.close-btn:hover {
		background: rgba(255, 0, 0, 0.1);
		color: var(--rose-500, #f43f5e);
	}
	.emoji-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
		justify-items: center;
		gap: 6px;
		max-height: 210px;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 4px 6px 8px 4px;
		box-sizing: border-box;
		scrollbar-gutter: stable;
	}
	.emoji-grid::-webkit-scrollbar {
		width: 6px;
	}
	.emoji-grid::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.1);
		border-radius: var(--radius-sm);
	}
	.emoji-grid::-webkit-scrollbar-thumb {
		background: rgba(14, 165, 233, 0.3);
		border-radius: var(--radius-sm);
	}
	.emoji-grid::-webkit-scrollbar-thumb:hover {
		background: rgba(14, 165, 233, 0.5);
	}
	.emoji-btn {
		width: 36px;
		height: 36px;
		min-width: 36px;
		min-height: 36px;
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 0;
		border-radius: var(--radius-sm, 8px);
		transition:
			transform 0.15s var(--ease-spring),
			background var(--t-fast);
		display: flex;
		justify-content: center;
		align-items: center;
		line-height: 1;
		box-sizing: border-box;
	}
	.emoji-btn:hover {
		background: rgba(255, 255, 255, 0.12);
		transform: scale(1.18);
		z-index: 2;
	}
	.emoji-glyph {
		font-size: 22px;
		font-family: 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		line-height: 1;
		user-select: none;
	}
</style>
