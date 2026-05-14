<script lang="ts">
	import type { Snippet } from 'svelte';
	type Props = {
		title: string;
		description?: string;
		control: Snippet;
	};
	let { title, description, control }: Props = $props();
</script>

<div class="z-row">
	<div class="z-row-text">
		<p class="z-row-title">{title}</p>
		{#if description}<p class="z-row-desc">{description}</p>{/if}
	</div>
	<div class="z-row-control">{@render control()}</div>
</div>

<style>
	.z-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-lg);
		padding: var(--space-md) 0;
		border-bottom: 1px solid var(--border-subtle);
	}
	.z-row:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}
	.z-row:first-child {
		padding-top: 0;
	}
	.z-row-text {
		flex: 1;
		min-width: 0;
	}
	.z-row-title {
		font-size: 14px;
		font-weight: 600;
		margin: 0 0 2px;
	}
	.z-row-desc {
		font-size: 12px;
		color: var(--text-muted);
		line-height: 1.5;
		margin: 0;
	}
	.z-row-control {
		display: flex;
		gap: var(--space-sm);
		flex-shrink: 0;
	}
</style>
