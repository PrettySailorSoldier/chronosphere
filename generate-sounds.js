// Simple tone generator for timer sounds
const fs = require('fs');
const path = require('path');

// WAV file header helper
function createWavHeader(dataLength, sampleRate, channels, bitsPerSample) {
  const buffer = Buffer.alloc(44);
  const byteRate = sampleRate * channels * bitsPerSample / 8;
  const blockAlign = channels * bitsPerSample / 8;

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);

  return buffer;
}

// Generate a simple tone
function generateTone(frequency, duration, sampleRate = 44100, volume = 0.5) {
  const samples = Math.floor(sampleRate * duration);
  const buffer = Buffer.alloc(samples * 2);

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    // Apply fade in/out envelope
    const envelope = Math.min(1, i / (sampleRate * 0.05)) * Math.min(1, (samples - i) / (sampleRate * 0.1));
    const sample = Math.sin(2 * Math.PI * frequency * t) * volume * envelope;
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, i * 2);
  }

  return buffer;
}

// Generate chime sound (two harmonious tones)
function generateChime() {
  const sampleRate = 44100;
  const duration = 1.5;
  const samples = Math.floor(sampleRate * duration);
  const buffer = Buffer.alloc(samples * 2);

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    // Envelope with longer decay
    const envelope = Math.exp(-t * 2) * Math.min(1, i / (sampleRate * 0.01));
    
    // Chime frequencies (C5 and E5 for pleasant sound)
    const freq1 = 523.25; // C5
    const freq2 = 659.25; // E5
    const freq3 = 783.99; // G5
    
    const sample = (
      Math.sin(2 * Math.PI * freq1 * t) * 0.4 +
      Math.sin(2 * Math.PI * freq2 * t) * 0.3 +
      Math.sin(2 * Math.PI * freq3 * t) * 0.2
    ) * envelope * 0.6;
    
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, i * 2);
  }

  return buffer;
}

// Generate water/bubbling sound (filtered noise with bubbles)
function generateWater() {
  const sampleRate = 44100;
  const duration = 2;
  const samples = Math.floor(sampleRate * duration);
  const buffer = Buffer.alloc(samples * 2);

  let prevSample = 0;
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, i / (sampleRate * 0.1)) * Math.min(1, (samples - i) / (sampleRate * 0.3));
    
    // Low-pass filtered noise for water
    const noise = (Math.random() - 0.5) * 0.3;
    const filtered = prevSample * 0.95 + noise * 0.05;
    prevSample = filtered;
    
    // Add occasional bubble sounds
    const bubbleFreq = 400 + Math.random() * 200;
    const bubblePhase = Math.sin(t * 8) > 0.9 ? Math.sin(2 * Math.PI * bubbleFreq * t) * 0.2 * Math.exp(-((t % 0.5) * 10)) : 0;
    
    const sample = (filtered + bubblePhase) * envelope;
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, i * 2);
  }

  return buffer;
}

// Generate alarm sound (beeping)
function generateAlarm() {
  const sampleRate = 44100;
  const duration = 1.5;
  const samples = Math.floor(sampleRate * duration);
  const buffer = Buffer.alloc(samples * 2);

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    // Beeping pattern (on/off every 0.15 seconds)
    const beepOn = Math.floor(t / 0.15) % 2 === 0;
    const envelope = beepOn ? Math.min(1, (i % (sampleRate * 0.15)) / (sampleRate * 0.01)) : 0;

    // Sharp alarm frequency
    const freq = 880; // A5
    const sample = Math.sin(2 * Math.PI * freq * t) * envelope * 0.5;

    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, i * 2);
  }

  return buffer;
}

// Generate desk bell sound
function generateBell() {
  const sampleRate = 44100;
  const duration = 2;
  const samples = Math.floor(sampleRate * duration);
  const buffer = Buffer.alloc(samples * 2);

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    // Bell-like envelope with quick attack and long decay
    const envelope = Math.exp(-t * 3) * Math.min(1, i / (sampleRate * 0.005));

    // Bell frequencies with inharmonic overtones
    const freq1 = 880;   // Fundamental
    const freq2 = 1760;  // Octave
    const freq3 = 2640;  // Fifth above octave
    const freq4 = 3520;  // Two octaves

    const sample = (
      Math.sin(2 * Math.PI * freq1 * t) * 0.5 +
      Math.sin(2 * Math.PI * freq2 * t) * 0.25 +
      Math.sin(2 * Math.PI * freq3 * t) * 0.15 +
      Math.sin(2 * Math.PI * freq4 * t) * 0.1
    ) * envelope * 0.5;

    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, i * 2);
  }

  return buffer;
}

