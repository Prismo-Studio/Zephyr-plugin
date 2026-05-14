<script lang="ts">
	import type { Snippet } from 'svelte';
	type Props = {
		title?: string;
		actions?: Snippet;
		children: Snippet;
	};
	let { title, actions, children }: Props = $props();
</script>

<section class="z-card">
	{#if title || actions}
		<header class="z-card-head">
			{#if title}<h3 class="z-card-title">{title}</h3>{/if}
			{#if actions}<div class="z-card-actions">{@render actions()}</div>{/if}
		</header>
	{/if}
	{@render children()}
</section>

<style>
	.z-card {
		background: var(--bg-elevated);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		padding: var(--space-lg) var(--space-xl);
	}
	.z-card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-sm);
	}
	.z-card-title {
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
		margin: 0;
	}
	.z-card-actions {
		display: flex;
		gap: var(--space-sm);
	}
</style>
