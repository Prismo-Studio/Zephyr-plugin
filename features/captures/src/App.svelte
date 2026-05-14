<script lang="ts">
	import {
		zephyr,
		type PluginFile,
		Toggle,
		Select,
		Button,
		Card,
		Row,
		StatusPill,
		StatCard
	} from '@zephyr-plugin/sdk';
	import { onMount, onDestroy } from 'svelte';

	type Settings = {
		autoRecord: boolean;
		quality: '720p' | '1080p' | '1440p' | '2160p';
		fps: 30 | 60;
		captureMic: boolean;
	};

	const DEFAULTS: Settings = {
		autoRecord: true,
		quality: '1080p',
		fps: 60,
		captureMic: false
	};

	let settings = $state<Settings>({ ...DEFAULTS });
	let files = $state<PluginFile[]>([]);
	let recording = $state(false);
	let elapsed = $state(0);
	let previewing = $state<{ name: string; url: string } | null>(null);
	let toast = $state<{ text: string; kind: 'info' | 'error' } | null>(null);

	let mediaRecorder: MediaRecorder | null = null;
	let mediaStream: MediaStream | null = null;
	let chunks: Blob[] = [];
	let startedAt = 0;
	let tickInterval: number | null = null;
	let toastTimer: number | null = null;
	let nativeSessionId: string | null = null;

	let offGameLaunched: (() => void) | null = null;
	let offGameExited: (() => void) | null = null;

	onMount(async () => {
		try {
			const saved = await zephyr.storage.get<{ settings?: Settings }>();
			if (saved?.settings) settings = { ...DEFAULTS, ...saved.settings };
		} catch {}
		await refreshFiles();

		offGameLaunched = zephyr.on('game.launched', async (evt) => {
			if (!settings.autoRecord || recording) return;
			showToast(`Waiting for ${evt.gameName} window…`);
			try {
				await startRecording(evt.gameName);
				showToast(`Recording ${evt.gameName}`);
			} catch (err) {
				showToast(err instanceof Error ? err.message : String(err), 'error');
			}
		});

		offGameExited = zephyr.on('game.exited', async (evt) => {
			if (!recording) return;
			showToast(`${evt.gameName} closed, saving capture…`);
			await stopRecording();
		});
	});

	onDestroy(() => {
		offGameLaunched?.();
		offGameExited?.();
		stopRecording().catch(() => {});
		if (tickInterval) clearInterval(tickInterval);
		if (toastTimer) clearTimeout(toastTimer);
	});

	async function persistSettings() {
		try {
			await zephyr.storage.set({ settings });
		} catch {}
	}

	async function refreshFiles() {
		try {
			const mp4 = await zephyr.fs.list('mp4');
			const webm = await zephyr.fs.list('webm');
			files = [...mp4, ...webm].sort((a, b) => b.createdAt - a.createdAt);
		} catch {
			files = [];
		}
	}

	function showToast(text: string, kind: 'info' | 'error' = 'info') {
		toast = { text, kind };
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = window.setTimeout(() => (toast = null), 3500);
	}

	function fmtSize(bytes: number): string {
		const mb = bytes / (1024 * 1024);
		if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB';
		return mb.toFixed(0) + ' MB';
	}

	function fmtDuration(ms: number): string {
		const total = Math.floor(ms / 1000);
		const m = Math.floor(total / 60);
		const s = total % 60;
		return m + ':' + String(s).padStart(2, '0');
	}

	function fmtRel(ts: number): string {
		const diff = (Date.now() - ts) / 1000;
		if (diff < 60) return 'just now';
		if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
		if (diff < 86400) return Math.floor(diff / 3600) + ' h ago';
		return Math.floor(diff / 86400) + ' d ago';
	}

	function qualityHeight(): number {
		return { '720p': 720, '1080p': 1080, '1440p': 1440, '2160p': 2160 }[settings.quality];
	}

	function bitrateBps(): number {
		const h = qualityHeight();
		const base = h <= 720 ? 4 : h <= 1080 ? 8 : h <= 1440 ? 16 : 35;
		return base * 1_000_000 * (settings.fps === 60 ? 1.6 : 1);
	}

	async function pickMimeType(): Promise<string> {
		const candidates = [
			'video/mp4;codecs=avc1,mp4a.40.2',
			'video/webm;codecs=vp9,opus',
			'video/webm;codecs=vp8,opus',
			'video/webm'
		];
		for (const c of candidates) {
			if (MediaRecorder.isTypeSupported(c)) return c;
		}
		return '';
	}

	async function startRecording(windowTitle?: string) {
		if (recording) return;

		if (windowTitle) {
			try {
				const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
				const filename = `capture-${stamp}.mp4`;
				const result = await zephyr.recording.start({
					filename,
					fps: settings.fps,
					quality: settings.quality,
					windowTitle,
					withAudio: false
				});
				nativeSessionId = result.sessionId;
				recording = true;
				startedAt = Date.now();
				elapsed = 0;
				tickInterval = window.setInterval(() => {
					elapsed = Date.now() - startedAt;
				}, 250);
				return;
			} catch (err) {
				showToast(
					'Native capture failed, falling back to picker: ' +
						(err instanceof Error ? err.message : String(err)),
					'info'
				);
			}
		}

		try {
			mediaStream = await navigator.mediaDevices.getDisplayMedia({
				// @ts-expect-error displaySurface + selfBrowserSurface + systemAudio are in the spec but not in lib.dom yet
				video: { frameRate: { ideal: settings.fps }, displaySurface: 'window' },
				audio: true,
				// @ts-expect-error
				selfBrowserSurface: 'exclude',
				// @ts-expect-error
				systemAudio: 'include',
				// @ts-expect-error
				surfaceSwitching: 'exclude',
				// @ts-expect-error
				monitorTypeSurfaces: 'exclude'
			});

			if (settings.captureMic) {
				try {
					const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
					for (const track of mic.getAudioTracks()) mediaStream!.addTrack(track);
				} catch {
					showToast('Mic capture denied, recording video only', 'info');
				}
			}

			const mimeType = await pickMimeType();
			mediaRecorder = new MediaRecorder(mediaStream!, {
				mimeType: mimeType || undefined,
				videoBitsPerSecond: bitrateBps()
			});
			chunks = [];
			mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) chunks.push(e.data);
			};
			mediaRecorder.onstop = async () => {
				const ext = (mediaRecorder?.mimeType || 'video/webm').startsWith('video/mp4')
					? 'mp4'
					: 'webm';
				const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || 'video/webm' });
				const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
				const filename = `capture-${stamp}.${ext}`;
				try {
					await zephyr.fs.writeBlob(filename, blob);
					await zephyr.notify(`Saved ${filename}`, { title: 'Captures' });
					await refreshFiles();
				} catch (err) {
					showToast(
						'Save failed: ' + (err instanceof Error ? err.message : String(err)),
						'error'
					);
				}
				mediaStream?.getTracks().forEach((t) => t.stop());
				mediaStream = null;
				mediaRecorder = null;
			};

			const videoTrack = mediaStream!.getVideoTracks()[0];
			if (videoTrack) {
				videoTrack.addEventListener('ended', () => {
					if (recording) stopRecording();
				});
			}

			mediaRecorder.start(1000);
			recording = true;
			startedAt = Date.now();
			elapsed = 0;
			tickInterval = window.setInterval(() => {
				elapsed = Date.now() - startedAt;
			}, 250);
		} catch (err) {
			showToast(
				'Could not start recording: ' + (err instanceof Error ? err.message : String(err)),
				'error'
			);
			recording = false;
		}
	}

	async function stopRecording() {
		if (!recording) return;
		recording = false;
		if (tickInterval) clearInterval(tickInterval);
		tickInterval = null;
		elapsed = 0;

		if (nativeSessionId) {
			const id = nativeSessionId;
			nativeSessionId = null;
			try {
				const result = await zephyr.recording.stop(id);
				await zephyr.notify(`Saved ${result.filename}`, { title: 'Captures' });
				await refreshFiles();
			} catch (err) {
				showToast(
					'Stop failed: ' + (err instanceof Error ? err.message : String(err)),
					'error'
				);
			}
			return;
		}

		try {
			mediaRecorder?.stop();
		} catch {}
	}

	async function openPreview(file: PluginFile) {
		try {
			const url = await zephyr.fs.getUrl(file.name);
			previewing = { name: file.name, url };
		} catch {
			showToast('Could not open preview', 'error');
		}
	}

	async function deleteFile(file: PluginFile, evt: Event) {
		evt.stopPropagation();
		try {
			await zephyr.fs.delete(file.name);
			await refreshFiles();
		} catch {
			showToast('Delete failed', 'error');
		}
	}

	async function openFolder() {
		try {
			await zephyr.fs.openFolder();
		} catch {}
	}

	let totalSize = $derived(files.reduce((sum, f) => sum + f.size, 0));
	let lastLabel = $derived(files.length ? fmtRel(files[0].createdAt) : '—');

	let statusTone = $derived(recording ? 'error' : 'idle');
	let statusLabel = $derived(recording ? `Recording · ${fmtDuration(elapsed)}` : 'Idle');
