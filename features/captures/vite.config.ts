import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `viteSingleFile` inlines plugin.js and plugin.css directly into
// dist/index.html. Tauri's asset:// protocol on Windows mishandles
// relative sub-resource URLs when the path contains a drive letter, so
// shipping a single HTML file with everything embedded sidesteps the
// problem entirely.
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
