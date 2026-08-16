<script>
	import { fade, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { uiStore } from '$lib/stores/ui.svelte.js';

	let confirmData = $derived(uiStore.confirmData);

	function handleConfirm() {
		if (confirmData?.onConfirm) {
			confirmData.onConfirm();
		}
	}

	function handleCancel() {
		uiStore.dismissConfirm();
	}

	function handleKeydown(e) {
		if (e.key === 'Escape' && confirmData) {
			handleCancel();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if confirmData}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="modal-backdrop confirm-backdrop"
		onclick={(e) => {
			if (e.target === e.currentTarget) handleCancel();
		}}
		transition:fade={{ duration: 150 }}
	>
		<div
			class="glass-card confirm-modal-card"
			transition:scale={{ duration: 250, start: 0.95, easing: backOut }}
		>
			<div class="confirm-header">
				<div class="confirm-icon-wrapper" class:danger={confirmData.danger}>
					<span class="material-icons-round">
						{confirmData.danger ? 'warning_amber' : 'help_outline'}
					</span>
				</div>
				<div class="confirm-text-group">
					<h3 class="confirm-title">{confirmData.title}</h3>
					{#if confirmData.message}
						<p class="confirm-message">{confirmData.message}</p>
					{/if}
				</div>
			</div>

			<div class="confirm-actions">
				<button type="button" class="btn-aero-secondary btn-sm" onclick={handleCancel}>
					{confirmData.cancelText || 'Cancelar'}
				</button>
				<button
					type="button"
					class={confirmData.danger ? 'btn-aero-danger btn-sm' : 'btn-aero-primary btn-sm'}
					onclick={handleConfirm}
				>
					{confirmData.confirmText || 'Confirmar'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.confirm-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(6px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}

	.confirm-modal-card {
		max-width: 420px;
		width: 100%;
		padding: 24px;
		border-radius: var(--radius-lg);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		box-shadow: var(--shadow-lg);
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.confirm-header {
		display: flex;
		align-items: flex-start;
		gap: 16px;
	}

	.confirm-icon-wrapper {
		width: 42px;
		height: 42px;
		border-radius: var(--radius-squircle);
		corner-shape: squircle;
		background: rgba(var(--accent-blue-rgb), 0.12);
		color: var(--accent-blue-base);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.confirm-icon-wrapper.danger {
		background: rgba(239, 68, 68, 0.12);
		color: #ef4444;
	}

	.confirm-icon-wrapper .material-icons-round {
		font-size: 1.4rem;
	}

	.confirm-text-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.confirm-title {
		font-size: 1.05rem;
		font-weight: 800;
		color: var(--text-main);
		margin: 0;
		line-height: 1.3;
	}

	.confirm-message {
		font-size: 0.8rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.45;
	}

	.confirm-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 12px;
		padding-top: 8px;
		border-top: 1px solid var(--border-subtle);
	}

	/* Theme Day Overrides */
	:global([data-theme='light']) .confirm-modal-card {
		background: #ffffff;
		border-color: rgba(0, 0, 0, 0.1);
		box-shadow: 0 20px 45px rgba(0, 40, 90, 0.15);
	}

	:global([data-theme='light']) .confirm-icon-wrapper {
		background: rgba(var(--accent-blue-rgb), 0.1);
		color: #0284c7;
	}

	:global([data-theme='light']) .confirm-icon-wrapper.danger {
		background: rgba(239, 68, 68, 0.1);
		color: #dc2626;
	}
</style>
