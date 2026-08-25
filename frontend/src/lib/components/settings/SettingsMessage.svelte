<script>
	import { fade } from 'svelte/transition';

	let { message = { type: '', text: '' } } = $props();
</script>

{#if message.text}
	<div
		class="alert-box"
		class:success={message.type === 'success'}
		class:error={message.type === 'error'}
		in:fade={{ duration: 250 }}
		out:fade={{ duration: 200 }}
		role="status"
	>
		<span class="material-icons-round">
			{message.type === 'success' ? 'check_circle_outline' : 'error_outline'}
		</span>
		<span>{message.text}</span>
	</div>
{/if}
