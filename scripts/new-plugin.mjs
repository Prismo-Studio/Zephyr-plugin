#!/usr/bin/env node
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { select, input } from '@inquirer/prompts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIDEBAR_LABEL_MAX = 18;

function slugify(text) {
	return text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
}

async function exists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

async function scaffoldTheme({ slug, name, author, description }) {
	const folder = join(ROOT, 'themes', slug);
	if (await exists(folder)) {
		throw new Error(`themes/${slug} already exists. Pick a different slug.`);
	}
	await mkdir(folder, { recursive: true });

	const manifest = {
		id: slug,
		name,
		version: '1.0.0',
		type: 'theme',
		author: { name: author },
		description,
		icon: 'icon.svg',
		entry: 'theme.css'
	};
	await writeFile(join(folder, 'manifest.json'), JSON.stringify(manifest, null, '\t') + '\n');

	const css = `/* ${name} — Zephyr theme.
 * Override any CSS variable from Zephyr's app.css under :root[data-theme='${slug}'].
 * The preview applies this automatically when you load it via slug. */
:root[data-theme='${slug}'] {
	--bg-base: #0b1020;
	--bg-surface: #131a30;
	--bg-elevated: #1a2240;
	--bg-overlay: #232c52;
	--bg-hover: rgba(120, 200, 255, 0.08);
	--bg-active: rgba(120, 200, 255, 0.14);

	--border-subtle: rgba(120, 200, 255, 0.12);
	--border-default: rgba(120, 200, 255, 0.22);
	--border-strong: rgba(120, 200, 255, 0.4);
	--border-accent: rgba(120, 200, 255, 0.5);

	--text-primary: #f0f6ff;
	--text-secondary: #b0c4e0;
	--text-muted: #7a8aa8;
	--text-accent: #78c8ff;
	--text-inverse: #0b1020;

	--accent-300: #9fdbff;
	--accent-400: #78c8ff;
	--accent-500: #4aa8ff;
	--accent-600: #2080cc;
	--accent-700: #155a99;

	--success: #4ade80;
	--warning: #fbbf24;
	--error: #f87171;
	--info: #78c8ff;

	--glass-bg: rgba(26, 34, 64, 0.7);
	--glass-border: rgba(120, 200, 255, 0.18);
}
`;
	await writeFile(join(folder, 'theme.css'), css);

	const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#78c8ff"><circle cx="12" cy="12" r="10"/></svg>\n`;
	await writeFile(join(folder, 'icon.svg'), icon);

	return { folder, type: 'theme' };
}

