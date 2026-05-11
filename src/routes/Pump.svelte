<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as ROSLIB from 'roslib';

	export let ros: ROSLIB.Ros;

	// Topics
	let pumpTimeTopic: ROSLIB.Topic;
	let servoAngleTopic: ROSLIB.Topic;
	let toggleAutoTargetClient: ROSLIB.Service;
	let togglePeripheralClient: ROSLIB.Service;

	// Pump state
	let pumpTimeMs = 3000;
	let currentPumpTime = 0;
	let countdownInterval: ReturnType<typeof setInterval> | null = null;
	let timeLeft = 0;

	// Servo state
	let servoAngle = 0;
	let currentServoAngle = 0;
	let servoTimeout: ReturnType<typeof setTimeout> | null = null;
	let pendingAngle = 0;
	let keyboardIncrement = 1;
	let autoTargetEnabled = false;
	let peripheralModeEnabled = false;

	onMount(() => {
		pumpTimeTopic = new ROSLIB.Topic({
			ros: ros,
			name: '/set_pump_time',
			messageType: 'std_msgs/Int32'
		});

		servoAngleTopic = new ROSLIB.Topic({
			ros: ros,
			name: '/set_servo_angle',
			messageType: 'std_msgs/Int32'
		});

		toggleAutoTargetClient = new ROSLIB.Service({
			ros: ros,
			name: '/uas/cv/toggle_auto_target',
			serviceType: 'std_srvs/srv/SetBool'
		});

		togglePeripheralClient = new ROSLIB.Service({
			ros: ros,
			name: '/toggle_peripheral_mode',
			serviceType: 'std_srvs/srv/SetBool'
		});
	});

	onDestroy(() => {
		if (countdownInterval) clearInterval(countdownInterval);
		if (servoTimeout) clearTimeout(servoTimeout);
	});

	function clamp(val: number, min: number, max: number) {
		return Math.min(Math.max(val, min), max);
	}

	function sendPumpTime() {
		if (!pumpTimeTopic) return;
		const msg = new ROSLIB.Message({ data: Math.round(pumpTimeMs) });
		pumpTimeTopic.publish(msg);
		currentPumpTime = Math.round(pumpTimeMs);

		if (countdownInterval) clearInterval(countdownInterval);

		if (pumpTimeMs > 0) {
			timeLeft = pumpTimeMs;
			countdownInterval = setInterval(() => {
				timeLeft -= 100;
				if (timeLeft <= 0 && countdownInterval) {
					clearInterval(countdownInterval);
					countdownInterval = null;
				}
			}, 100);
		} else {
			timeLeft = 0;
		}
	}

	function stopPump() {
		if (!pumpTimeTopic) return;
		const msg = new ROSLIB.Message({ data: 0 });
		pumpTimeTopic.publish(msg);
		currentPumpTime = 0;
		timeLeft = 0;
		if (countdownInterval) {
			clearInterval(countdownInterval);
			countdownInterval = null;
		}
	}

	function toggleAutoTarget() {
		if (!toggleAutoTargetClient) return;
		const request = new ROSLIB.ServiceRequest({
			data: autoTargetEnabled
		});
		toggleAutoTargetClient.callService(request, (result) => {
			console.log('Toggle Auto Target:', result.message);
		}, (error) => {
			console.error('Service error:', error);
		});
	}

	function togglePeripheralMode() {
		if (!togglePeripheralClient) return;
		const request = new ROSLIB.ServiceRequest({
			data: peripheralModeEnabled
		});
		togglePeripheralClient.callService(request, (result) => {
			console.log('Toggle Peripheral Mode:', result.message);
		}, (error) => {
			console.error('Service error:', error);
		});
	}

	function sendServoAngle() {
		let clampedAngle = clamp(servoAngle, -32, 32);

		pendingAngle = clampedAngle;
		servoAngle = clampedAngle;

		if (servoTimeout) {
			clearTimeout(servoTimeout);
		}

		servoTimeout = setTimeout(() => {
			if (!servoAngleTopic) return;

			const msg = new ROSLIB.Message({ data: Math.round(pendingAngle) });
			servoAngleTopic.publish(msg);

			currentServoAngle = pendingAngle;
		}, 200);
	}

	function adjustServoAngle(increment: number) {
		servoAngle = clamp(servoAngle + increment, -32, 32);
		sendServoAngle();
	}

	function handleKeydown(e: KeyboardEvent) {
		const key = e.key.toLowerCase();
		if (key === 'arrowup' || key === 'w') {
			e.preventDefault();
			adjustServoAngle(keyboardIncrement);
		} else if (key === 'arrowdown' || key === 's') {
			e.preventDefault();
			adjustServoAngle(-keyboardIncrement);
		} else if (key === 'arrowleft' || key === 'a') {
			e.preventDefault();
			keyboardIncrement = Math.max(1, keyboardIncrement - 1);
		} else if (key === 'arrowright' || key === 'd') {
			e.preventDefault();
			keyboardIncrement += 1;
		} else if (key === 'enter' || key === 'f') {
			e.preventDefault();
			sendPumpTime();
		} else if (key === 'escape' || key === 'x') {
			e.preventDefault();
			stopPump();
		}
	}
