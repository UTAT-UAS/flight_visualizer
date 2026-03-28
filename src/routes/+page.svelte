<script lang="ts">
	import { onMount } from 'svelte';
	import * as ROSLIB from 'roslib';
	import { initRemoteStreams, stream } from '$lib/webrtc.svelte';
	import { ROS_BRIDGE } from '$lib/uri.js';
	import Stream from './Stream.svelte';
	import Pump from './Pump.svelte';

	let connected = $state(false);
	let rosObj = $state(null);
	let ROS = null;

	let coreStatusSub;
	let coreStatus = $state({});

	let localPosSub;
	let localPos = $state({});

	let cvPointSub;
	let cvPoint = $state({});

	let saveFrameSrv;
	let calculateDistanceSrv;
	let toggleOverlaySrv;

	function connect(ros: ROSLIB.Ros) {
		ros.connect(ROS_BRIDGE);
		// won't let the user connect more than once
		ros.on('error', function () {
			connected = false;
		});

		// Find out exactly when we made a connection.
		ros.on('connection', function () {
			console.log('Connected!');
			connected = true;
			rosObj = ros;
		});

		ros.on('close', function () {
			connected = false;
			rosObj = null;
		});
	}

	onMount(() => {
		let ros = new ROSLIB.Ros({});
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

		saveFrameSrv = new ROSLIB.Service({
			ros: ros,
			name: '/uas/cv/save_frame',
			serviceType: 'flight_stack_msgs/srv/SaveFrame'
		});

		calculateDistanceSrv = new ROSLIB.Service({
			ros: ros,
			name: '/uas/cv/calculate_distance',
			serviceType: 'flight_stack_msgs/srv/CalculateDistance'
		});

		toggleOverlaySrv = new ROSLIB.Service({
			ros: ros,
			name: '/uas/cv/toggle_overlay_depth',
			serviceType: 'std_srvs/srv/SetBool'
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

	{#if rosObj}
		<Pump ros={rosObj} />
	{/if}
{/if}

{#if stream.api}
	{#each Object.values(stream.producers) as p (p.id)}
		<Stream {stream} id={p.id} {saveFrameSrv} {calculateDistanceSrv} {toggleOverlaySrv} />
	{/each}
{/if}

<style lang="scss">
	:root {
		font-family: sans-serif;
	}
</style>