async function scaffoldFeature({ slug, name, author, description, sidebarLabel }) {
	const folder = join(ROOT, 'features', slug);
	if (await exists(folder)) {
		throw new Error(`features/${slug} already exists. Pick a different slug.`);
	}
	await mkdir(join(folder, 'src'), { recursive: true });

	const manifest = {
		id: slug,
		name,
		version: '1.0.0',
		type: 'feature',
		author: { name: author },
		description,
		icon: 'icon.svg',
		sidebarLabel,
		entry: 'dist/index.html',
		defaultInstalled: false,
		removable: true
	};
	await writeFile(join(folder, 'manifest.json'), JSON.stringify(manifest, null, '\t') + '\n');

	const pkg = {
		name: `zephyr-plugin-${slug}`,
		private: true,
		type: 'module',
		scripts: {
			dev: 'vite build --watch --mode development',
			build: 'vite build'
		},
		devDependencies: {
			'@sveltejs/vite-plugin-svelte': '^5.0.3',
			svelte: '^5.20.0',
			typescript: '^5.7.0',
			vite: '^6.0.0',
			'vite-plugin-singlefile': '^2.0.0'
		}
	};
	await writeFile(join(folder, 'package.json'), JSON.stringify(pkg, null, '\t') + '\n');

	const viteConfig = `import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Inline plugin.js and plugin.css directly into dist/index.html. Tauri's
// asset:// protocol on Windows mishandles relative sub-resource URLs
// (drive letters get encoded weird), so shipping a single self-contained
// HTML file is the reliable path.
export default defineConfig({
	plugins: [svelte(), viteSingleFile()],
	base: './',
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		assetsInlineLimit: 100000000,
		cssCodeSplit: false,
		rollupOptions: {
			output: { inlineDynamicImports: true }
		}
	}
});
`;
	await writeFile(join(folder, 'vite.config.ts'), viteConfig);

	const tsconfig = {
		compilerOptions: {
			target: 'ES2022',
			module: 'ESNext',
			moduleResolution: 'bundler',
			strict: true,
			skipLibCheck: true,
			isolatedModules: true,
			verbatimModuleSyntax: true,
			types: ['svelte', 'vite/client']
		},
		include: ['src/**/*.ts', 'src/**/*.svelte']
	};
	await writeFile(join(folder, 'tsconfig.json'), JSON.stringify(tsconfig, null, '\t') + '\n');

	const indexHtml = `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<title>${name}</title>
	</head>
	<body>
		<div id="app"></div>
		<script type="module" src="/src/main.ts"></script>
	</body>
</html>
`;
	await writeFile(join(folder, 'index.html'), indexHtml);

	const mainTs = `import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
`;
	await writeFile(join(folder, 'src', 'main.ts'), mainTs);

	const zephyrTs = `// Tiny client for the Zephyr plugin bridge.
// Plugins talk to the host via postMessage; Zephyr replies with the same id.
let seq = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

window.addEventListener('message', (evt) => {
	const data = evt.data as { id?: number; result?: unknown; error?: string };
	if (typeof data?.id !== 'number') return;
	const cb = pending.get(data.id);
	if (!cb) return;
	pending.delete(data.id);
	if (data.error) cb.reject(new Error(data.error));
	else cb.resolve(data.result);
});

function call<T = unknown>(type: string, payload?: unknown): Promise<T> {
	return new Promise((resolve, reject) => {
		const id = ++seq;
		pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
		window.parent.postMessage({ id, type, payload }, '*');
		setTimeout(() => {
			if (pending.has(id)) {
				pending.delete(id);
				reject(new Error('Zephyr did not reply (open this plugin inside Zephyr)'));
			}
		}, 8000);
	});
}

export const zephyr = {
	storage: {
		get: <T = unknown>() => call<T>('zephyr.storage.get'),
		set: (value: unknown) => call<null>('zephyr.storage.set', { value })
	},
	openExternal: (url: string) => call<null>('zephyr.openExternal', { url }),
	notify: (message: string, opts?: { kind?: 'info' | 'error'; title?: string }) =>
		call<null>('zephyr.notify', { message, ...opts }),
	plugin: () =>
		call<{ id: string; name: string; version: string; dev: boolean }>('zephyr.plugin.info')
};
`;
	await writeFile(join(folder, 'src', 'zephyr.ts'), zephyrTs);

	const appSvelte = `<script lang="ts">
	import { zephyr } from './zephyr';
	import { onMount } from 'svelte';

	let info = $state<{ id: string; name: string; version: string; dev: boolean } | null>(null);
	let counter = $state(0);

	onMount(async () => {
		try {
			info = await zephyr.plugin();
			const saved = await zephyr.storage.get<{ counter?: number }>();
			if (saved && typeof saved.counter === 'number') counter = saved.counter;
		} catch {}
	});

	async function increment() {
		counter += 1;
		await zephyr.storage.set({ counter });
	}

	async function notify() {
		await zephyr.notify('Hello from ${name}', { title: '${name}' });
	}
</script>

<main>
	<header>
		<h1>${name}</h1>
		<p>${description}</p>
		{#if info?.dev}<span class="dev-badge">Dev mode · v{info.version}</span>{/if}
	</header>

	<section>
		<button onclick={increment}>Clicked {counter} times</button>
		<button onclick={notify}>Send a Zephyr toast</button>
	</section>
</main>

<style>
	main {
		font-family: system-ui, sans-serif;
		color: #eaf0f6;
		padding: 24px;
	}
	h1 { margin: 0 0 4px; font-size: 24px; }
	p { margin: 0; color: #8899aa; font-size: 13px; }
	.dev-badge {
		display: inline-block;
		margin-top: 8px;
		padding: 2px 8px;
		border-radius: 999px;
		background: rgba(168, 85, 247, 0.18);
		color: #c084fc;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.03em;
	}
	section { margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap; }
	button {
		padding: 10px 16px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(26, 255, 250, 0.08);
		color: #1afffa;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		font-family: inherit;
	}
	button:hover { border-color: rgba(26, 255, 250, 0.4); }
</style>
`;
	await writeFile(join(folder, 'src', 'App.svelte'), appSvelte);

	const gitignore = `node_modules/\ndist/\n`;
	await writeFile(join(folder, '.gitignore'), gitignore);

	const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#78c8ff"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg>\n`;
	await writeFile(join(folder, 'icon.svg'), icon);

	return { folder, type: 'feature' };
}

