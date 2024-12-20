import * as whisper from 'whisper-webgpu';
import toWav from 'audiobuffer-to-wav';

const CACHE = {};
const S3Q = 'https://kunziteq.s3.gra.perf.cloud.ovh.net';

export const wavBytes = async ({ chunks }) => {
  const buffer = await new Blob(chunks).arrayBuffer();

  const audioContext = new AudioContext({
    sampleRate: 16000,
    channelCount: 1,
    echoCancellation: true,
    autoGainControl: true,
    noiseSuppression: true
  });

  const resampled = await audioContext.decodeAudioData(buffer);
  return new Uint8Array(toWav(resampled));
};

export const ttsInfer = async ({
  chunks,
  url,
  onStream,
  audio = [],
  bin = `${S3Q}/ttsb.bin`,
  data = `${S3Q}/tts.json`
}) => {
  const fetchBytes = async url => {
    if (!CACHE[url]) {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      CACHE[url] = bytes;
    }

    return CACHE[url];
  };

  const tokenizer = await fetchBytes(data);
  const model = await fetchBytes(bin);

  if (url) audio = await fetchBytes(url);
  if (chunks) audio = await wavBytes({ chunks });

  const consolelog = console.log;
  console.log = () => {};
  const consolewarn = console.warn;
  console.warn = () => {};

  await whisper.default();
  const builder = new whisper.SessionBuilder();
  const session = await builder.setModel(model).setTokenizer(tokenizer).build();

  let segments = [];

  if (onStream) {
    await session.stream(audio, false, segment => {
      onStream?.(segment);
      segments.push(segments);
    });
  } else {
    ({ segments } = await session.run(audio));
  }

  session.free();

  console.warn = consolewarn;
  console.log = consolelog;

  return segments;
};

export const tts = async ({ audio }) => {
  const remote = (await ttsInfer({ audio: audio.remote })).map(item => ({
    ...item,
    channel: 'remote'
  }));
  const local = (await ttsInfer({ audio: audio.local })).map(item => ({
    ...item,
    channel: 'local'
  }));
  const merged = [...remote, ...local].sort((a, b) => a.start - b.start);

  return merged;
};
