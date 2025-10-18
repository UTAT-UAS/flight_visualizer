<script lang="ts">
	import { onMount } from 'svelte';
	import * as ROSLIB from 'roslib';

	let connected = $state(false);
	let ROS = null;

	let coreStatusSub;
	let coreStatus = $state({});

	let cvPointSub;
	let cvPoint = $state({});

	function connect(ros) {
		ros.connect('ws://localhost:8080');
		// won't let the user connect more than once
		ros.on('error', function () {
			connected = false;
			// console.log(error);
			// setStatus(error);
		});

		// Find out exactly when we made a connection.
		ros.on('connection', function () {
			console.log('Connected!');
			// setStatus('Connected!');
			connected = true;
		});

		ros.on('close', function () {
			connected = false;
			// console.log('Connection closed');
			// setStatus('Connection closed');
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
		cvPointSub = new ROSLIB.Topic({
			ros: ros,
			name: '/uas/cv/position',
			messageType: 'geometry_msgs/Point'
		});
		cvPointSub.subscribe((message) => {
			cvPoint = message;
		});
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
		Detection: {cvPoint?.x?.toFixed(2)}, {cvPoint?.y?.toFixed(2)}
	</p>
{/if}

<style lang="scss">
	:root {
		font-family: sans-serif;
	}
</style>
