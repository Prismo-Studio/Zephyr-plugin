<script lang="ts">
	type Tone = 'idle' | 'success' | 'error' | 'warning';
	type Props = {
		label: string;
		tone?: Tone;
		pulse?: boolean;
	};
	let { label, tone = 'idle', pulse = false }: Props = $props();
</script>

<span class="z-pill z-pill-{tone}" class:pulse>
	<span class="dot"></span>
	{label}
</span>

<style>
	.z-pill {
		display: inline-flex;
		align-items: center;
		gap: var(--space-sm);
		padding: 6px 14px;
		border-radius: var(--radius-full);
		font-size: 12px;
		font-weight: 600;
		background: var(--bg-elevated);
		border: 1px solid var(--border-subtle);
		color: var(--text-secondary);
		font-variant-numeric: tabular-nums;
	}
	.z-pill .dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-muted);
	}
	.z-pill-success {
		border-color: rgba(0, 212, 170, 0.4);
		color: var(--success);
		background: rgba(0, 212, 170, 0.08);
	}
	.z-pill-success .dot {
		background: var(--success);
	}
	.z-pill-error {
		border-color: rgba(255, 92, 92, 0.4);
		color: var(--error);
		background: rgba(255, 92, 92, 0.08);
	}
	.z-pill-error .dot {
		background: var(--error);
	}
	.z-pill-warning {
		border-color: rgba(255, 179, 71, 0.4);
		color: var(--warning);
		background: rgba(255, 179, 71, 0.08);
	}
	.z-pill-warning .dot {
		background: var(--warning);
	}
	.pulse .dot {
		animation: zpulse 1.2s ease-in-out infinite;
	}
	@keyframes zpulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.45; transform: scale(0.85); }
	}
</style>
