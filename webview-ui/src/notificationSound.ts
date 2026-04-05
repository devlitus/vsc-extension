/**
 * Notification sound utility using Web Audio API.
 * Provides a simple notification beep with two-oscillator harmony.
 */

const NOTIFICATION_FREQUENCY_PRIMARY = 440;
const NOTIFICATION_FREQUENCY_SECONDARY = 554;
const NOTIFICATION_GAIN = 0.3;
const NOTIFICATION_FADE_DURATION_MS = 200;

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
	if (audioContext === null) {
		audioContext = new AudioContext();
	}
	return audioContext;
}

/**
 * Plays a notification sound if:
 * - soundEnabled is true
 * - document is visible
 *
 * Uses two sine wave oscillators (440Hz + 554Hz) with exponential fade-out.
 */
export function playNotificationSound(): void {
	if (!soundEnabled) {
		return;
	}

	if (document.visibilityState !== 'visible') {
		return;
	}

	const ctx = getAudioContext();
	const gainNode = ctx.createGain();

	const oscillator1 = ctx.createOscillator();
	const oscillator2 = ctx.createOscillator();

	oscillator1.type = 'sine';
	oscillator2.type = 'sine';

	oscillator1.frequency.setValueAtTime(NOTIFICATION_FREQUENCY_PRIMARY, ctx.currentTime);
	oscillator2.frequency.setValueAtTime(NOTIFICATION_FREQUENCY_SECONDARY, ctx.currentTime);

	oscillator1.connect(gainNode);
	oscillator2.connect(gainNode);
	gainNode.connect(ctx.destination);

	gainNode.gain.setValueAtTime(NOTIFICATION_GAIN, ctx.currentTime);
	gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + NOTIFICATION_FADE_DURATION_MS / 1000);

	oscillator1.start(ctx.currentTime);
	oscillator2.start(ctx.currentTime);

	oscillator1.stop(ctx.currentTime + NOTIFICATION_FADE_DURATION_MS / 1000);
	oscillator2.stop(ctx.currentTime + NOTIFICATION_FADE_DURATION_MS / 1000);
}

let soundEnabled = true;

export function setSoundEnabled(enabled: boolean): void {
	soundEnabled = enabled;
}
