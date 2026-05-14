#!/usr/bin/env node
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { select, input } from '@inquirer/prompts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT ?? 5174);
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

	return { folder, previewPath: `/preview/index.html?theme=${slug}` };
}

async function scaffoldFeature({ slug, name, author, description, sidebarLabel }) {
	const folder = join(ROOT, 'features', slug);
	if (await exists(folder)) {
		throw new Error(`features/${slug} already exists. Pick a different slug.`);
	}
	await mkdir(join(folder, 'ui'), { recursive: true });

	const manifest = {
		id: slug,
		name,
		version: '1.0.0',
		type: 'feature',
		author: { name: author },
		description,
		icon: 'icon.svg',
		sidebarLabel,
		defaultInstalled: false,
		removable: true
	};
	await writeFile(join(folder, 'manifest.json'), JSON.stringify(manifest, null, '\t') + '\n');

	const ui = `<!DOCTYPE html>
<html>
	<head>
		<meta charset="UTF-8" />
		<style>
			body {
				font-family: system-ui, sans-serif;
				margin: 0;
				padding: 24px;
				background: transparent;
				color: #fff;
			}
			h1 { margin-top: 0; }
			.hint { color: #888; font-size: 13px; }
		</style>
	</head>
	<body>
		<h1>${name}</h1>
		<p class="hint">Edit <code>features/${slug}/ui/index.html</code> to start building your sidebar feature. The preview hot-reloads on refresh.</p>
	</body>
</html>
`;
	await writeFile(join(folder, 'ui', 'index.html'), ui);

	const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#78c8ff"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg>\n`;
	await writeFile(join(folder, 'icon.svg'), icon);

	return { folder, previewPath: `/preview/index.html?feature=${slug}` };
}

function spawnPreview(previewPath) {
	const proc = spawn(process.execPath, [join(ROOT, 'scripts/preview.mjs')], {
		stdio: 'inherit',
		env: { ...process.env, PORT: String(PORT) }
	});
	proc.on('exit', (code) => process.exit(code ?? 0));

	// Open the browser at the right path once the server has had a moment to bind.
	const url = `http://localhost:${PORT}${previewPath}`;
	setTimeout(() => {
		const opener =
			process.platform === 'win32'
				? ['cmd', ['/c', 'start', '""', url]]
				: process.platform === 'darwin'
					? ['open', [url]]
					: ['xdg-open', [url]];
		spawn(opener[0], opener[1], { stdio: 'ignore', detached: true }).unref();
	}, 400);

	return proc;
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

	console.log(`\n  ✔ Scaffolded ${result.folder}`);
	console.log(`  ✔ Starting preview on http://localhost:${PORT}${result.previewPath}\n`);

	spawnPreview(result.previewPath);
}

main().catch((err) => {
	if (err?.name === 'ExitPromptError') {
		console.log('\nCancelled.');
		process.exit(1);
	}
	console.error(err.message ?? err);
	process.exit(1);
});
