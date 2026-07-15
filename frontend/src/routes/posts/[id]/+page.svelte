<script>
	import PostCard from '$lib/components/PostCard.svelte';
	let { data } = $props();
</script>

<svelte:head>
	<title>Publicación | V-Social</title>
</svelte:head>

<div class="max-w-2xl mx-auto py-8 px-4 animate-fade-in">
	<PostCard post={data.post} />
</div>
