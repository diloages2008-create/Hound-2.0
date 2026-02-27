const { parentPort, workerData } = require("node:worker_threads");
const { spawn } = require("node:child_process");
const FFT = require("fft.js");

const SAMPLE_RATE = 22050;
const FRAME_SIZE = 2048;
const HOP_SIZE = 1024;
const MAX_SECONDS = 120;
const NUM_MFCC = 13;
const NUM_MEL_BANDS = 26;
const ENERGY_BINS = 16;

const PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const { ffmpegPath, ffprobePath } = workerData;

const runProcess = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = Buffer.alloc(0);
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout = Buffer.concat([stdout, chunk]);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Command failed: ${command}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });

const decodeAudio = async (filePath) => {
  const args = [
    "-i",
    filePath,
    "-ac",
    "1",
    "-ar",
    String(SAMPLE_RATE),
    "-t",
    String(MAX_SECONDS),
    "-f",
    "f32le",
    "-"
  ];
  const { stdout } = await runProcess(ffmpegPath, args);
  return new Float32Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.byteLength / 4));
};

const getDurationSec = async (filePath) => {
  try {
    const args = [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath
    ];
    const { stdout } = await runProcess(ffprobePath, args);
    const text = stdout.toString().trim();
    const value = Number.parseFloat(text);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
};

const normalize = (vector) => {
  const sum = vector.reduce((acc, v) => acc + v * v, 0);
  const mag = Math.sqrt(sum) || 1;
  return vector.map((v) => v / mag);
};

const frameIterator = function* (samples, frameSize, hopSize) {
  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    yield samples.subarray(start, start + frameSize);
  }
};

const hannWindow = (() => {
  const win = new Float32Array(FRAME_SIZE);
  for (let i = 0; i < FRAME_SIZE; i += 1) {
    win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME_SIZE - 1));
  }
  return win;
})();

const computeSpectrum = (frame, fft, out) => {
  const input = new Array(fft.size);
  for (let i = 0; i < fft.size; i += 1) {
    input[i] = frame[i] * hannWindow[i];
  }
  const spectrum = fft.createComplexArray();
  fft.realTransform(spectrum, input);
  fft.completeSpectrum(spectrum);
  const bins = fft.size / 2;
  for (let i = 0; i < bins; i += 1) {
    const re = spectrum[2 * i];
    const im = spectrum[2 * i + 1];
    out[i] = Math.sqrt(re * re + im * im);
  }
};

const hzToMel = (hz) => 2595 * Math.log10(1 + hz / 700);
const melToHz = (mel) => 700 * (Math.pow(10, mel / 2595) - 1);

const createMelFilterBank = () => {
  const minMel = hzToMel(0);
  const maxMel = hzToMel(SAMPLE_RATE / 2);
  const melPoints = [];
  for (let i = 0; i < NUM_MEL_BANDS + 2; i += 1) {
    melPoints.push(minMel + (i / (NUM_MEL_BANDS + 1)) * (maxMel - minMel));
  }
  const hzPoints = melPoints.map(melToHz);
  const bins = hzPoints.map((hz) => Math.floor((FRAME_SIZE + 1) * hz / SAMPLE_RATE));
  const filterBank = Array.from({ length: NUM_MEL_BANDS }, () => new Float32Array(FRAME_SIZE / 2));
  for (let m = 1; m <= NUM_MEL_BANDS; m += 1) {
    const left = bins[m - 1];
    const center = bins[m];
    const right = bins[m + 1];
    for (let k = left; k < center; k += 1) {
      if (k >= 0 && k < filterBank[m - 1].length) {
        filterBank[m - 1][k] = (k - left) / Math.max(1, center - left);
      }
    }
    for (let k = center; k < right; k += 1) {
      if (k >= 0 && k < filterBank[m - 1].length) {
        filterBank[m - 1][k] = (right - k) / Math.max(1, right - center);
      }
    }
  }
  return filterBank;
};

const dct = (vector, count) => {
  const result = new Array(count).fill(0);
  for (let k = 0; k < count; k += 1) {
    let sum = 0;
    for (let n = 0; n < vector.length; n += 1) {
      sum += vector[n] * Math.cos((Math.PI / vector.length) * (n + 0.5) * k);
    }
    result[k] = sum;
  }
  return result;
};

