<script>
	/**
	 * Selector de emoticones MSN en rejilla, agrupado por categoría.
	 * Al hacer clic emite el código (p.ej. `(H)`) vía onSelect, que el
	 * composer inserta en el texto del mensaje.
	 */
	import { EMOTICON_LIST } from '$lib/data/msnEmoticons.js';

	let { onSelect, variant = 'absolute' } = $props();

	const CATS = [
		{ id: 'caras', label: 'Caras' },
		{ id: 'gestos', label: 'Gestos' },
		{ id: 'amor', label: 'Amor' },
		{ id: 'animales', label: 'Animales' },
		{ id: 'comida', label: 'Comida' },
		{ id: 'objetos', label: 'Objetos' },
		{ id: 'mundo', label: 'Mundo' }
	];

	let activeCat = $state('caras');

	const byCat = $derived(EMOTICON_LIST.filter((e) => e.cat === activeCat));
</script>

<div class="msn-picker" class:variant-inline={variant === 'inline'}>
	<div class="msn-picker-tabs" role="tablist">
		{#each CATS as c}
			<button
				type="button"
				class="msn-cat-tab"
				class:active={activeCat === c.id}
				role="tab"
				aria-selected={activeCat === c.id}
				title={c.label}
				onclick={() => (activeCat = c.id)}
			>
				{c.label}
			</button>
		{/each}
	</div>

	<div class="msn-picker-grid">
		{#each byCat as e (e.code)}
			<button
				type="button"
				class="msn-emoticon-btn"
				title="{e.label} — {e.code}"
				aria-label="{e.label} ({e.code})"
				onclick={() => onSelect?.(e.code)}
			>
				<img src="/emoticons/{e.file}" alt={e.label} loading="lazy" decoding="async" />
			</button>
		{/each}
	</div>
</div>

<style>
	.msn-picker {
		position: absolute;
		bottom: 100%;
		left: 0;
		margin-bottom: 8px;
		width: 320px;
		max-width: 90vw;
		background: var(--surface, #fff);
		border: 1px solid var(--glass-border-t, rgba(0, 0, 0, 0.12));
		border-radius: var(--radius-sm, 10px);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22);
		z-index: 60;
		overflow: hidden;
	}

	.msn-picker.variant-inline {
		position: relative;
		bottom: auto;
		left: auto;
		margin-bottom: 0;
		width: 100%;
		box-shadow: none;
		background: transparent !important;
		border: none;
	}

	.msn-picker-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 6px;
		border-bottom: 1px solid var(--border-subtle);
		background: transparent;
	}

	.msn-cat-tab {
		flex: 1 1 auto;
		padding: 4px 8px;
		font-size: 0.72rem;
		font-weight: 600;
		border: none;
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		white-space: nowrap;
	}

	.msn-cat-tab:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
	}

	.msn-cat-tab.active {
		background: rgba(255, 255, 255, 0.15);
		color: var(--text-main);
	}

	.msn-picker-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 6px;
		padding: 8px;
		max-height: 220px;
		overflow-y: auto;
	}

	.msn-emoticon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
		border: none;
		background: transparent;
		border-radius: var(--radius-xs, 6px);
		cursor: pointer;
		transition:
			transform 0.1s ease,
			background 0.1s ease;
	}

	.msn-emoticon-btn:hover {
		background: rgba(255, 255, 255, 0.15);
		transform: scale(1.15);
	}

	.msn-emoticon-btn img {
		width: 26px;
		height: 26px;
		object-fit: contain;
	}
</style>
