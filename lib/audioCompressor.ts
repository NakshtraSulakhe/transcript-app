import lamejs from 'lamejs';

export interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  mimeType: string;
  filename: string;
}

/**
 * Client-side Audio Compressor for Speech Transcription
 * Converts any input audio file (WAV, MP3, M4A, OGG, FLAC, WebM, etc.) into:
 * - Mono (1 channel)
 * - 16 kHz sample rate
 * - 32 kbps MP3 compression (speech-optimized)
 * 
 * Preserves speech intelligibility while dramatically reducing file size
 * (e.g. 35 MB 3m25s WAV becomes ~800 KB MP3, avoiding Vercel 413 limits).
 */
export async function compressAudioForSTT(
  inputFile: File,
  targetKbps: number = 32
): Promise<CompressionResult> {
  const originalSize = inputFile.size;
  const originalMB = (originalSize / (1024 * 1024)).toFixed(2);

  // 1. Read input audio file as ArrayBuffer
  const arrayBuffer = await inputFile.arrayBuffer();

  // 2. Decode audio with Web Audio API (AudioContext)
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Web Audio API (AudioContext) is not supported in this browser environment.');
  }
  const audioCtx = new AudioCtx();
  
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (decodeErr) {
    audioCtx.close();
    throw new Error(`Failed to decode audio file. Please ensure it is a valid audio recording (${decodeErr}).`);
  }

  // 3. Extract audio channels & downsample to 16 kHz mono
  const targetSampleRate = 16000;
  const targetChannels = 1;
  const duration = audioBuffer.duration;
  const outputLength = Math.floor(duration * targetSampleRate);

  const numChannels = audioBuffer.numberOfChannels;
  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = numChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;
  const inputSampleRate = audioBuffer.sampleRate;
  const sampleRatio = inputSampleRate / targetSampleRate;

  // Convert Float32 samples to 16-bit PCM Int16Array at 16 kHz Mono
  const pcmSamples = new Int16Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const inputIndex = i * sampleRatio;
    const indexFloor = Math.floor(inputIndex);
    const indexCeil = Math.min(leftChannel.length - 1, indexFloor + 1);
    const fraction = inputIndex - indexFloor;

    // Mix channels to mono
    const sampleLeft = leftChannel[indexFloor] + fraction * (leftChannel[indexCeil] - leftChannel[indexFloor]);
    const sampleRight = rightChannel[indexFloor] + fraction * (rightChannel[indexCeil] - rightChannel[indexFloor]);
    const monoFloat = (sampleLeft + sampleRight) / 2;

    // Clamp & convert to 16-bit signed integer PCM (-32768 to 32767)
    const clamped = Math.max(-1, Math.min(1, monoFloat));
    pcmSamples[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
  }

  audioCtx.close();

  // 4. Encode 16kHz Mono PCM to MP3 at 32 kbps using lamejs
  const mp3encoder = new (lamejs as any).Mp3Encoder(targetChannels, targetSampleRate, targetKbps);
  const mp3Data: Uint8Array[] = [];

  // Encode in chunks of 1152 samples
  const sampleBlockSize = 1152;
  for (let i = 0; i < pcmSamples.length; i += sampleBlockSize) {
    const sampleChunk = pcmSamples.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }
  }

  // Flush MP3 encoder
  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(new Uint8Array(mp3buf));
  }

  // 5. Create compressed File object
  const mimeType = 'audio/mp3';
  const baseName = inputFile.name.substring(0, inputFile.name.lastIndexOf('.')) || inputFile.name;
  const filename = `${baseName}_compressed.mp3`;

  const compressedBlob = new Blob(mp3Data as BlobPart[], { type: mimeType });
  const compressedFile = new File([compressedBlob], filename, { type: mimeType });

  const compressedSize = compressedFile.size;
  const compressedMB = (compressedSize / (1024 * 1024)).toFixed(2);
  const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100);

  // 6. Console Logging as required
  console.log(`Original size: ${originalMB} MB (${originalSize} bytes)`);
  console.log(`Compressed size: ${compressedMB} MB (${compressedSize} bytes)`);
  console.log(`Compression ratio: ${compressionRatio}% reduction`);
  console.log(`Final MIME type: ${mimeType}`);
  console.log(`Final filename: ${filename}`);

  return {
    compressedFile,
    originalSize,
    compressedSize,
    compressionRatio,
    mimeType,
    filename
  };
}
