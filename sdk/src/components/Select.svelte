<script lang="ts" generics="T extends string | number">
	type Option = { value: T; label: string };
	type Props = {
		value: T;
		options: Option[];
		disabled?: boolean;
		placeholder?: string;
		minWidth?: string;
		onchange?: (v: T) => void;
	};
	let {
		value = $bindable(),
		options,
		disabled = false,
		placeholder = 'Select...',
		minWidth = '160px',
		onchange
	}: Props = $props();

	let open = $state(false);
	let wrapperEl: HTMLDivElement | undefined = $state();
	let dropdownEl: HTMLDivElement | undefined = $state();
	let dropdownStyle = $state('');

	let selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? placeholder);

	function select(opt: Option) {
		value = opt.value;
		onchange?.(opt.value);
		open = false;
	}

	function toggle() {
		if (disabled) return;
		open = !open;
		if (open) requestAnimationFrame(clampToViewport);
	}

	function clampToViewport() {
		if (!dropdownEl || !wrapperEl) return;
		const rect = wrapperEl.getBoundingClientRect();
		const spaceBelow = window.innerHeight - rect.bottom - 8;
		const maxH = Math.min(280, spaceBelow);
		if (spaceBelow < 120) {
			dropdownStyle = `bottom: calc(100% + 4px); max-height: 280px;`;
		} else {
			dropdownStyle = `top: calc(100% + 4px); max-height: ${maxH}px;`;
		}
	}

	function handleClickOutside(e: MouseEvent) {
		if (wrapperEl && !wrapperEl.contains(e.target as Node)) open = false;
	}

	$effect(() => {
		if (open) document.addEventListener('click', handleClickOutside, true);
		else document.removeEventListener('click', handleClickOutside, true);
		return () => document.removeEventListener('click', handleClickOutside, true);
	});
</script>

<div class="z-dropdown-wrapper" style="min-width: {minWidth}" bind:this={wrapperEl}>
	<button class="z-dropdown-trigger" {disabled} onclick={toggle} type="button">
		<span class="z-dropdown-label">{selectedLabel}</span>
		<svg
			class="z-dropdown-chevron"
			class:open
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<polyline points="6 9 12 15 18 9" />
		</svg>
	</button>

	{#if open}
		<div class="z-dropdown-menu" style={dropdownStyle} bind:this={dropdownEl}>
			{#each options as opt}
				<button
					class="z-dropdown-option"
					class:active={value === opt.value}
					onclick={() => select(opt)}
					type="button"
				>
					{#if value === opt.value}
						<svg
							class="z-dropdown-check"
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<polyline points="20 6 9 17 4 12" />
						</svg>
					{:else}
						<span class="z-dropdown-spacer"></span>
					{/if}
					<span>{opt.label}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.z-dropdown-wrapper {
		position: relative;
	}
	.z-dropdown-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		width: 100%;
		height: 36px;
		padding: 0 12px;
		border-radius: var(--radius-md, 8px);
		border: 1px solid var(--border-default, #2a3142);
		background: var(--bg-elevated, #161a26);
		color: var(--text-primary, #e7eaf3);
		font-family: inherit;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 120ms ease;
	}
	.z-dropdown-trigger:hover:not(:disabled) {
		border-color: var(--border-strong, #3a4256);
		background: var(--bg-overlay, #1c2130);
	}
	.z-dropdown-trigger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.z-dropdown-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: left;
	}
	.z-dropdown-chevron {
		color: var(--text-muted, #8893a8);
		transition: transform 120ms ease;
		flex-shrink: 0;
	}
	.z-dropdown-chevron.open {
		transform: rotate(180deg);
	}
	.z-dropdown-menu {
		position: absolute;
		left: 0;
		right: 0;
		min-width: 160px;
		background: var(--bg-elevated, #161a26);
		border: 1px solid var(--border-default, #2a3142);
		border-radius: var(--radius-lg, 10px);
		padding: 4px;
		z-index: 1000;
		box-shadow: var(--shadow-lg, 0 10px 30px rgba(0, 0, 0, 0.45));
		overflow-y: auto;
		animation: zScaleIn 100ms ease;
	}
	.z-dropdown-option {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 12px;
		border-radius: var(--radius-sm, 6px);
		border: none;
		background: transparent;
		color: var(--text-secondary, #aab2c5);
		font-family: inherit;
		font-size: 13px;
		cursor: pointer;
		transition: all 120ms ease;
		text-align: left;
	}
	.z-dropdown-option:hover {
		background: var(--bg-hover, #1f2434);
		color: var(--text-primary, #e7eaf3);
	}
	.z-dropdown-option.active {
		color: var(--text-accent, #5eead4);
		background: var(--bg-active, #1a3c3a);
	}
	.z-dropdown-check {
		color: var(--text-accent, #5eead4);
		flex-shrink: 0;
	}
	.z-dropdown-spacer {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}
	@keyframes zScaleIn {
		from {
			opacity: 0;
			transform: translateY(-2px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
</style>