async function main() {
	const type = await select({
		message: 'What kind of plugin?',
		choices: [
			{ name: 'Theme — colors and visual style', value: 'theme' },
			{ name: 'Feature — adds a new item in the sidebar', value: 'feature' }
		]
	});

	const name = await input({
		message: 'Display name',
		validate: (v) => (v.trim().length > 0 ? true : 'Required')
	});

	const slugDefault = slugify(name);
	const slug = await input({
		message: 'Slug (folder name)',
		default: slugDefault,
		validate: (v) =>
			/^[a-z0-9-]+$/.test(v) ? true : 'Lowercase letters, digits and dashes only'
	});

	const author = await input({
		message: 'Your GitHub username',
		validate: (v) => (v.trim().length > 0 ? true : 'Required')
	});

	const description = await input({
		message: 'Short description',
		default: type === 'theme' ? `${name} theme.` : `${name} feature for Zephyr.`
	});

	let sidebarLabel;
	if (type === 'feature') {
		sidebarLabel = await input({
			message: `Sidebar label (max ${SIDEBAR_LABEL_MAX} chars)`,
			default: name.slice(0, SIDEBAR_LABEL_MAX),
			validate: (v) =>
				v.length === 0
					? 'Required'
					: v.length > SIDEBAR_LABEL_MAX
						? `Max ${SIDEBAR_LABEL_MAX} characters`
						: true
		});
	}

	const result =
		type === 'theme'
			? await scaffoldTheme({ slug, name, author, description })
			: await scaffoldFeature({ slug, name, author, description, sidebarLabel });

	console.log(`\n  ✔ Scaffolded ${result.folder}\n`);
	if (result.type === 'feature') {
		console.log('  Next steps:');
		console.log(`    1. cd ${result.folder}`);
		console.log('    2. pnpm install         (one-time install of Svelte/Vite)');
		console.log('    3. pnpm dev             (watch mode, rebuilds dist/ on save)');
		console.log('    4. Open Zephyr → Plugins → Dev Mode → Load plugin from disk');
		console.log(`    5. Pick the folder: ${result.folder}`);
		console.log('    6. Edit src/App.svelte — Vite rebuilds, Zephyr hot-reloads.\n');
	} else {
		console.log('  Next steps:');
		console.log('    1. Open Zephyr → Plugins → Dev Mode → Load plugin from disk');
		console.log(`    2. Pick the folder: ${result.folder}`);
		console.log('    3. Edit theme.css — Zephyr hot-reloads automatically.\n');
	}
}

main().catch((err) => {
	if (err?.name === 'ExitPromptError') {
		console.log('\nCancelled.');
		process.exit(1);
	}
	console.error(err.message ?? err);
	process.exit(1);
});