</script>

<div class="pump-container">
	<h3>Keyboard Controls</h3>
	<div class="control-group pump-control">
		<label>
			Focus to control:
			<input
				type="text"
				readonly
				placeholder="Click here for keyboard control..."
				on:keydown={handleKeydown}
			/>
		</label>
		<p style="margin: 0;">Angle Increment: {keyboardIncrement}°</p>
	</div>

	<h3>Pump Controls</h3>
	<div class="throttle">
		<div class="throttle-status">
			<p>Current Time Commanded: {currentPumpTime} ms</p>
		</div>
		{#if timeLeft > 0}
			<p class="auto-zero-text">Time remaining: {(timeLeft / 1000).toFixed(1)}s</p>
		{/if}
	</div>

	<div class="control-group">
		<label>
			Pump Time (ms):
			<input type="number" min="0" bind:value={pumpTimeMs} />
		</label>
		<div class="servo-buttons" style="flex-direction: row">
			<button on:click={sendPumpTime}>Command Pump</button>
			<button on:click={stopPump} style="background-color: #dc3545; color: white;"
				>Stop Pump (0 ms)</button
			>
		</div>
	</div>

	<h3>Servo Controls</h3>
	<div class="control-group">
		<label style="font-weight: bold; margin-bottom: 0.5rem; color: #007bff;">
			<input type="checkbox" bind:checked={peripheralModeEnabled} on:change={togglePeripheralMode} />
			Enable Peripheral Mode (Toggle Actuator Control)
		</label>
	</div>
	<div class="control-group">
		<label style="font-weight: bold; margin-bottom: 0.5rem; color: #d00;">
			<input type="checkbox" bind:checked={autoTargetEnabled} on:change={toggleAutoTarget} />
			Enable Auto Target (Overrides Manual)
		</label>
	</div>
	<div class="servo-visual">
		<div>
			<p>Current Angle: {currentServoAngle}°</p>
			<p style="color: rgba(40, 167, 69, 0.8); margin-top: 0;">Pending: {pendingAngle}°</p>
		</div>
		<div class="indicator-container">
			<div class="indicator-line pending" style="transform: rotate({-pendingAngle}deg);"></div>
			<div class="indicator-line current" style="transform: rotate({-currentServoAngle}deg);"></div>
		</div>
	</div>

	<div class="control-group">
		<label>
			Servo Angle (-32 to 32):
			<input type="number" min="-32" max="32" bind:value={servoAngle} />
		</label>
		<div class="servo-buttons">
			<button on:click={sendServoAngle}>Send</button>
			<div class="adjust-group">
				<button on:click={() => adjustServoAngle(1)}>+1°</button>
				<button on:click={() => adjustServoAngle(-1)}>-1°</button>
			</div>
			<div class="adjust-group">
				<button on:click={() => adjustServoAngle(5)}>+5°</button>
				<button on:click={() => adjustServoAngle(-5)}>-5°</button>
			</div>
		</div>
	</div>
</div>

<style lang="scss">
	.pump-container {
		border: 1px solid #ccc;
		padding: 1rem;
		margin: 1rem 0;
		border-radius: 4px;
		width: 600px;
		div.throttle {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 1rem;
			margin-bottom: 1rem;
			align-items: center;
		}
	}
	.throttle-status p {
		margin: 0 0 0.5rem 0;
	}
	.auto-zero-text {
		margin: 0;
	}
	.control-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1rem;

		&.pump-control {
			input {
				width: 15rem;
				height: 2rem;
				&:active,
				&:focus {
					outline: none;
					background-color: rgb(231, 115, 115);
				}
			}
			&:has(input:focus) {
				background-color: rgb(231, 115, 115);
			}
		}
	}
	label {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.servo-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		.adjust-group {
			display: flex;
			gap: 0.5rem;
		}
	}
	.servo-visual {
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: 2rem;
		margin-bottom: 1rem;
	}
	.indicator-container {
		width: 100px;
		height: 100px;
		border: 1px dashed #999;
		border-radius: 50%;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.indicator-line {
		width: 80%;
		height: 4px;
		border-radius: 2px;
		transition: transform 0.2s ease-out;
		transform-origin: center;
		position: absolute;
	}
	.indicator-line::after {
		content: '';
		position: absolute;
		right: -2px;
		top: 50%;
		transform: translateY(-50%);
		border-top: 6px solid transparent;
		border-bottom: 6px solid transparent;
	}
	.indicator-line.current {
		background: #007bff;
		z-index: 2;
	}
	.indicator-line.current::after {
		border-left: 10px solid #007bff;
	}
	.indicator-line.pending {
		background: rgba(40, 167, 69, 0.5);
		z-index: 1;
	}
	.indicator-line.pending::after {
		border-left: 10px solid rgba(40, 167, 69, 0.5);
	}
</style>