// Generate bird chirping sound
function generateBirds() {
  const sampleRate = 44100;
  const duration = 2.5;
  const samples = Math.floor(sampleRate * duration);
  const buffer = Buffer.alloc(samples * 2);

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    // Multiple chirps at different times
    const chirpTimes = [0.1, 0.4, 0.8, 1.2, 1.7, 2.1];
    for (const chirpStart of chirpTimes) {
      const chirpT = t - chirpStart;
      if (chirpT > 0 && chirpT < 0.15) {
        const chirpEnv = Math.sin(Math.PI * chirpT / 0.15) * Math.exp(-chirpT * 10);
        // Frequency modulation for natural chirp
        const freqMod = 2000 + Math.sin(chirpT * 80) * 500;
        sample += Math.sin(2 * Math.PI * freqMod * chirpT) * chirpEnv * 0.3;
      }
    }

    // Overall envelope
    const envelope = Math.min(1, i / (sampleRate * 0.1)) * Math.min(1, (samples - i) / (sampleRate * 0.2));
    sample *= envelope;

    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, i * 2);
  }

  return buffer;
}

// Generate zen gong sound
function generateGong() {
  const sampleRate = 44100;
  const duration = 3;
  const samples = Math.floor(sampleRate * duration);
  const buffer = Buffer.alloc(samples * 2);

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    // Long decay envelope
    const envelope = Math.exp(-t * 1.2) * Math.min(1, i / (sampleRate * 0.02));

    // Rich harmonic content for gong
    const freq = 110; // Low fundamental
    const sample = (
      Math.sin(2 * Math.PI * freq * t) * 0.4 +
      Math.sin(2 * Math.PI * freq * 2.3 * t) * 0.25 +
      Math.sin(2 * Math.PI * freq * 3.5 * t) * 0.15 +
      Math.sin(2 * Math.PI * freq * 5.1 * t) * 0.1 +
      Math.sin(2 * Math.PI * freq * 6.8 * t) * 0.08
    ) * envelope * 0.6;

    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, i * 2);
  }

  return buffer;
}

// Generate piano notes sound
function generatePiano() {
  const sampleRate = 44100;
  const duration = 2;
  const samples = Math.floor(sampleRate * duration);
  const buffer = Buffer.alloc(samples * 2);

  // Play a pleasant chord: C-E-G
  const notes = [
    { freq: 261.63, start: 0 },    // C4
    { freq: 329.63, start: 0.15 }, // E4
    { freq: 392.00, start: 0.3 },  // G4
    { freq: 523.25, start: 0.45 }  // C5
  ];

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    for (const note of notes) {
      const noteT = t - note.start;
      if (noteT > 0) {
        // Piano-like envelope
        const attack = Math.min(1, noteT / 0.01);
        const decay = Math.exp(-noteT * 2.5);
        const env = attack * decay;

        // Piano has strong odd harmonics
        sample += (
          Math.sin(2 * Math.PI * note.freq * noteT) * 0.5 +
          Math.sin(2 * Math.PI * note.freq * 2 * noteT) * 0.25 +
          Math.sin(2 * Math.PI * note.freq * 3 * noteT) * 0.15
        ) * env * 0.3;
      }
    }

    const intSample = Math.floor(Math.max(-1, Math.min(1, sample)) * 32767);
    buffer.writeInt16LE(intSample, i * 2);
  }

  return buffer;
}

// Save WAV file
function saveWav(filename, audioData, sampleRate = 44100) {
  const header = createWavHeader(audioData.length, sampleRate, 1, 16);
  const wavBuffer = Buffer.concat([header, audioData]);
  fs.writeFileSync(filename, wavBuffer);
  console.log(`Created: ${filename}`);
}

// Generate all sounds
const soundsDir = path.join(__dirname, 'sounds');

if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir);
}

console.log('Generating timer sounds...');
saveWav(path.join(soundsDir, 'chime.wav'), generateChime());
saveWav(path.join(soundsDir, 'water.wav'), generateWater());
saveWav(path.join(soundsDir, 'alarm.wav'), generateAlarm());
saveWav(path.join(soundsDir, 'bell.wav'), generateBell());
saveWav(path.join(soundsDir, 'birds.wav'), generateBirds());
saveWav(path.join(soundsDir, 'gong.wav'), generateGong());
saveWav(path.join(soundsDir, 'piano.wav'), generatePiano());
console.log('Done! Sound files created in sounds/ folder.');