</script>

<main class="cap">
	<header class="cap-header">
		<div>
			<h1>Captures</h1>
			<p>Record your screen and keep the file locally. Click any clip to preview it.</p>
		</div>
		<StatusPill label={statusLabel} tone={statusTone} pulse={recording} />
	</header>

	<section class="stats">
		<StatCard label="Captures" value={files.length} />
		<StatCard label="Storage used" value={fmtSize(totalSize)} />
		<StatCard label="Last capture" value={lastLabel} />
	</section>

	<Card title="Recording">
		<Row
			title="Manual capture"
			description="Pick a screen or window when prompted. Click Stop to save the file locally."
		>
			{#snippet control()}
				<Button variant="primary" disabled={recording} onclick={() => startRecording()}>
					{#snippet children()}Start{/snippet}
				</Button>
				<Button variant="danger" disabled={!recording} onclick={stopRecording}>
					{#snippet children()}Stop{/snippet}
				</Button>
			{/snippet}
		</Row>
		<Row
			title="Auto-record on game launch (coming soon)"
			description="Will automatically record gameplay when you launch a modded game from Zephyr. Not enabled yet, the manual capture above works."
		>
			{#snippet control()}
				<Toggle checked={false} disabled />
			{/snippet}
		</Row>
		<Row title="Quality" description="Target resolution. Actual size depends on what you share.">
			{#snippet control()}
				<Select
					value={settings.quality}
					options={[
						{ value: '720p', label: '720p' },
						{ value: '1080p', label: '1080p' },
						{ value: '1440p', label: '1440p' },
						{ value: '2160p', label: '2160p (4K)' }
					]}
					onchange={(v) => {
						settings.quality = v;
						persistSettings();
					}}
				/>
			{/snippet}
		</Row>
		<Row title="Frame rate" description="60fps roughly doubles the file size compared to 30fps.">
			{#snippet control()}
				<Select
					value={settings.fps}
					options={[
						{ value: 30, label: '30 fps' },
						{ value: 60, label: '60 fps' }
					]}
					onchange={(v) => {
						settings.fps = v;
						persistSettings();
					}}
				/>
			{/snippet}
		</Row>
		<Row title="Capture mic audio" description="Records your default microphone alongside system audio.">
			{#snippet control()}
				<Toggle
					checked={settings.captureMic}
					onchange={(v) => {
						settings.captureMic = v;
						persistSettings();
					}}
				/>
			{/snippet}
		</Row>
	</Card>

	<Card title="Recent captures">
		{#snippet actions()}
			<Button variant="ghost" size="sm" onclick={openFolder}>
				{#snippet children()}Open folder{/snippet}
			</Button>
		{/snippet}
		{#if files.length === 0}
			<div class="empty">No captures yet. Hit <strong>Start</strong> above to record one.</div>
		{:else}
			<div class="list">
				{#each files as f (f.name)}
					<button class="item" onclick={() => openPreview(f)}>
						<div class="thumb">▶</div>
						<div class="item-info">
							<p class="item-title">{f.name}</p>
							<p class="item-meta">{fmtSize(f.size)} · {fmtRel(f.createdAt)}</p>
						</div>
						<span
							class="icon-btn"
							role="button"
							tabindex="0"
							onclick={(e) => deleteFile(f, e)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') deleteFile(f, e);
							}}
							aria-label="Delete">✕</span
						>
					</button>
				{/each}
			</div>
		{/if}
	</Card>
</main>

{#if previewing}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="overlay" onclick={() => (previewing = null)}>
		<div class="preview" onclick={(e) => e.stopPropagation()}>
			<header class="preview-head">
				<span class="preview-title">{previewing.name}</span>
				<button class="preview-close" onclick={() => (previewing = null)} aria-label="Close">
					✕
				</button>
			</header>
			<!-- svelte-ignore a11y_media_has_caption -->
			<video class="preview-video" src={previewing.url} controls autoplay></video>
		</div>
	</div>
{/if}

{#if toast}
	<div class="toast" class:error={toast.kind === 'error'}>{toast.text}</div>
{/if}

<style>
	@import '@zephyr-plugin/sdk/src/tokens.css';

	.cap {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		max-width: 880px;
		margin: 0 auto;
		padding: var(--space-xl) var(--space-xl) var(--space-3xl);
	}

	.cap-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-lg);
	}
	.cap-header h1 {
		font-family: var(--font-display);
		font-size: 24px;
		margin: 0 0 4px;
		letter-spacing: -0.01em;
	}
	.cap-header p {
		margin: 0;
		color: var(--text-secondary);
		font-size: 13px;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-sm);
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.item {
		display: grid;
		grid-template-columns: 44px 1fr auto;
		gap: var(--space-md);
		align-items: center;
		padding: 10px 12px;
		border-radius: var(--radius-md);
		background: var(--bg-base);
		border: 1px solid var(--border-subtle);
		cursor: pointer;
		text-align: left;
		font-family: inherit;
		color: inherit;
		width: 100%;
		transition: all var(--transition-fast);
	}
	.item:hover {
		border-color: var(--border-accent);
		background: var(--bg-surface);
	}
	.thumb {
		width: 44px;
		height: 30px;
		border-radius: 6px;
		background: linear-gradient(135deg, var(--bg-overlay), var(--bg-elevated));
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-secondary);
		font-size: 14px;
	}
	.item-info {
		min-width: 0;
	}
	.item-title {
		font-size: 13px;
		font-weight: 600;
		margin: 0 0 2px;
		font-family: var(--font-mono);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.item-meta {
		font-size: 11px;
		color: var(--text-muted);
		margin: 0;
	}
	.icon-btn {
		width: 30px;
		height: 30px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		background: transparent;
		color: var(--text-muted);
		font-size: 14px;
		cursor: pointer;
	}
	.icon-btn:hover {
		background: rgba(255, 92, 92, 0.1);
		color: var(--error);
	}

	.empty {
		text-align: center;
		padding: var(--space-2xl);
		color: var(--text-muted);
		font-size: 13px;
	}

	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(6px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: var(--space-2xl);
	}
	.preview {
		background: var(--bg-surface);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg);
		overflow: hidden;
		max-width: 1100px;
		width: 100%;
	}
	.preview-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-md) var(--space-lg);
		border-bottom: 1px solid var(--border-subtle);
	}
	.preview-title {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--text-secondary);
	}
	.preview-close {
		background: transparent;
		border: none;
		color: var(--text-secondary);
		font-size: 18px;
		cursor: pointer;
		width: 32px;
		height: 32px;
		border-radius: 6px;
	}
	.preview-close:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
	}
	.preview-video {
		width: 100%;
		max-height: 80vh;
		background: #000;
		display: block;
	}

	.toast {
		position: fixed;
		bottom: 20px;
		right: 20px;
		padding: var(--space-md) var(--space-lg);
		border-radius: var(--radius-md);
		background: var(--bg-elevated);
		border: 1px solid var(--border-default);
		font-size: 13px;
		max-width: 360px;
		z-index: 200;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
	}
	.toast.error {
		border-color: rgba(255, 92, 92, 0.4);
		color: var(--error);
	}
</style>
