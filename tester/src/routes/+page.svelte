<script lang="ts">
	import { open } from '@tauri-apps/plugin-dialog';
	import Icon from '@iconify/svelte';
	import { goto } from '$app/navigation';
	import Header from '$lib/components/layout/Header.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import * as api from '$lib/api';
	import plugins from '$lib/state/plugins.svelte';
	import type { Plugin } from '$lib/types';

	let busy = $state(false);
	let error: string | null = $state(null);
	let loaded: Plugin | null = $state(null);

	async function pickFolder() {
		busy = true;
		error = null;
		try {
			const folder = await open({
				directory: true,
				multiple: false,
				title: 'Pick a plugin folder'
			});
			if (typeof folder !== 'string') return;

			const plugin = await api.plugins.addLocalPlugin(folder);
			loaded = plugin;

			// Themes auto-install: the whole point of the tester is seeing the
			// theme apply in real Zephyr UI without an extra click.
			if (plugin.kind === 'theme' && !plugin.enabled) {
				await plugins.install(plugin.id);
			}

			// Refresh state so the plugin browser and theme picker pick it up.
			await plugins.refresh();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			busy = false;
		}
	}
</script>

<div class="zpt-page">
	<Header
		title="Plugin Tester"
		subtitle="Load a local plugin folder and preview it in real Zephyr UI"
	/>

	<div class="zpt-content">
		<section class="zpt-hero">
			<div class="zpt-hero-icon">
				<Icon icon="mdi:test-tube" />
			</div>
			<div class="zpt-hero-body">
				<h2>Open a plugin folder</h2>
				<p>
					Pick a folder containing <code>manifest.json</code> and the entry asset
					(<code>theme.css</code>, <code>game.json</code>, etc.). Theme plugins install and apply
					automatically. Then navigate to <strong>Plugins</strong> or
					<strong>Settings → Appearance</strong> to see the result in real Zephyr UI.
				</p>
				<div class="zpt-actions">
					<Button variant="primary" onclick={pickFolder} loading={busy}>
						<Icon icon="mdi:folder-open" />
						Open plugin folder
					</Button>
					{#if loaded}
						<Button variant="ghost" onclick={() => goto('/plugins')}>
							<Icon icon="mdi:puzzle" /> View in Plugin Browser
						</Button>
						{#if loaded.kind === 'theme'}
							<Button variant="ghost" onclick={() => goto('/prefs')}>
								<Icon icon="mdi:palette" /> Open Theme Picker
							</Button>
						{/if}
					{/if}
				</div>
			</div>
		</section>

		{#if error}
			<div class="zpt-error">
				<Icon icon="mdi:alert-circle" />
				{error}
			</div>
		{/if}

		{#if loaded}
			<section class="zpt-loaded">
				<h3 class="zpt-section-title">Loaded plugin</h3>
				<article class="zpt-card">
					<div class="zpt-card-icon">
						{#if /^[a-z0-9-]+:[a-z0-9-]+$/i.test(loaded.icon)}
							<Icon icon={loaded.icon} />
						{:else}
							<img src={loaded.icon} alt="" />
						{/if}
					</div>
					<div class="zpt-card-body">
						<h4>{loaded.name}</h4>
						<p class="zpt-card-meta">v{loaded.version} by {loaded.author}</p>
						<div class="zpt-badges">
							<span class="zpt-badge">{loaded.kind}</span>
							{#if loaded.enabled}<span class="zpt-badge zpt-badge-success">Installed</span>{/if}
						</div>
						<p class="zpt-card-desc">{loaded.description}</p>
					</div>
				</article>
			</section>
		{/if}

		<section class="zpt-tips">
			<h3 class="zpt-section-title">Tips</h3>
			<ul>
				<li>
					This is a slim Zephyr clone — every page (Plugins, Settings, Browse) renders the same
					components Zephyr ships, so what you see here is what you get in production.
				</li>
				<li>
					Local plugins survive registry refreshes; they vanish on app restart since they aren't
					in the upstream registry.
				</li>
				<li>
					To uninstall a local theme, go to the Plugins page and hit Uninstall — the on-disk
					copy is removed and the active theme falls back to <code>dark</code>.
				</li>
			</ul>
		</section>
	</div>
</div>

<style>
	.zpt-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	.zpt-content {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-xl);
		max-width: 960px;
		width: 100%;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xl);
	}

	.zpt-hero {
		display: grid;
		grid-template-columns: 96px 1fr;
		gap: var(--space-xl);
		align-items: start;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		padding: var(--space-xl);
	}

	.zpt-hero-icon {
		width: 96px;
		height: 96px;
		display: grid;
		place-items: center;
		background: var(--bg-elevated);
		color: var(--text-accent);
		border-radius: var(--radius-md);
		font-size: 48px;
		box-shadow: var(--shadow-glow);
	}

	.zpt-hero-body h2 {
		margin: 0 0 var(--space-sm);
		font-family: var(--font-display);
		font-size: 22px;
		letter-spacing: -0.02em;
	}

	.zpt-hero-body p {
		margin: 0 0 var(--space-md);
		color: var(--text-secondary);
		font-size: 14px;
	}

	.zpt-hero-body code {
		font-family: var(--font-mono);
		font-size: 12px;
		background: var(--bg-elevated);
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		color: var(--text-accent);
	}

	.zpt-actions {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.zpt-error {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		background: color-mix(in srgb, var(--error) 15%, transparent);
		color: var(--error);
		border: 1px solid color-mix(in srgb, var(--error) 35%, transparent);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		font-size: 13px;
	}

	.zpt-section-title {
		margin: 0 0 var(--space-md);
		font-family: var(--font-display);
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-muted);
	}

	.zpt-card {
		display: grid;
		grid-template-columns: 64px 1fr;
		gap: var(--space-md);
		padding: var(--space-lg);
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
	}

	.zpt-card-icon {
		width: 64px;
		height: 64px;
		display: grid;
		place-items: center;
		background: var(--bg-elevated);
		color: var(--text-accent);
		border-radius: var(--radius-md);
		font-size: 28px;
		overflow: hidden;
	}

	.zpt-card-icon img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.zpt-card-body h4 {
		margin: 0 0 4px;
		font-family: var(--font-display);
		font-size: 16px;
	}

	.zpt-card-meta {
		margin: 0;
		font-size: 12px;
		color: var(--text-muted);
	}

	.zpt-badges {
		display: flex;
		gap: 6px;
		margin: 6px 0;
	}

	.zpt-badge {
		padding: 2px 8px;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		border-radius: var(--radius-sm);
		background: var(--bg-elevated);
		color: var(--text-muted);
	}

	.zpt-badge-success {
		background: color-mix(in srgb, var(--success) 15%, transparent);
		color: var(--success);
	}

	.zpt-card-desc {
		margin: 6px 0 0;
		font-size: 13px;
		color: var(--text-secondary);
	}

	.zpt-tips ul {
		margin: 0;
		padding-left: 20px;
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.6;
	}

	.zpt-tips code {
		font-family: var(--font-mono);
		background: var(--bg-elevated);
		padding: 1px 6px;
		border-radius: var(--radius-sm);
		color: var(--text-accent);
		font-size: 12px;
	}
</style>
