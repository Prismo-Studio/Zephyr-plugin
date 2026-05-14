<script lang="ts">
	type Props = {
		checked: boolean;
		disabled?: boolean;
		ariaLabel?: string;
		onchange?: (v: boolean) => void;
	};
	let { checked = $bindable(), disabled = false, ariaLabel, onchange }: Props = $props();

	function toggle() {
		if (disabled) return;
		const next = !checked;
		checked = next;
		onchange?.(next);
	}
</script>

<button
	type="button"
	class="z-toggle"
	class:on={checked}
	class:disabled
	{disabled}
	role="switch"
	aria-checked={checked}
	aria-label={ariaLabel}
	onclick={toggle}
></button>

<style>
	.z-toggle {
		width: 42px;
		height: 24px;
		border-radius: 999px;
		background: var(--bg-overlay);
		border: 1px solid var(--border-default);
		position: relative;
		cursor: pointer;
		flex-shrink: 0;
		padding: 0;
		transition: background var(--transition-fast), border-color var(--transition-fast);
	}
	.z-toggle::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--text-muted);
		transition: transform var(--transition-fast), background var(--transition-fast);
	}
	.z-toggle.on {
		background: var(--accent-400);
		border-color: var(--accent-400);
	}
	.z-toggle.on::after {
		transform: translateX(18px);
		background: var(--text-inverse);
	}
	.z-toggle.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
