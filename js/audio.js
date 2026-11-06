/**
 * ECOS DE SOPOCACHI - WEB AUDIO API SOUND SYNTHESIS
 * Sistema de audio procedural nativo sin dependencias de archivos de sonido externos.
 */

let audioCtx = null;
let isMuted = false;
let ambientOsc = null;
let ambientGain = null;

/**
 * Inicializa y desbloquea el contexto de audio tras la interacción del usuario.
 */
export function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

/**
 * Alterna el estado de silencio.
 */
export function toggleMute() {
  isMuted = !isMuted;
  if (ambientGain) {
    ambientGain.gain.setValueAtTime(isMuted ? 0 : 0.04, audioCtx.currentTime);
  }
  return isMuted;
}

export function getMuteState() {
  return isMuted;
}

/**
 * Inicia un sutil zumbido ambiental sintetizado tipo "pulso etéreo".
 */
export function startAmbientHum() {
  if (isMuted || !audioCtx || ambientOsc) return;

  try {
    ambientOsc = audioCtx.createOscillator();
    ambientGain = audioCtx.createGain();

    ambientOsc.type = "sine";
    ambientOsc.frequency.setValueAtTime(110, audioCtx.currentTime); // La grave (A2)

    ambientGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    ambientGain.gain.exponentialRampToValueAtTime(0.035, audioCtx.currentTime + 3);

    // Filtro pasa-bajos cálido
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(280, audioCtx.currentTime);

    ambientOsc.connect(filter);
    filter.connect(ambientGain);
    ambientGain.connect(audioCtx.destination);

    ambientOsc.start();
  } catch (e) {
    console.warn("No se pudo iniciar el sonido ambiente:", e);
  }
}

/**
 * Detiene el zumbido ambiental.
 */
export function stopAmbientHum() {
  if (ambientOsc) {
    try {
      ambientGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
      setTimeout(() => {
        ambientOsc?.stop();
        ambientOsc?.disconnect();
        ambientOsc = null;
        ambientGain = null;
      }, 900);
    } catch (e) {
      ambientOsc = null;
      ambientGain = null;
    }
  }
}

/**
 * Reproduce un arpegio ascendente místico representativo del personaje enfocado.
 * @param {Array<number>} notes Frecuencias en Hertz
 */
export function playCharacterArpeggio(notes = [440, 554, 659, 830]) {
  if (isMuted || !audioCtx) return;

  const now = audioCtx.currentTime;
  notes.forEach((freq, index) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = index % 2 === 0 ? "triangle" : "sine";
    osc.frequency.setValueAtTime(freq, now + index * 0.12);

    gain.gain.setValueAtTime(0.0001, now + index * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.18, now + index * 0.12 + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.6);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now + index * 0.12);
    osc.stop(now + index * 0.12 + 0.7);
  });
}

/**
 * Sonido de "Fijación de Objetivo" (Lock-on) cuando la mira apunta al personaje en AR.
 */
export function playLockOnSound() {
  if (isMuted || !audioCtx) return;

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(1760, now + 0.15);

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.26);
}

/**
 * Beep o pulso sonoro de radar que se acelera y sube de tono al acercarse.
 */
export function playRadarPing(distanceMeters) {
  if (isMuted || !audioCtx) return;

  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  // Frecuencia dinámica: más agudo cuanto más cerca
  const clampedDist = Math.max(5, Math.min(100, distanceMeters));
  const freq = 300 + (100 - clampedDist) * 12; // entre 300Hz y 1440Hz

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.13);
}

/**
 * Sonido del obturador de la cámara (Flash y captura).
 */
export function playShutterSound() {
  if (isMuted || !audioCtx) return;

  const now = audioCtx.currentTime;

  // Ruido blanco sintético para el "click mecánico"
  const bufferSize = audioCtx.sampleRate * 0.08;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1200, now);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  noise.start(now);

  // Tono agudo de confirmación
  const beep = audioCtx.createOscillator();
  const beepGain = audioCtx.createGain();
  beep.type = "sine";
  beep.frequency.setValueAtTime(1400, now + 0.04);
  beepGain.gain.setValueAtTime(0.15, now + 0.04);
  beepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

  beep.connect(beepGain);
  beepGain.connect(audioCtx.destination);

  beep.start(now + 0.04);
  beep.stop(now + 0.17);
}

/**
 * Fanfarria de victoria tras atrapar a un personaje.
 */
export function playCaptureVictory() {
  if (isMuted || !audioCtx) return;

  const now = audioCtx.currentTime;
  const chordNotes = [
    { freq: 523.25, time: 0 },    // C5
    { freq: 659.25, time: 0.1 },  // E5
    { freq: 783.99, time: 0.2 },  // G5
    { freq: 1046.50, time: 0.35 } // C6
  ];

  chordNotes.forEach(({ freq, time }) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now + time);

    gain.gain.setValueAtTime(0.0001, now + time);
    gain.gain.exponentialRampToValueAtTime(0.2, now + time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + 0.8);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now + time);
    osc.stop(now + time + 0.9);
  });
}

/**
 * Fanfarria final épica al completar la colección de los 5 personajes.
 */
export function playFinalCelebration() {
  if (isMuted || !audioCtx) return;

  const now = audioCtx.currentTime;
  const melody = [
    { freq: 523.25, delay: 0.0, dur: 0.2 },
    { freq: 659.25, delay: 0.2, dur: 0.2 },
    { freq: 783.99, delay: 0.4, dur: 0.2 },
    { freq: 1046.50, delay: 0.65, dur: 0.4 },
    { freq: 880.00, delay: 1.1, dur: 0.25 },
    { freq: 1046.50, delay: 1.4, dur: 0.8 }
  ];

  melody.forEach(({ freq, delay, dur }) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, now + delay);

    // Filtro para sonido tipo metal/brass
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, now + delay);

    gain.gain.setValueAtTime(0.0001, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.18, now + delay + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now + delay);
    osc.stop(now + delay + dur + 0.05);
  });
}