const computeMFCCStats = (samples) => {
  const fft = new FFT(FRAME_SIZE);
  const spectrum = new Float32Array(FRAME_SIZE / 2);
  const melBank = createMelFilterBank();
  const mfccFrames = [];

  for (const frame of frameIterator(samples, FRAME_SIZE, HOP_SIZE)) {
    computeSpectrum(frame, fft, spectrum);
    const melEnergies = melBank.map((bank) => {
      let sum = 0;
      for (let i = 0; i < bank.length; i += 1) {
        sum += bank[i] * spectrum[i];
      }
      return Math.log10(sum + 1e-9);
    });
    const coeffs = dct(melEnergies, NUM_MFCC);
    mfccFrames.push(coeffs);
  }

  if (mfccFrames.length === 0) {
    return { mean: new Array(NUM_MFCC).fill(0), variance: new Array(NUM_MFCC).fill(0) };
  }

  const mean = new Array(NUM_MFCC).fill(0);
  mfccFrames.forEach((frame) => {
    for (let i = 0; i < NUM_MFCC; i += 1) {
      mean[i] += frame[i];
    }
  });
  for (let i = 0; i < NUM_MFCC; i += 1) {
    mean[i] /= mfccFrames.length;
  }
  const variance = new Array(NUM_MFCC).fill(0);
  mfccFrames.forEach((frame) => {
    for (let i = 0; i < NUM_MFCC; i += 1) {
      const diff = frame[i] - mean[i];
      variance[i] += diff * diff;
    }
  });
  for (let i = 0; i < NUM_MFCC; i += 1) {
    variance[i] /= mfccFrames.length;
  }
  return { mean, variance };
};

const computeSpectralStats = (samples) => {
  const fft = new FFT(FRAME_SIZE);
  const spectrum = new Float32Array(FRAME_SIZE / 2);
  let centroidSum = 0;
  let rolloffSum = 0;
  let flatnessSum = 0;
  let frames = 0;

  for (const frame of frameIterator(samples, FRAME_SIZE, HOP_SIZE)) {
    computeSpectrum(frame, fft, spectrum);
    let magSum = 0;
    let weightedSum = 0;
    let energySum = 0;
    let geoSum = 0;
    for (let i = 0; i < spectrum.length; i += 1) {
      const mag = spectrum[i];
      const freq = (i * SAMPLE_RATE) / FRAME_SIZE;
      magSum += mag;
      weightedSum += freq * mag;
      energySum += mag * mag;
      geoSum += Math.log(mag + 1e-9);
    }
    const centroid = magSum > 0 ? weightedSum / magSum : 0;
    centroidSum += centroid;

    const threshold = energySum * 0.85;
    let cumulative = 0;
    let rolloffFreq = 0;
    for (let i = 0; i < spectrum.length; i += 1) {
      cumulative += spectrum[i] * spectrum[i];
      if (cumulative >= threshold) {
        rolloffFreq = (i * SAMPLE_RATE) / FRAME_SIZE;
        break;
      }
    }
    rolloffSum += rolloffFreq;

    const geoMean = Math.exp(geoSum / spectrum.length);
    const arithMean = magSum / spectrum.length;
    const flatness = arithMean > 0 ? geoMean / arithMean : 0;
    flatnessSum += flatness;
    frames += 1;
  }

  if (frames === 0) {
    return { brightness: 0, rolloff: 0, flatness: 0 };
  }

  return {
    brightness: centroidSum / frames,
    rolloff: rolloffSum / frames,
    flatness: flatnessSum / frames
  };
};

const computeEnergyCurveSummary = (samples) => {
  const windowSize = SAMPLE_RATE;
  const energies = [];
  for (let i = 0; i < samples.length; i += windowSize) {
    const slice = samples.subarray(i, Math.min(samples.length, i + windowSize));
    let sum = 0;
    for (let j = 0; j < slice.length; j += 1) {
      sum += slice[j] * slice[j];
    }
    const rms = Math.sqrt(sum / Math.max(1, slice.length));
    energies.push(rms);
  }
  if (energies.length === 0) return new Array(ENERGY_BINS).fill(0);
  const max = Math.max(...energies, 1e-6);
  const normalized = energies.map((v) => v / max);
  const summary = new Array(ENERGY_BINS).fill(0);
  for (let i = 0; i < ENERGY_BINS; i += 1) {
    const idx = Math.floor((i / ENERGY_BINS) * normalized.length);
    summary[i] = normalized[Math.min(idx, normalized.length - 1)];
  }
  return summary;
};

const computeBpm = (samples) => {
  const envelope = [];
  for (const frame of frameIterator(samples, FRAME_SIZE, HOP_SIZE)) {
    let sum = 0;
    for (let i = 0; i < frame.length; i += 1) {
      sum += frame[i] * frame[i];
    }
    envelope.push(sum / frame.length);
  }
  if (envelope.length < 4) return { bpm: null, confidence: 0 };
  const mean = envelope.reduce((acc, v) => acc + v, 0) / envelope.length;
  const centered = envelope.map((v) => v - mean);
  const minBpm = 60;
  const maxBpm = 200;
  const minLag = Math.floor((60 * SAMPLE_RATE) / (maxBpm * HOP_SIZE));
  const maxLag = Math.floor((60 * SAMPLE_RATE) / (minBpm * HOP_SIZE));
  let bestLag = 0;
  let bestVal = 0;
  let total = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let i = 0; i < centered.length - lag; i += 1) {
      sum += centered[i] * centered[i + lag];
    }
    total += Math.abs(sum);
    if (sum > bestVal) {
      bestVal = sum;
      bestLag = lag;
    }
  }
  if (!bestLag) return { bpm: null, confidence: 0 };
  const bpm = (60 * SAMPLE_RATE) / (bestLag * HOP_SIZE);
  const confidence = total > 0 ? Math.min(1, bestVal / total) : 0;
  return { bpm, confidence };
};

