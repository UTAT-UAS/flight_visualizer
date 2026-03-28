<script lang="ts">
	import type { StreamSet } from '$lib/webrtc.svelte';

	let {
		stream,
		id,
		calculateDistancePub
	}: { stream: StreamSet; id: string; calculateDistancePub?: any } = $props();

	let video: HTMLVideoElement;

	let info = $state<{ [key: string]: any }>({});
	let frozenFrames = $state<
		{
			image: string;
			frameNum: number;
			width: number;
			height: number;
			points: { x: number; y: number }[];
		}[]
	>([]);

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
					session.remoteController.addEventListener('info', (e) => {
						info = e.detail.info.meta;
					});
				}
			});
			session.connect();
		}
	}
	function close() {
		stream.sessions[id]?.close();
	}

	function freezeFrame() {
		if (!video || !video.videoWidth) return;
		const canvas = document.createElement('canvas');
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		const ctx = canvas.getContext('2d');
		if (ctx) {
			ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
			const image = canvas.toDataURL('image/png');
			let frameNum = 0;
			if (info) {
				frameNum =
					(((info.hours || 0) * 60 + (info.minutes || 0)) * 60 + (info.seconds || 0)) *
						(info.fps?.[0] || 0) +
					(info.frames || 0);
			}
			frozenFrames.push({
				image,
				frameNum: isNaN(frameNum) ? 0 : frameNum,
				width: canvas.width,
				height: canvas.height,
				points: []
			});
		}
	}

	function onImageClick(e: MouseEvent, index: number) {
		const target = e.target as HTMLImageElement;
		const rect = target.getBoundingClientRect();
		const scaleX = target.naturalWidth / rect.width;
		const scaleY = target.naturalHeight / rect.height;
		const clickX = Math.round((e.clientX - rect.left) * scaleX);
		const clickY = Math.round((e.clientY - rect.top) * scaleY);

		frozenFrames[index].points.push({ x: clickX, y: clickY });
		if (frozenFrames[index].points.length > 2) {
			frozenFrames[index].points.shift();
		}
	}

	function calculateDistance(index: number) {
		const frame = frozenFrames[index];
		if (frame.points.length === 2 && calculateDistancePub) {
			calculateDistancePub.publish({
				data: [
					frame.frameNum,
					frame.points[0].x,
					frame.points[0].y,
					frame.points[1].x,
					frame.points[1].y
				]
			});
		}
	}
</script>

<div class="stream">
	{id}
	<div>
		<button onclick={connect}>connect</button>
		<button onclick={close}>close</button>
		<button onclick={freezeFrame}>freeze frame</button>
	</div>

	<!-- svelte-ignore a11y_media_has_caption -->
	<video bind:this={video}></video>
	{#if info}
		<div>
			<p>
				Frame: {(((info?.hours || 0) * 60 + (info?.minutes || 0)) * 60 + (info?.seconds || 0)) *
					(info?.fps?.[0] || 0) +
					(info?.frames || 0)}
			</p>
		</div>
	{/if}

	{#each frozenFrames as frame, index}
		<div class="frozen-frame">
			<p>Frozen Frame: {frame.frameNum}</p>
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div class="image-container">
				<img src={frame.image} alt="Frozen frame" onclick={(e) => onImageClick(e, index)} />
				{#each frame.points as point}
					<div
						class="point-marker"
						style={`left: ${(point.x / frame.width) * 100}%; top: ${(point.y / frame.height) * 100}%;`}
					></div>
				{/each}
			</div>
			{#if frame.points.length > 0}
				<div>
					{#each frame.points as point, pIndex}
						<p>Point {pIndex + 1}: ({point.x}, {point.y})</p>
					{/each}
				</div>
			{/if}
			{#if frame.points.length === 2}
				<button onclick={() => calculateDistance(index)}>Calculate Distance</button>
			{/if}
			<button onclick={() => frozenFrames.splice(index, 1)}>remove</button>
		</div>
	{/each}
</div>

<style>
	div.stream {
		display: flex;
		flex-direction: column;
		max-width: 500px;
	}
	.frozen-frame {
		margin-top: 1rem;
		border: 1px solid #ccc;
		padding: 1rem;
		border-radius: 4px;
	}
	.image-container {
		position: relative;
		display: inline-block;
		max-width: 100%;
	}
	.frozen-frame img {
		max-width: 100%;
		cursor: crosshair;
		border: 1px solid #eee;
		display: block;
	}
	.point-marker {
		position: absolute;
		width: 10px;
		height: 10px;
		background-color: red;
		border-radius: 50%;
		transform: translate(-50%, -50%);
		pointer-events: none;
	}
</style>
