// Client for the Zephyr plugin bridge.
// Plugins talk to the host via postMessage; Zephyr replies with the same id.

let seq = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

if (typeof window !== 'undefined') {
	window.addEventListener('message', (evt) => {
		const data = evt.data as { id?: number; result?: unknown; error?: string };
		if (typeof data?.id !== 'number') return;
		const cb = pending.get(data.id);
		if (!cb) return;
		pending.delete(data.id);
		if (data.error) cb.reject(new Error(data.error));
		else cb.resolve(data.result);
	});
}

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

export type PluginInfo = { id: string; name: string; version: string; dev: boolean };
export type PluginFile = { name: string; size: number; createdAt: number };

export const zephyr = {
	storage: {
		get: <T = unknown>() => call<T>('zephyr.storage.get'),
		set: (value: unknown) => call<null>('zephyr.storage.set', { value })
	},
	openExternal: (url: string) => call<null>('zephyr.openExternal', { url }),
	notify: (message: string, opts?: { kind?: 'info' | 'error'; title?: string }) =>
		call<null>('zephyr.notify', { message, ...opts }),
	plugin: () => call<PluginInfo>('zephyr.plugin.info'),
	fs: {
		writeBlob: async (filename: string, blob: Blob) => {
			const ab = await blob.arrayBuffer();
			const bytes = Array.from(new Uint8Array(ab));
			return call<string>('zephyr.fs.writeBlob', { filename, bytes });
		},
		list: (extension?: string) => call<PluginFile[]>('zephyr.fs.list', { extension }),
		delete: (filename: string) => call<null>('zephyr.fs.delete', { filename }),
		getUrl: (filename: string) => call<string>('zephyr.fs.getUrl', { filename }),
		openFolder: () => call<null>('zephyr.fs.openFolder')
	}
};
