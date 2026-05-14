<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'danger' | 'secondary' | 'ghost';
	type Size = 'sm' | 'md';
	type Props = {
		variant?: Variant;
		size?: Size;
		disabled?: boolean;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
	};
	let {
		variant = 'secondary',
		size = 'md',
		disabled = false,
		onclick,
		children
	}: Props = $props();
</script>

<button
	type="button"
	class="z-btn z-btn-{variant} z-btn-{size}"
	{disabled}
	onclick={(e) => !disabled && onclick?.(e)}
>
	{@render children()}
</button>

<style>
	.z-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-default);
		background: var(--bg-elevated);
		color: var(--text-primary);
		font-family: inherit;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-fast);
		white-space: nowrap;
	}
	.z-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.z-btn-sm {
		padding: 6px 12px;
		font-size: 12px;
	}
	.z-btn-md {
		padding: 8px 16px;
		font-size: 13px;
	}

	.z-btn-primary {
		background: linear-gradient(135deg, var(--accent-400), var(--accent-600));
		border-color: transparent;
		color: var(--text-inverse);
	}
	.z-btn-primary:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.z-btn-danger {
		background: linear-gradient(135deg, var(--error), #c53030);
		border-color: transparent;
		color: #fff;
	}
	.z-btn-danger:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.z-btn-secondary:hover:not(:disabled) {
		border-color: var(--border-strong);
	}

	.z-btn-ghost {
		background: transparent;
		border-color: transparent;
		color: var(--text-secondary);
	}
	.z-btn-ghost:hover:not(:disabled) {
		background: var(--bg-hover);
		color: var(--text-primary);
	}
</style>
