<script lang="ts">
	import type ConsumerSession from '../../gst-plugins-rs/net/webrtc/gstwebrtc-api/types/consumer-session';
	import type GstWebRTCAPI from '../../gst-plugins-rs/net/webrtc/gstwebrtc-api/types/gstwebrtc-api';
	import type { StreamSet } from '$lib/webrtc.svelte';

	let { stream, id }: { stream: StreamSet; id: string } = $props();

	let video: HTMLVideoElement;

	function connect() {
		if (!stream.api) {
			throw new Error('stream api not set');
		}
		if (stream.sessions[id]) {
			stream.sessions[id].close();
		}
		let session = stream.api.createConsumerSession(id);
		if (session) {
			stream.sessions[id] = session;
			session.addEventListener('streamsChanged', () => {
				if (session.streams.length > 0) {
					video.srcObject = session.streams[0];
					video.play().catch(() => {});
				}
			});

			session.addEventListener('remoteControllerChanged', () => {
				if (session.remoteController) {
					session.remoteController.attachVideoElement(video);
				}
			});
			session.connect();
		}
	}
	function close() {
		stream.sessions[id]?.close();
	}
</script>

<div class="stream">
	{id}

	<button onclick={connect}>connect</button>
	<button onclick={close}>close</button>

	<video bind:this={video}></video>
</div>

<style>
	div.stream {
		display: flex;
        flex-direction: column;
		max-width: 500px;
	}
</style>
