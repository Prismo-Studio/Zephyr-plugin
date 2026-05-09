#!/usr/bin/env node
// Validate every plugin folder under `examples/` (or a path passed as argv[2])
// against the rules Zephyr's plugin registry will enforce. Run as
// `node scripts/validate.mjs` or `node scripts/validate.mjs my-plugin`.

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KNOWN_TYPES = new Set(['feature', 'theme', 'game', 'mod']);

function fail(folder, msg) {
	console.error(`  ✗ ${folder}: ${msg}`);
	return false;
}

function ok(folder, msg) {
	console.log(`  ✓ ${folder}: ${msg}`);
}

async function exists(p) {
	try {
		await stat(p);
		return true;
	} catch {
		return false;
	}
}

function isSlug(s) {
	return typeof s === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(s);
}

function isSemver(s) {
	return typeof s === 'string' && /^\d+\.\d+\.\d+/.test(s);
}

async function validateFolder(folder) {
	const label = folder.replace(`${ROOT}/`, '');
	const manifestPath = join(folder, 'manifest.json');
	if (!(await exists(manifestPath))) {
		return fail(label, 'missing manifest.json');
	}
	let manifest;
	try {
		manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
	} catch (err) {
		return fail(label, `manifest.json is not valid JSON (${err.message})`);
	}

	let pass = true;
	const need = (cond, msg) => {
		if (!cond) {
			fail(label, msg);
			pass = false;
		}
	};

	need(isSlug(manifest.id), '`id` must be a lowercase slug (a-z, 0-9, hyphens)');
	need(typeof manifest.name === 'string' && manifest.name.length > 0, '`name` is required');
	need(isSemver(manifest.version), '`version` must look like 1.2.3');
	need(KNOWN_TYPES.has(manifest.type), `\`type\` must be one of ${[...KNOWN_TYPES].join(', ')}`);
	need(
		manifest.author && typeof manifest.author.name === 'string',
		'`author.name` is required'
	);
	need(typeof manifest.description === 'string', '`description` is required');

	// Type-specific checks
	switch (manifest.type) {
		case 'theme': {
			const entry = manifest.entry ?? 'theme.css';
			need(
				await exists(join(folder, entry)),
				`theme entry file "${entry}" not found in folder`
			);
			break;
		}
		case 'game': {
			const entry = manifest.entry ?? 'game.json';
			const entryPath = join(folder, entry);
			need(await exists(entryPath), `game entry file "${entry}" not found in folder`);
			if (await exists(entryPath)) {
				try {
					const game = JSON.parse(await readFile(entryPath, 'utf-8'));
					need(typeof game.name === 'string', `${entry}: \`name\` is required`);
					need(isSlug(game.slug), `${entry}: \`slug\` must be a lowercase slug`);
					need(
						game.modLoader && typeof game.modLoader.name === 'string',
						`${entry}: \`modLoader.name\` is required`
					);
				} catch (err) {
					fail(label, `${entry} is not valid JSON (${err.message})`);
					pass = false;
				}
			}
			break;
		}
		case 'mod': {
			need(typeof manifest.game === 'string', '`game` (target game slug) is required for mods');
			need(
				manifest.package && typeof manifest.package.url === 'string',
				'`package.url` is required for mods'
			);
			if (manifest.package?.sha256) {
				need(
					/^[a-f0-9]{64}$/i.test(manifest.package.sha256),
					'`package.sha256` must be 64 hex chars'
				);
			}
			break;
		}
		case 'feature': {
			// Features carry no asset; the runtime ships in the Zephyr binary.
			// Just verify the optional flags are well-typed if present.
			if ('defaultInstalled' in manifest) {
				need(
					typeof manifest.defaultInstalled === 'boolean',
					'`defaultInstalled` must be a boolean'
				);
			}
			if ('removable' in manifest) {
				need(typeof manifest.removable === 'boolean', '`removable` must be a boolean');
			}
			break;
		}
	}

	// Icon: optional (Zephyr falls back to a type icon), but if set and not an
	// Iconify id (`prefix:name`) or absolute URL, the file must exist locally.
	if (manifest.icon) {
		const isIconify = /^[a-z0-9-]+:[a-z0-9-]+$/i.test(manifest.icon);
		const isUrl = /^(https?:|\/)/.test(manifest.icon);
		if (!isIconify && !isUrl) {
			need(
				await exists(join(folder, manifest.icon)),
				`icon file "${manifest.icon}" not found in folder`
			);
		}
	}

	if (pass) ok(label, `valid ${manifest.type} plugin`);
	return pass;
}

// Default scan dirs: every type bucket (real registry plugins) plus
// examples/ (author scaffolds). Pass a single path to check just that folder.
const DEFAULT_PARENTS = ['themes', 'games', 'mods', 'features', 'examples'];

async function main() {
	const target = process.argv[2];
	let folders;
	if (target) {
		const abs = resolve(target);
		if (!(await exists(abs))) {
			console.error(`path does not exist: ${target}`);
			process.exit(2);
		}
		folders = [abs];
	} else {
		folders = [];
		for (const parent of DEFAULT_PARENTS) {
			const dir = join(ROOT, parent);
			if (!(await exists(dir))) continue;
			for (const e of await readdir(dir)) {
				if (e.startsWith('.')) continue;
				const p = join(dir, e);
				if ((await stat(p)).isDirectory()) folders.push(p);
			}
		}
	}

	if (folders.length === 0) {
		console.log('no plugin folders to validate');
		return;
	}

	console.log(`validating ${folders.length} plugin folder${folders.length === 1 ? '' : 's'}:`);
	let allPass = true;
	for (const f of folders) {
		const result = await validateFolder(f);
		if (!result) allPass = false;
	}
	process.exit(allPass ? 0 : 1);
}

await main();