const computeKey = (samples) => {
  const fft = new FFT(FRAME_SIZE);
  const spectrum = new Float32Array(FRAME_SIZE / 2);
  const chroma = new Array(12).fill(0);
  for (const frame of frameIterator(samples, FRAME_SIZE, HOP_SIZE)) {
    computeSpectrum(frame, fft, spectrum);
    for (let i = 1; i < spectrum.length; i += 1) {
      const freq = (i * SAMPLE_RATE) / FRAME_SIZE;
      if (freq < 40) continue;
      const midi = Math.round(69 + 12 * Math.log2(freq / 440));
      const pc = ((midi % 12) + 12) % 12;
      chroma[pc] += spectrum[i];
    }
  }
  const total = chroma.reduce((acc, v) => acc + v, 0);
  if (total === 0) return { key: null, mode: null, confidence: 0 };
  const norm = chroma.map((v) => v / total);

  const scoreKey = (profile) => {
    let best = { key: 0, score: -Infinity };
    for (let offset = 0; offset < 12; offset += 1) {
      let score = 0;
      for (let i = 0; i < 12; i += 1) {
        const idx = (i + offset) % 12;
        score += norm[idx] * profile[i];
      }
      if (score > best.score) {
        best = { key: offset, score };
      }
    }
    return best;
  };

  const major = scoreKey(MAJOR_PROFILE);
  const minor = scoreKey(MINOR_PROFILE);
  const mode = major.score >= minor.score ? "major" : "minor";
  const chosen = mode === "major" ? major : minor;
  const confidence = Math.min(1, Math.abs(chosen.score) / 10);
  return { key: PITCH_CLASSES[chosen.key], mode, confidence };
};

const buildEmbedding = ({ mfccMean, mfccVar, spectral, bpm, key, mode, energyCurve }) => {
  const keyIndex = PITCH_CLASSES.indexOf(key);
  const keyOneHot = new Array(12).fill(0);
  if (keyIndex >= 0) keyOneHot[keyIndex] = 1;
  const modeFlag = mode === "minor" ? 0 : 1;
  const bpmNorm = Number.isFinite(bpm) ? bpm / 200 : 0;
  const vector = [
    ...mfccMean,
    ...mfccVar,
    spectral.brightness / (SAMPLE_RATE / 2),
    spectral.rolloff / (SAMPLE_RATE / 2),
    spectral.flatness,
    bpmNorm,
    ...keyOneHot,
    modeFlag,
    ...energyCurve
  ];
  return normalize(vector);
};

const analyzeTrack = async ({ trackId, filePath, loudnessLUFS }) => {
  parentPort.postMessage({ type: "progress", trackId, stage: "decode", progress: 0.1 });
  const samples = await decodeAudio(filePath);
  const duration = (await getDurationSec(filePath)) ?? samples.length / SAMPLE_RATE;
  parentPort.postMessage({ type: "progress", trackId, stage: "features", progress: 0.4 });
  const mfccStats = computeMFCCStats(samples);
  const spectral = computeSpectralStats(samples);
  const energyCurve = computeEnergyCurveSummary(samples);
  const bpmResult = computeBpm(samples);
  const keyResult = computeKey(samples);
  parentPort.postMessage({ type: "progress", trackId, stage: "embedding", progress: 0.8 });
  const embedding = buildEmbedding({
    mfccMean: mfccStats.mean,
    mfccVar: mfccStats.variance,
    spectral,
    bpm: bpmResult.bpm,
    key: keyResult.key,
    mode: keyResult.mode,
    energyCurve
  });
  parentPort.postMessage({ type: "progress", trackId, stage: "finalize", progress: 1 });

  return {
    trackId,
    durationSec: duration,
    loudnessLUFS,
    bpm: bpmResult.bpm,
    bpmConfidence: bpmResult.confidence,
    key: keyResult.key,
    mode: keyResult.mode,
    keyConfidence: keyResult.confidence,
    timbreStats: {
      mfccMean: mfccStats.mean,
      mfccVar: mfccStats.variance,
      brightness: spectral.brightness,
      rolloff: spectral.rolloff,
      flatness: spectral.flatness
    },
    energyCurveSummary: energyCurve,
    embedding
  };
};

parentPort.on("message", async (message) => {
  if (!message || message.type !== "analyze") return;
  const { trackId, filePath, loudnessLUFS } = message.payload;
  try {
    const result = await analyzeTrack({ trackId, filePath, loudnessLUFS });
    parentPort.postMessage({ type: "complete", trackId, result });
  } catch (error) {
    parentPort.postMessage({
      type: "error",
      trackId,
      error: error?.message || "Analysis failed"
    });
  }
});
