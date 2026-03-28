<script lang="ts">
	import type { StreamSet } from '$lib/webrtc.svelte';
	import * as ROSLIB from 'roslib';

	let {
		stream,
		id,
		saveFrameSrv,
		calculateDistanceSrv,
		toggleOverlaySrv
	}: { stream: StreamSet; id: string; saveFrameSrv?: any; calculateDistanceSrv?: any; toggleOverlaySrv?: any } = $props();

	let video: HTMLVideoElement;

	let info = $state<{ [key: string]: any }>({});
	let frozenFrames = $state<
		{
			image: string;
			frameNum: number;
			width: number;
			height: number;
			points: { x: number; y: number }[];
			saveResult?: string;
			distanceResult?: string;
			distance?: number;
			lastPoints?: { x: number; y: number }[];
			savedAnnotatedImages: string[];
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

	function setOverlay(enabled: boolean) {
		if (toggleOverlaySrv) {
			const request = new ROSLIB.ServiceRequest({ data: enabled });
			toggleOverlaySrv.callService(request, (result: any) => {
				// We don't track state locally since the UI may not know the actual initial state
			});
		}
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
			frameNum = isNaN(frameNum) ? 0 : frameNum;
			const index = frozenFrames.length;

			frozenFrames.push({
				image,
				frameNum: frameNum,
				width: canvas.width,
				height: canvas.height,
				points: [],
				lastPoints: [],
				savedAnnotatedImages: []
			});

			if (saveFrameSrv) {
				const request = new ROSLIB.ServiceRequest({ frame_id: frameNum });
				saveFrameSrv.callService(request, (result: any) => {
					frozenFrames[index].saveResult = result.message;
				});
			}
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
		if (frame.points.length === 2 && calculateDistanceSrv) {
			const request = new ROSLIB.ServiceRequest({
				frame_id: frame.frameNum,
				x1: frame.points[0].x,
				y1: frame.points[0].y,
				x2: frame.points[1].x,
				y2: frame.points[1].y
			});
			calculateDistanceSrv.callService(request, (result: any) => {
				frozenFrames[index].distanceResult = result.message;
				if (result.success) {
					frozenFrames[index].distance = result.distance;
					// Save the points used for this calculation
					frozenFrames[index].lastPoints = [...frozenFrames[index].points];

					const canvas = document.createElement('canvas');
					canvas.width = frame.width;
					canvas.height = frame.height;
					const ctx = canvas.getContext('2d');
					if (ctx) {
						const img = new Image();
						img.onload = () => {
							ctx.drawImage(img, 0, 0);

							// Draw line
							ctx.strokeStyle = '#00ff00';
							ctx.lineWidth = 2;
							ctx.beginPath();
							ctx.moveTo(frame.points[0].x, frame.points[0].y);
							ctx.lineTo(frame.points[1].x, frame.points[1].y);
							ctx.stroke();

							// Draw text
							ctx.font = '38px sans-serif';
							const text = `${result.distance.toFixed(2)} mm`;
							const mx = (frame.points[0].x + frame.points[1].x) / 2;
							const my = (frame.points[0].y + frame.points[1].y) / 2;

							const metrics = ctx.measureText(text);
							ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
							const padding = 6;
							const bgWidth = metrics.width + padding * 2;
							const bgHeight = 30 + padding * 2;
							ctx.fillRect(mx - bgWidth / 2, my - bgHeight / 2, bgWidth, bgHeight);

							ctx.fillStyle = '#00ff00';
							ctx.textAlign = 'center';
							ctx.textBaseline = 'middle';
							ctx.fillText(text, mx, my);

							// Draw points
							ctx.fillStyle = 'red';
							ctx.beginPath();
							ctx.arc(frame.points[0].x, frame.points[0].y, 5, 0, 2 * Math.PI);
							ctx.fill();
							ctx.beginPath();
							ctx.arc(frame.points[1].x, frame.points[1].y, 5, 0, 2 * Math.PI);
							ctx.fill();

							frozenFrames[index].savedAnnotatedImages.push(canvas.toDataURL('image/png'));
						};
						img.src = frame.image;
					}
				}
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
		<button onclick={() => setOverlay(true)}>enable depth overlay</button>
		<button onclick={() => setOverlay(false)}>disable depth overlay</button>
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
			{#if frame.saveResult}
				<p><b>Save Status:</b> {frame.saveResult}</p>
			{:else}
				<p><b>Save Status:</b> Requesting...</p>
			{/if}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div class="frozen-frame-images">
				<div class="image-container">
					<img src={frame.image} alt="Frozen frame" onclick={(e) => onImageClick(e, index)} />
					{#if frame.lastPoints && frame.lastPoints.length === 2 && frame.distance !== undefined}
						<svg
							class="distance-overlay"
							viewBox={`0 0 ${frame.width} ${frame.height}`}
							preserveAspectRatio="none"
						>
							<line
								x1={frame.lastPoints[0].x}
								y1={frame.lastPoints[0].y}
								x2={frame.lastPoints[1].x}
								y2={frame.lastPoints[1].y}
								stroke="#00ff00"
								stroke-width="2"
							/>
						</svg>
						<div
							class="distance-label"
							style={`left: ${((frame.lastPoints[0].x + frame.lastPoints[1].x) / 2 / frame.width) * 100}%; top: ${((frame.lastPoints[0].y + frame.lastPoints[1].y) / 2 / frame.height) * 100}%;`}
						>
							{frame.distance.toFixed(2)} mm
						</div>
					{/if}
					{#each frame.points as point}
						<div
							class="point-marker"
							style={`left: ${(point.x / frame.width) * 100}%; top: ${(point.y / frame.height) * 100}%;`}
						></div>
					{/each}
				</div>
				{#each frame.savedAnnotatedImages as annotatedImage}
					<div class="image-container">
						<img src={annotatedImage} alt="Annotated frame" />
					</div>
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
			{#if frame.distanceResult}
				<p><b>Distance Result:</b> {frame.distanceResult}</p>
			{/if}
			<button onclick={() => frozenFrames.splice(index, 1)}>remove</button>
		</div>
	{/each}
</div>

<style>
	div.stream {
		display: flex;
		flex-direction: column;
		max-width: fit-content;
		video {
			max-width: 500px;
		}
	}
	.frozen-frame {
		margin-top: 1rem;
		border: 1px solid #ccc;
		padding: 1rem;
		border-radius: 4px;
	}
	.frozen-frame-images {
		display: flex;
		flex-direction: row;
		flex-wrap: nowrap;
		gap: 1rem;
		padding-bottom: 1rem;
	}
	.image-container {
		position: relative;
		display: inline-block;
		flex-shrink: 0;
		max-width: 100%;
	}
	.frozen-frame img {
		max-width: 500px;
		cursor: crosshair;
		border: 1px solid #eee;
		display: block;
	}
	.point-marker {
		position: absolute;
		width: 5px;
		height: 5px;
		background-color: red;
		border-radius: 50%;
		transform: translate(-50%, -50%);
		pointer-events: none;
	}
	.distance-overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.distance-label {
		position: absolute;
		background-color: rgba(0, 0, 0, 0.7);
		color: #00ff00;
		font-weight: bold;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 14px;
		transform: translate(-50%, -50%);
		pointer-events: none;
		white-space: nowrap;
	}
</style>
