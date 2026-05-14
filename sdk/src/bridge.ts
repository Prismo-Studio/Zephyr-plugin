// Client for the Zephyr plugin bridge.
// Plugins talk to the host via postMessage; Zephyr replies with the same id.

let seq = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
const eventListeners = new Map<string, Set<(payload: unknown) => void>>();

function applyThemeTokens(tokens: Record<string, string>) {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	for (const [key, value] of Object.entries(tokens)) {
		if (typeof value === 'string' && value) {
			root.style.setProperty(`--${key}`, value);
		}
	}
}

if (typeof window !== 'undefined') {
	window.addEventListener('message', (evt) => {
		const data = evt.data as {
			id?: number;
			result?: unknown;
			error?: string;
			type?: string;
			event?: string;
			payload?: unknown;
		};
		if (data?.type === 'zephyr.event' && typeof data.event === 'string') {
			if (data.event === 'theme.changed' && data.payload && typeof data.payload === 'object') {
				applyThemeTokens(data.payload as Record<string, string>);
			}
			const set = eventListeners.get(data.event);
			if (set) for (const cb of set) cb(data.payload);
			return;
		}
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

export type GameInfo = { id: string; name: string };
export type ActiveProfile = { id: number; name: string };
export type GameLaunchedEvent = { gameId: string; gameName: string };
export type GameExitedEvent = { gameId: string; gameName: string };
export type ProfileSwitchedEvent = {
	id: number;
	name: string;
	profileName?: string;
	profileIndex?: number;
};
export type LocaleChangedEvent = { locale: string };

export type ZephyrEventMap = {
	'game.launched': GameLaunchedEvent;
	'game.exited': GameExitedEvent;
	'game.changed': GameInfo;
	'profile.switched': ProfileSwitchedEvent;
	'locale.changed': LocaleChangedEvent;
	'theme.changed': Record<string, string>;
};

function on<E extends keyof ZephyrEventMap>(
	event: E,
	cb: (payload: ZephyrEventMap[E]) => void
): () => void;
function on(event: string, cb: (payload: unknown) => void): () => void;
function on(event: string, cb: (payload: any) => void): () => void {
	let set = eventListeners.get(event);
	if (!set) {
		set = new Set();
		eventListeners.set(event, set);
	}
	set.add(cb);
	return () => set!.delete(cb);
}

export const zephyr = {
	storage: {
		get: <T = unknown>() => call<T>('zephyr.storage.get'),
		set: (value: unknown) => call<null>('zephyr.storage.set', { value })
	},
	openExternal: (url: string) => call<null>('zephyr.openExternal', { url }),
	notify: (message: string, opts?: { kind?: 'info' | 'error'; title?: string }) =>
		call<null>('zephyr.notify', { message, ...opts }),
	plugin: () => call<PluginInfo>('zephyr.plugin.info'),
	locale: () => call<string>('zephyr.locale'),
	activeGame: () => call<GameInfo | null>('zephyr.activeGame'),
	activeProfile: () => call<ActiveProfile | null>('zephyr.activeProfile'),
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
	},
	recording: {
		start: (opts: {
			filename: string;
			fps?: number;
			quality?: '720p' | '1080p' | '1440p' | '2160p';
			windowTitle?: string;
			withAudio?: boolean;
		}) =>
			call<{ sessionId: string; filename: string }>('zephyr.recording.start', opts),
		stop: (sessionId: string) =>
			call<{ filename: string; size: number }>('zephyr.recording.stop', { sessionId })
	},
	on
};
