<script lang="ts">
	import { onMount } from 'svelte';
	import * as ROSLIB from 'roslib';
	import { initRemoteStreams, stream } from '$lib/webrtc.svelte';
	import Stream from './Stream.svelte';

	let connected = $state(false);
	let ROS = null;

	let coreStatusSub;
	let coreStatus = $state({});

	let localPosSub;
	let localPos = $state({});

	let cvPointSub;
	let cvPoint = $state({});

	function connect(ros) {
		ros.connect('ws://localhost:8080');
		// won't let the user connect more than once
		ros.on('error', function () {
			connected = false;
		});

		// Find out exactly when we made a connection.
		ros.on('connection', function () {
			console.log('Connected!');
			connected = true;
		});

		ros.on('close', function () {
			connected = false;
		});
	}

	onMount(() => {
		let ros = new ROSLIB.Ros({ encoding: 'ascii' });
		connect(ros);
		// if (!connected) {
		// 	return;
		// }
		coreStatusSub = new ROSLIB.Topic({
			ros: ros,
			name: '/uas/core/status',
			messageType: 'flight_stack_msgs/CoreStatus'
		});
		coreStatusSub.subscribe((message) => {
			coreStatus = message;
		});
		localPosSub = new ROSLIB.Topic({
			ros: ros,
			name: '/fmu/out/vehicle_local_position',
			messageType: 'px4_msgs/VehicleLocalPosition'
		});
		localPosSub.subscribe((message) => {
			localPos = message;
		});
		cvPointSub = new ROSLIB.Topic({
			ros: ros,
			name: '/uas/cv/position',
			messageType: 'geometry_msgs/Point'
		});
		cvPointSub.subscribe((message) => {
			cvPoint = message;
		});

		initRemoteStreams();
	});
</script>

{#if !connected}
	<h1>ROS not connected</h1>
{:else}
	<h1>ROS connected</h1>
	<p>
		Mode: {coreStatus.core_mode}
	</p>
	<p>
		Status: {coreStatus.status}
	</p>
	<p>
		{Math.floor(localPos.x * 100) / 100}
		{Math.floor(localPos.y * 100) / 100}
		{Math.floor(localPos.z * 100) / 100}
	</p>
	<p>
		Detection: {cvPoint?.x?.toFixed(2)}, {cvPoint?.y?.toFixed(2)}
	</p>
{/if}

{#if stream.api}
	{#each Object.values(stream.producers) as p (p.id)}
		<Stream {stream} id={p.id} />
	{/each}
{/if}

<style lang="scss">
	:root {
		font-family: sans-serif;
	}
</style>
