<script lang="ts">
	type Props = {
		label: string;
		value: string | number;
	};
	let { label, value }: Props = $props();
</script>

<div class="z-stat">
	<div class="z-stat-label">{label}</div>
	<div class="z-stat-value">{value}</div>
</div>

<style>
	.z-stat {
		padding: var(--space-lg);
		border-radius: var(--radius-lg);
		background: var(--bg-elevated);
		border: 1px solid var(--border-subtle);
	}
	.z-stat-label {
		font-size: 11px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 700;
		margin-bottom: var(--space-sm);
	}
	.z-stat-value {
		font-size: 20px;
		font-weight: 700;
		color: var(--text-primary);
		font-family: var(--font-display);
		font-variant-numeric: tabular-nums;
	}
</style>
