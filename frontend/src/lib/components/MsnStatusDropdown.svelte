<script>
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { clickOutside } from '$lib/actions/clickOutside.js';

	let isOpen = $state(false);

	const statuses = [
		{ id: 'online', label: 'En línea', icon: 'lens', color: 'var(--status-online)' },
		{ id: 'away', label: 'Inactivo', icon: 'bedtime', color: 'var(--status-away)' },
		{
			id: 'dnd',
			label: 'No molestar',
			sub: 'No recibirás notificaciones en el escritorio.',
			icon: 'do_not_disturb_on',
			color: 'var(--status-dnd)'
		},
		{
			id: 'invisible',
			label: 'Invisible',
			sub: 'Aparecerás sin conexión',
			icon: 'radio_button_unchecked',
			color: 'var(--status-invisible)'
		}
	];

	let currentStatusObj = $derived(statuses.find((s) => s.id === authStore.status) || statuses[0]);

	function toggle() {
		isOpen = !isOpen;
	}

	function close() {
		isOpen = false;
	}

	function selectStatus(id) {
		authStore.setStatus(id);
		close();
	}
</script>

<div class="msn-status-wrapper" use:clickOutside={close}>
	<!-- Current Status Toggle -->
	<button class="msn-status-toggle" onclick={toggle} aria-expanded={isOpen}>
		<span class="status-icon material-icons-round" style="color: {currentStatusObj.color};">
			{currentStatusObj.icon}
		</span>
		<span class="status-label">{currentStatusObj.label}</span>
		<span class="material-icons-round chevron">expand_more</span>
	</button>

	<!-- Dropdown Menu -->
	{#if isOpen}
		<div class="msn-status-menu">
			{#each statuses as s}
				<button
					class="msn-status-option {authStore.status === s.id ? 'active' : ''}"
					onclick={() => selectStatus(s.id)}
				>
					<span class="status-icon material-icons-round" style="color: {s.color};">
						{s.icon}
					</span>
					<div class="status-text">
						<span class="status-title">{s.label}</span>
						{#if s.sub}
							<span class="status-sub">{s.sub}</span>
						{/if}
					</div>
					<span class="material-icons-round chevron">chevron_right</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.msn-status-wrapper {
		position: relative;
		font-family: var(--font-sans);
		user-select: none;
	}

	.msn-status-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		background: transparent;
		border: none;
		color: var(--text-primary);
		cursor: pointer;
		padding: 4px 8px;
		border-radius: var(--radius-sm);
		transition: background 0.2s;
		font-size: 13px;
		font-weight: 500;
	}
	.msn-status-toggle:hover {
		background: rgba(0, 0, 0, 0.05);
	}

	.status-icon {
		font-size: 14px !important;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.chevron {
		font-size: 16px !important;
		color: var(--icon-muted);
		opacity: 0.7;
	}

	.msn-status-menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		min-width: 280px;
		background: var(--bg-surface);
		backdrop-filter: var(--glass-blur);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		padding: 6px 0;
		z-index: var(--z-dropdown);
		animation: popMenu 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	@keyframes popMenu {
		from {
			opacity: 0;
			transform: translateY(-8px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.msn-status-option {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		text-align: left;
		padding: 10px 16px;
		background: transparent;
		border: none;
		cursor: pointer;
		transition: background 0.15s;
		color: var(--text-primary);
	}

	.msn-status-option:hover {
		background: rgba(0, 0, 0, 0.04);
	}
	:global([data-theme='dark']) .msn-status-option:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	.status-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.status-title {
		font-size: 14px;
		font-weight: 500;
	}

	.status-sub {
		font-size: 11px;
		color: var(--text-secondary);
		opacity: 0.85;
	}
</style>
