<script>
	let { title = '', color = 'blue', size = 'md' } = $props();

	let sizeClass = $derived(
		size === 'xs'
			? 'badge--xs'
			: size === 'sm'
				? 'badge--sm'
				: size === 'lg'
					? 'badge--lg'
					: 'badge--md'
	);
</script>

<div class="user-title-badge color-{color} {sizeClass}" role="status" title="Título: {title}">
	{title}
</div>

<style>
	.user-title-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-radius: var(--radius-full, 9999px);
		border: 1px solid transparent;
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		white-space: nowrap;
		line-height: 1;
		user-select: none;
		cursor: default;
		transition:
			transform 0.2s var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
			box-shadow 0.2s var(--ease-out);
	}

	.user-title-badge:hover {
		transform: translateY(-1px) scale(1.02);
	}

	.badge--xs {
		font-size: 8.5px;
		height: 18px;
		padding: 0 6px;
	}

	.badge--sm {
		font-size: 10px;
		height: 22px;
		padding: 0 8px;
	}

	.badge--md {
		font-size: 11.5px;
		height: 26px;
		padding: 0 10px;
	}

	.badge--lg {
		font-size: 13px;
		height: 32px;
		padding: 0 14px;
	}

	/* ══ Dark / Midnight Defaults ══ */
	.color-blue {
		background: rgba(59, 130, 246, 0.2);
		border-color: rgba(96, 165, 250, 0.35);
		color: #93c5fd;
	}
	.color-green {
		background: rgba(16, 185, 129, 0.2);
		border-color: rgba(52, 211, 153, 0.35);
		color: #86efac;
	}
	.color-red {
		background: rgba(239, 68, 68, 0.2);
		border-color: rgba(248, 113, 113, 0.35);
		color: #fca5a5;
	}
	.color-yellow {
		background: rgba(245, 158, 11, 0.2);
		border-color: rgba(251, 191, 36, 0.35);
		color: #fde047;
	}
	.color-purple {
		background: rgba(13, 148, 136, 0.2);
		border-color: rgba(45, 212, 191, 0.35);
		color: #5eead4;
	}
	.color-cyan {
		background: rgba(6, 182, 212, 0.2);
		border-color: rgba(34, 211, 238, 0.35);
		color: #67e8f9;
	}
	.color-neon {
		background: rgba(14, 165, 233, 0.22);
		border-color: rgba(56, 189, 248, 0.45);
		color: #38bdf8;
		box-shadow: 0 0 10px rgba(56, 189, 248, 0.35);
	}

	/* ══ Light Theme High-Contrast Overrides ══ */
	:global([data-theme='light']) .color-blue {
		background: rgba(219, 234, 254, 0.9);
		border-color: rgba(59, 130, 246, 0.4);
		color: #1d4ed8;
	}
	:global([data-theme='light']) .color-green {
		background: rgba(209, 250, 229, 0.9);
		border-color: rgba(16, 185, 129, 0.4);
		color: #047857;
	}
	:global([data-theme='light']) .color-red {
		background: rgba(254, 226, 226, 0.9);
		border-color: rgba(239, 68, 68, 0.4);
		color: #b91c1c;
	}
	:global([data-theme='light']) .color-yellow {
		background: rgba(254, 243, 199, 0.9);
		border-color: rgba(245, 158, 11, 0.4);
		color: #b45309;
	}
	:global([data-theme='light']) .color-purple {
		background: rgba(204, 251, 241, 0.9);
		border-color: rgba(13, 148, 136, 0.4);
		color: #0f766e;
	}
	:global([data-theme='light']) .color-cyan {
		background: rgba(207, 250, 254, 0.9);
		border-color: rgba(6, 182, 212, 0.4);
		color: #0e7490;
	}
	:global([data-theme='light']) .color-neon {
		background: rgba(224, 242, 254, 0.95);
		border-color: rgba(14, 165, 233, 0.5);
		color: #0369a1;
		box-shadow: 0 1px 4px rgba(14, 165, 233, 0.2);
	}

	/* ══ Performance Modes ══ */
	:global([data-perf-mode='true']) .user-title-badge,
	:global([data-glass-blur='none']) .user-title-badge {
		backdrop-filter: none !important;
		-webkit-backdrop-filter: none !important;
	}

	:global([data-simplify-shadows='true']) .user-title-badge {
		box-shadow: none !important;
	}
</style>
