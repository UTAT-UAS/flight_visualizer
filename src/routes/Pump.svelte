<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as ROSLIB from 'roslib';

	export let ros: ROSLIB.Ros;

	// Topics
	let pumpThrottleTopic: ROSLIB.Topic;
	let servoUsTopic: ROSLIB.Topic;

	// Pump state
	let pumpThrottle = 80;
	let currentPumpThrottle = 0;
	let autoZeroPump = true;
	let autoZeroDelay = 3000;
	let pumpTimeout: ReturnType<typeof setTimeout> | null = null;
	let countdownInterval: ReturnType<typeof setInterval> | null = null;
	let timeLeft = 0;

	// Servo state
	let servoAngle = 0;
	let currentServoAngle = 0;
	let servoTimeout: ReturnType<typeof setTimeout> | null = null;
	let pendingAngle = 0;
	let keyboardIncrement = 1;

	onMount(() => {
		pumpThrottleTopic = new ROSLIB.Topic({
			ros: ros,
			name: '/set_pump_throttle',
			messageType: 'std_msgs/Int32'
		});

		servoUsTopic = new ROSLIB.Topic({
			ros: ros,
			name: '/set_servo_us',
			messageType: 'std_msgs/Int32'
		});
	});

	onDestroy(() => {
		if (pumpTimeout) clearTimeout(pumpTimeout);
		if (countdownInterval) clearInterval(countdownInterval);
		if (servoTimeout) clearTimeout(servoTimeout);
	});

	function clamp(val: number, min: number, max: number) {
		return Math.min(Math.max(val, min), max);
	}

	function sendPumpThrottle() {
		if (!pumpThrottleTopic) return;
		const msg = new ROSLIB.Message({ data: Math.round(pumpThrottle) });
		pumpThrottleTopic.publish(msg);
		currentPumpThrottle = Math.round(pumpThrottle);

		if (autoZeroPump) {
			if (pumpTimeout) clearTimeout(pumpTimeout);
			if (countdownInterval) clearInterval(countdownInterval);

			timeLeft = autoZeroDelay;
			countdownInterval = setInterval(() => {
				timeLeft -= 100;
				if (timeLeft <= 0 && countdownInterval) {
					clearInterval(countdownInterval);
					countdownInterval = null;
				}
			}, 100);

			pumpTimeout = setTimeout(() => {
				const zeroMsg = new ROSLIB.Message({ data: 0 });
				pumpThrottleTopic.publish(zeroMsg);
				currentPumpThrottle = 0;
			}, autoZeroDelay);
		}
	}

	function sendServoAngle() {
		let clampedAngle = clamp(servoAngle, -32, 32);

		pendingAngle = clampedAngle;
		servoAngle = clampedAngle;

		if (servoTimeout) {
			clearTimeout(servoTimeout);
		}

		servoTimeout = setTimeout(() => {
			if (!servoUsTopic) return;
			let servo_angle_param = 51;
			let target = 1464.5 + (pendingAngle * 1837) / (servo_angle_param * 1.25);
			let finalValue = Math.round(clamp(target, 546, 2383));

			const msg = new ROSLIB.Message({ data: finalValue });
			servoUsTopic.publish(msg);

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
			autoZeroPump = true;
			autoZeroDelay = 3000;
			sendPumpThrottle();
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
			<p>Current Throttle: {currentPumpThrottle}</p>
			<div class="throttle-bar-container">
				<div class="throttle-bar" style="width: {currentPumpThrottle}%"></div>
			</div>
		</div>
		{#if timeLeft > 0}
			<p class="auto-zero-text">Auto-zero in: {(timeLeft / 1000).toFixed(1)}s</p>
		{/if}
	</div>

	<div class="control-group">
		<label>
			Pump Throttle (0-100):
			<input type="number" min="0" max="100" bind:value={pumpThrottle} />
		</label>
		<label>
			<input type="checkbox" bind:checked={autoZeroPump} />
			Auto Zero
		</label>
		{#if autoZeroPump}
			<label>
				Delay (ms):
				<input type="number" min="0" bind:value={autoZeroDelay} />
			</label>
		{/if}
		<button on:click={sendPumpThrottle}>Send Pump Throttle</button>
	</div>

	<h3>Servo Controls</h3>
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
	.throttle-bar-container {
		width: 100%;
		height: 20px;
		background-color: #eee;
		border: 1px solid #ccc;
		border-radius: 4px;
		overflow: hidden;
	}
	.throttle-bar {
		height: 100%;
		background-color: #007bff;
		transition: width 0.2s ease-out;
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
