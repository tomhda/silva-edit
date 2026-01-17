// DOM
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const pickFile = document.getElementById('pickFile');
const fileNameEl = document.getElementById('fileName');
const durationEl = document.getElementById('duration');
const sourceSizeEl = document.getElementById('sourceSize');
const video = document.getElementById('video');
const preview = document.getElementById('preview');
const cropBox = document.getElementById('cropBox');
const cropHandle = document.getElementById('cropHandle');
const cropHandleTL = document.getElementById('cropHandleTL');
const cropSizeEl = document.getElementById('cropSize');
const previewSection = document.getElementById('previewSection');
const clearVideo = document.getElementById('clearVideo');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const outWidthInput = document.getElementById('outWidth');
const outHeightInput = document.getElementById('outHeight');
const setStartBtn = document.getElementById('setStart');
const setEndBtn = document.getElementById('setEnd');
const useSourceBtn = document.getElementById('useSource');
const exportVideoBtn = document.getElementById('exportVideo');
const exportFrameBtn = document.getElementById('exportFrame');
const exportFrameCropBtn = document.getElementById('exportFrameCrop');
const exportAudioBtn = document.getElementById('exportAudio');
const logEl = document.getElementById('log');
const playbackRateInput = document.getElementById('playbackRate');
const modeButtons = document.querySelectorAll('.mode-btn');

// State
const state = {
  objectUrl: null,
  file: null,
  fileName: null,
  duration: 0,
  renderHandle: null,
  playbackRate: 1,
  crop: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  },
};

// FFmpeg state
const ffmpegState = {
  instance: null,
  loading: null,
};

// Constants
const DEFAULT_PLAYBACK_RATE = 1;
const MIN_PLAYBACK_RATE = 0.25;
const MAX_PLAYBACK_RATE = 4;
const MODE_KEY = 'silvaEditMode';
const MODE_YURU = 'yuru';
const MODE_KIRI = 'kiri';

// UI state
function setStatus(message) {
  logEl.textContent = message;
}

function setUIMode(mode) {
  const targetMode = mode === MODE_KIRI ? MODE_KIRI : MODE_YURU;
  document.body.classList.toggle('mode-kiri', targetMode === MODE_KIRI);
  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === targetMode;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  try {
    localStorage.setItem(MODE_KEY, targetMode);
  } catch (error) {
    return;
  }
}

function loadUIMode() {
  try {
    return localStorage.getItem(MODE_KEY) || MODE_YURU;
  } catch (error) {
    return MODE_YURU;
  }
}

function setHasVideo(enabled) {
  document.body.classList.toggle('has-video', enabled);
}

function setButtonsEnabled(enabled) {
  exportVideoBtn.disabled = !enabled;
  exportFrameBtn.disabled = !enabled;
  if (exportFrameCropBtn) {
    exportFrameCropBtn.disabled = !enabled;
  }
  exportAudioBtn.disabled = !enabled;
  setStartBtn.disabled = !enabled;
  setEndBtn.disabled = !enabled;
  useSourceBtn.disabled = !enabled;
}

function setProcessing(processing) {
  if (processing) {
    setButtonsEnabled(false);
    if (pickFile) {
      pickFile.disabled = true;
    }
    return;
  }
  if (pickFile) {
    pickFile.disabled = false;
  }
  setButtonsEnabled(Boolean(state.duration));
}

// Formatting
function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return '--';
  }
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function baseName() {
  if (!state.fileName) {
    return 'export';
  }
  return state.fileName.replace(/\.[^.]+$/, '');
}

function formatStamp(seconds) {
  return seconds.toFixed(1).replace('.', 'p');
}

function formatClipLabel(start, end) {
  return `${formatStamp(start)}-${formatStamp(end)}`;
}

// Playback
function sanitizePlaybackRate(value) {
  let rate = parseFloat(value);
  if (!Number.isFinite(rate) || rate <= 0) {
    rate = DEFAULT_PLAYBACK_RATE;
  }
  rate = Math.min(Math.max(rate, MIN_PLAYBACK_RATE), MAX_PLAYBACK_RATE);
  rate = Math.round(rate * 20) / 20;
  return rate;
}

function applyPlaybackRate(rate) {
  state.playbackRate = rate;
  if (playbackRateInput) {
    playbackRateInput.value = rate.toString();
  }
  video.playbackRate = rate;
  video.defaultPlaybackRate = rate;
}

// Trim timing
function sanitizeTimes() {
  if (!state.duration) {
    return { start: 0, end: 0 };
  }
  let start = parseFloat(startTimeInput.value);
  let end = parseFloat(endTimeInput.value);
  if (!Number.isFinite(start)) {
    start = 0;
  }
  if (!Number.isFinite(end)) {
    end = state.duration;
  }
  start = Math.min(Math.max(start, 0), state.duration);
  end = Math.min(Math.max(end, 0), state.duration);
  if (end <= start) {
    end = Math.min(state.duration, start + 0.1);
  }
  startTimeInput.value = start.toFixed(1);
  endTimeInput.value = end.toFixed(1);
  return { start, end };
}

// Crop geometry
const MIN_CROP_SIZE = 32;

function getVideoSize() {
  return {
    width: video.videoWidth || 0,
    height: video.videoHeight || 0,
  };
}

function clampCropRect(rect) {
  const { width: videoW, height: videoH } = getVideoSize();
  if (!videoW || !videoH) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const minW = Math.min(MIN_CROP_SIZE, videoW);
  const minH = Math.min(MIN_CROP_SIZE, videoH);
  const width = Math.min(Math.max(rect.width, minW), videoW);
  const height = Math.min(Math.max(rect.height, minH), videoH);
  const x = Math.min(Math.max(rect.x, 0), videoW - width);
  const y = Math.min(Math.max(rect.y, 0), videoH - height);
  return { x, y, width, height };
}

function updateCropInputs() {
  if (!state.crop.width || !state.crop.height) {
    outWidthInput.value = '';
    outHeightInput.value = '';
    return;
  }
  outWidthInput.value = String(Math.round(state.crop.width));
  outHeightInput.value = String(Math.round(state.crop.height));
}

function updateCropSizeLabel() {
  if (!cropSizeEl) {
    return;
  }
  if (!state.crop.width || !state.crop.height) {
    cropSizeEl.textContent = '--';
    return;
  }
  cropSizeEl.textContent = `出力サイズ: ${Math.round(state.crop.width)} x ${Math.round(
    state.crop.height
  )} px`;
}

function updateCropBox() {
  if (!cropBox) {
    return;
  }
  const { width: videoW, height: videoH } = getVideoSize();
  if (!videoW || !videoH) {
    cropBox.classList.add('hidden');
    return;
  }
  cropBox.classList.remove('hidden');
  const rect = preview.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  const scaleX = rect.width / videoW;
  const scaleY = rect.height / videoH;
  cropBox.style.left = `${state.crop.x * scaleX}px`;
  cropBox.style.top = `${state.crop.y * scaleY}px`;
  cropBox.style.width = `${state.crop.width * scaleX}px`;
  cropBox.style.height = `${state.crop.height * scaleY}px`;
}

function setCropRect(rect) {
  state.crop = clampCropRect(rect);
  updateCropInputs();
  updateCropSizeLabel();
  updateCropBox();
}

function setCropFull() {
  const { width, height } = getVideoSize();
  setCropRect({ x: 0, y: 0, width, height });
}

function updatePreviewLayout() {
  if (!previewSection) {
    return;
  }
  const { width, height } = getVideoSize();
  if (!width || !height) {
    previewSection.classList.remove('side-by-side');
    return;
  }
  const isPortrait = height > width;
  previewSection.classList.toggle('side-by-side', isPortrait);
}

function applyCropSizeFromInputs() {
  if (!state.duration) {
    return;
  }
  const { width: videoW, height: videoH } = getVideoSize();
  if (!videoW || !videoH) {
    return;
  }
  let newW = parseInt(outWidthInput.value, 10);
  let newH = parseInt(outHeightInput.value, 10);
  if (!Number.isFinite(newW) || newW <= 0) {
    newW = state.crop.width || videoW;
  }
  if (!Number.isFinite(newH) || newH <= 0) {
    newH = state.crop.height || videoH;
  }
  newW = Math.min(Math.max(newW, 1), videoW);
  newH = Math.min(Math.max(newH, 1), videoH);
  const centerX = state.crop.x + state.crop.width / 2;
  const centerY = state.crop.y + state.crop.height / 2;
  setCropRect({
    x: centerX - newW / 2,
    y: centerY - newH / 2,
    width: newW,
    height: newH,
  });
}

// Preview rendering
function drawFrame() {
  const { width: videoW, height: videoH } = getVideoSize();
  if (!videoW || !videoH || video.readyState < 2) {
    return;
  }
  const ctx = preview.getContext('2d');
  if (preview.width !== videoW || preview.height !== videoH) {
    preview.width = videoW;
    preview.height = videoH;
  }
  ctx.clearRect(0, 0, preview.width, preview.height);
  ctx.drawImage(video, 0, 0, videoW, videoH);
  updateCropBox();
}

function primeFirstFrame() {
  if (!state.duration) {
    return;
  }
  if (video.requestVideoFrameCallback) {
    video.requestVideoFrameCallback(() => {
      drawFrame();
    });
  }
  if (video.readyState >= 2) {
    drawFrame();
    return;
  }
  if (Number.isFinite(video.duration) && video.duration > 0 && video.currentTime === 0) {
    const targetTime = Math.min(0.001, Math.max(0, video.duration - 0.001));
    try {
      video.currentTime = targetTime;
    } catch (error) {
      return;
    }
  }
}

function clearPreviewCanvas() {
  const ctx = preview.getContext('2d');
  ctx.clearRect(0, 0, preview.width, preview.height);
  preview.width = 0;
  preview.height = 0;
}

function startRenderLoop() {
  if (state.renderHandle != null) {
    return;
  }
  const loop = () => {
    if (!video.paused && !video.ended) {
      drawFrame();
      state.renderHandle = requestAnimationFrame(loop);
      return;
    }
    state.renderHandle = null;
  };
  loop();
}

function stopRenderLoop() {
  if (state.renderHandle != null) {
    cancelAnimationFrame(state.renderHandle);
    state.renderHandle = null;
  }
}

// Metadata
function updateInfo() {
  fileNameEl.textContent = state.fileName || '未選択';
  durationEl.textContent = state.duration ? formatTime(state.duration) : '--';
  if (video.videoWidth && video.videoHeight) {
    sourceSizeEl.textContent = `${video.videoWidth} x ${video.videoHeight}`;
  } else {
    sourceSizeEl.textContent = '--';
  }
}

function revokeObjectUrl() {
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }
}

// File lifecycle
function loadFile(file) {
  if (!file || !file.type.startsWith('video/')) {
    setStatus('動画ファイルを選択してください。');
    return;
  }
  revokeObjectUrl();
  state.objectUrl = URL.createObjectURL(file);
  state.file = file;
  state.fileName = file.name;
  state.duration = 0;
  state.crop = { x: 0, y: 0, width: 0, height: 0 };
  updateInfo();
  updateCropInputs();
  updateCropSizeLabel();
  updateCropBox();
  setHasVideo(true);
  if (clearVideo) {
    clearVideo.disabled = false;
  }
  setButtonsEnabled(false);
  video.src = state.objectUrl;
  video.load();
  applyPlaybackRate(state.playbackRate);
  setStatus('動画を読み込みました。');
}

function clearVideoState() {
  stopRenderLoop();
  revokeObjectUrl();
  state.file = null;
  state.fileName = null;
  state.duration = 0;
  state.crop = { x: 0, y: 0, width: 0, height: 0 };
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  fileInput.value = '';
  startTimeInput.value = '';
  endTimeInput.value = '';
  outWidthInput.value = '';
  outHeightInput.value = '';
  updateInfo();
  updateCropInputs();
  updateCropSizeLabel();
  clearPreviewCanvas();
  updateCropBox();
  updatePreviewLayout();
  applyPlaybackRate(DEFAULT_PLAYBACK_RATE);
  setHasVideo(false);
  setButtonsEnabled(false);
  if (clearVideo) {
    clearVideo.disabled = true;
  }
  setStatus('動画をクリアしました。');
}

// Export helpers
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function getInputName() {
  if (!state.fileName) {
    return 'input';
  }
  const parts = state.fileName.split('.');
  if (parts.length < 2) {
    return 'input';
  }
  const ext = parts.pop();
  if (!ext) {
    return 'input';
  }
  return `input.${ext}`;
}

function getCropFilter() {
  const { width: videoW, height: videoH } = getVideoSize();
  if (!videoW || !videoH || !state.crop.width || !state.crop.height) {
    return null;
  }
  const crop = clampCropRect(state.crop);
  if (crop.x === 0 && crop.y === 0 && crop.width === videoW && crop.height === videoH) {
    return null;
  }
  return `crop=${Math.round(crop.width)}:${Math.round(crop.height)}:${Math.round(
    crop.x
  )}:${Math.round(crop.y)}`;
}

function buildAtempoFilters(rate) {
  if (!Number.isFinite(rate) || rate <= 0 || Math.abs(rate - 1) < 0.001) {
    return [];
  }
  const filters = [];
  let remaining = rate;
  while (remaining < 0.5) {
    filters.push('atempo=0.5');
    remaining /= 0.5;
  }
  while (remaining > 2) {
    filters.push('atempo=2.0');
    remaining /= 2.0;
  }
  const finalRate = Number(remaining.toFixed(3));
  if (Math.abs(finalRate - 1) >= 0.001) {
    filters.push(`atempo=${finalRate}`);
  }
  return filters;
}

function getPlaybackRate() {
  return sanitizePlaybackRate(state.playbackRate);
}

function toBlob(data, type) {
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  return new Blob([buffer], { type });
}

// FFmpeg execution
async function ensureFfmpeg() {
  if (ffmpegState.instance) {
    return ffmpegState.instance;
  }
  if (ffmpegState.loading) {
    return ffmpegState.loading;
  }
  if (!window.FFmpegWASM || !window.FFmpegWASM.FFmpeg) {
    throw new Error('FFmpeg が利用できません。');
  }
  const ffmpeg = new window.FFmpegWASM.FFmpeg();
  ffmpeg.on('progress', ({ progress }) => {
    if (Number.isFinite(progress)) {
      const percent = Math.round(progress * 100);
      setStatus(`FFmpeg 処理中 ${percent}%`);
    }
  });
  const coreURL = chrome.runtime.getURL('vendor/ffmpeg/ffmpeg-core.js');
  const wasmURL = chrome.runtime.getURL('vendor/ffmpeg/ffmpeg-core.wasm');
  setStatus('FFmpeg を読み込み中...');
  ffmpegState.loading = ffmpeg
    .load({ coreURL, wasmURL })
    .then(() => {
      ffmpegState.instance = ffmpeg;
      return ffmpeg;
    })
    .finally(() => {
      ffmpegState.loading = null;
    });
  return ffmpegState.loading;
}

async function safeDelete(ffmpeg, path) {
  try {
    await ffmpeg.deleteFile(path);
  } catch (error) {
    return;
  }
}

async function runFfmpegCommand({ args, outputName, outputType }) {
  if (!state.file) {
    throw new Error('先に動画を読み込んでください。');
  }
  const ffmpeg = await ensureFfmpeg();
  const inputName = getInputName();
  await safeDelete(ffmpeg, inputName);
  await safeDelete(ffmpeg, outputName);
  const buffer = await state.file.arrayBuffer();
  await ffmpeg.writeFile(inputName, new Uint8Array(buffer));
  try {
    await ffmpeg.exec(args);
    const data = await ffmpeg.readFile(outputName);
    return toBlob(data, outputType);
  } finally {
    await safeDelete(ffmpeg, inputName);
    await safeDelete(ffmpeg, outputName);
  }
}


// Export actions
async function exportVideoWithFfmpeg() {
  const { start, end } = sanitizeTimes();
  const duration = Math.max(0.1, end - start);
  const cropFilter = getCropFilter();
  const speed = getPlaybackRate();
  const videoFilters = [];
  if (cropFilter) {
    videoFilters.push(cropFilter);
  }
  if (Math.abs(speed - 1) >= 0.001) {
    videoFilters.push(`setpts=PTS/${Number(speed.toFixed(3))}`);
  }
  const audioFilters = buildAtempoFilters(speed);
  const inputName = getInputName();
  const outputName = 'output.mp4';
  const baseArgs = [
    '-i',
    inputName,
    '-ss',
    `${start}`,
    '-t',
    `${duration}`,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
  ];
  if (videoFilters.length) {
    baseArgs.push('-vf', videoFilters.join(','));
  }
  if (audioFilters.length) {
    baseArgs.push('-af', audioFilters.join(','));
  }
  const primaryArgs = baseArgs.concat([
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    outputName,
  ]);
  const fallbackArgs = baseArgs.concat([
    '-c:v',
    'mpeg4',
    '-q:v',
    '4',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    outputName,
  ]);
  let blob;
  try {
    blob = await runFfmpegCommand({
      args: primaryArgs,
      outputName,
      outputType: 'video/mp4',
    });
  } catch (error) {
    blob = await runFfmpegCommand({
      args: fallbackArgs,
      outputName,
      outputType: 'video/mp4',
    });
  }
  const clip = formatClipLabel(start, end);
  downloadBlob(blob, `${baseName()}-${clip}.mp4`);
}

async function exportAudioWithFfmpeg() {
  const { start, end } = sanitizeTimes();
  const duration = Math.max(0.1, end - start);
  const speed = getPlaybackRate();
  const audioFilters = buildAtempoFilters(speed);
  const inputName = getInputName();
  const outputName = 'audio.mp3';
  const baseArgs = [
    '-i',
    inputName,
    '-ss',
    `${start}`,
    '-t',
    `${duration}`,
    '-vn',
    '-ar',
    '44100',
    '-ac',
    '2',
  ];
  if (audioFilters.length) {
    baseArgs.push('-af', audioFilters.join(','));
  }
  const primaryArgs = baseArgs.concat([
    '-c:a',
    'libmp3lame',
    '-q:a',
    '2',
    outputName,
  ]);
  const fallbackArgs = baseArgs.concat([
    '-c:a',
    'mp3',
    '-q:a',
    '2',
    outputName,
  ]);
  let blob;
  try {
    blob = await runFfmpegCommand({
      args: primaryArgs,
      outputName,
      outputType: 'audio/mpeg',
    });
  } catch (error) {
    blob = await runFfmpegCommand({
      args: fallbackArgs,
      outputName,
      outputType: 'audio/mpeg',
    });
  }
  const clip = formatClipLabel(start, end);
  downloadBlob(blob, `${baseName()}-audio-${clip}.mp3`);
}

async function exportFrameFullWithFfmpeg() {
  const time = Math.max(0, video.currentTime);
  const inputName = getInputName();
  const outputName = 'frame-full.png';
  const args = ['-ss', `${time}`, '-i', inputName, '-frames:v', '1'];
  args.push(outputName);
  const blob = await runFfmpegCommand({
    args,
    outputName,
    outputType: 'image/png',
  });
  downloadBlob(blob, `${baseName()}-frame-${formatStamp(time)}.png`);
}

async function exportFrameCroppedWithFfmpeg() {
  const time = Math.max(0, video.currentTime);
  const cropFilter = getCropFilter();
  const inputName = getInputName();
  const outputName = 'frame-crop.png';
  const args = ['-ss', `${time}`, '-i', inputName, '-frames:v', '1'];
  if (cropFilter) {
    args.push('-vf', cropFilter);
  }
  args.push(outputName);
  const blob = await runFfmpegCommand({
    args,
    outputName,
    outputType: 'image/png',
  });
  downloadBlob(blob, `${baseName()}-crop-${formatStamp(time)}.png`);
}

function exportFrameCroppedFromCanvas() {
  return new Promise((resolve, reject) => {
    const { width: videoW, height: videoH } = getVideoSize();
    if (!videoW || !videoH) {
      reject(new Error('先に動画を読み込んでください。'));
      return;
    }
    const crop = clampCropRect(state.crop);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(crop.width));
    canvas.height = Math.max(1, Math.round(crop.height));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      video,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      canvas.width,
      canvas.height
    );
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('フレーム保存に失敗しました。'));
        return;
      }
      const time = video.currentTime.toFixed(1).replace('.', 'p');
      downloadBlob(blob, `${baseName()}-crop-${time}.png`);
      resolve();
    }, 'image/png');
  });
}

function exportFrameFullFromCanvas() {
  return new Promise((resolve, reject) => {
    const { width: videoW, height: videoH } = getVideoSize();
    if (!videoW || !videoH) {
      reject(new Error('先に動画を読み込んでください。'));
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = videoW;
    canvas.height = videoH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, videoW, videoH);
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('フレーム保存に失敗しました。'));
        return;
      }
      const time = video.currentTime.toFixed(1).replace('.', 'p');
      downloadBlob(blob, `${baseName()}-frame-${time}.png`);
      resolve();
    }, 'image/png');
  });
}

// Crop interactions
const cropDrag = {
  active: false,
  mode: null,
  startX: 0,
  startY: 0,
  startRect: null,
  scaleX: 1,
  scaleY: 1,
};

function startCropDrag(event, mode) {
  if (!state.duration) {
    return;
  }
  event.preventDefault();
  const rect = preview.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  cropDrag.active = true;
  cropDrag.mode = mode;
  cropDrag.startX = event.clientX;
  cropDrag.startY = event.clientY;
  cropDrag.startRect = { ...state.crop };
  cropDrag.scaleX = rect.width / (video.videoWidth || 1);
  cropDrag.scaleY = rect.height / (video.videoHeight || 1);
  if (cropBox) {
    cropBox.setPointerCapture(event.pointerId);
  }
}

function updateCropDrag(event) {
  if (!cropDrag.active || !cropDrag.startRect) {
    return;
  }
  const dx = (event.clientX - cropDrag.startX) / cropDrag.scaleX;
  const dy = (event.clientY - cropDrag.startY) / cropDrag.scaleY;
  if (cropDrag.mode === 'resize-br') {
    setCropRect({
      x: cropDrag.startRect.x,
      y: cropDrag.startRect.y,
      width: cropDrag.startRect.width + dx,
      height: cropDrag.startRect.height + dy,
    });
    return;
  }
  if (cropDrag.mode === 'resize-tl') {
    setCropRect({
      x: cropDrag.startRect.x + dx,
      y: cropDrag.startRect.y + dy,
      width: cropDrag.startRect.width - dx,
      height: cropDrag.startRect.height - dy,
    });
    return;
  } else {
    setCropRect({
      x: cropDrag.startRect.x + dx,
      y: cropDrag.startRect.y + dy,
      width: cropDrag.startRect.width,
      height: cropDrag.startRect.height,
    });
  }
}

function endCropDrag(event) {
  if (!cropDrag.active) {
    return;
  }
  cropDrag.active = false;
  cropDrag.mode = null;
  cropDrag.startRect = null;
  if (cropBox && cropBox.hasPointerCapture(event.pointerId)) {
    cropBox.releasePointerCapture(event.pointerId);
  }
}

// Event wiring
if (cropHandle) {
  cropHandle.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    startCropDrag(event, 'resize-br');
  });
}

if (cropHandleTL) {
  cropHandleTL.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    startCropDrag(event, 'resize-tl');
  });
}

if (cropBox) {
  cropBox.addEventListener('pointerdown', (event) => {
    if (event.target === cropHandle || event.target === cropHandleTL) {
      return;
    }
    startCropDrag(event, 'move');
  });
  cropBox.addEventListener('pointermove', updateCropDrag);
  cropBox.addEventListener('pointerup', endCropDrag);
  cropBox.addEventListener('pointercancel', endCropDrag);
}

if (pickFile) {
  pickFile.addEventListener('click', () => fileInput.click());
}
if (clearVideo) {
  clearVideo.addEventListener('click', clearVideoState);
}
fileInput.addEventListener('change', (event) => {
  const file = event.target.files && event.target.files[0];
  if (file) {
    loadFile(file);
  }
});

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('active');
});
dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('active');
});
dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('active');
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) {
    loadFile(file);
  }
});

window.addEventListener('resize', () => {
  updateCropBox();
  updatePreviewLayout();
});

video.addEventListener('loadedmetadata', () => {
  state.duration = video.duration;
  startTimeInput.value = '0.0';
  endTimeInput.value = state.duration.toFixed(1);
  setCropFull();
  updateInfo();
  drawFrame();
  updatePreviewLayout();
  setButtonsEnabled(true);
  primeFirstFrame();
  applyPlaybackRate(state.playbackRate);
});

video.addEventListener('play', startRenderLoop);
video.addEventListener('pause', () => {
  stopRenderLoop();
  drawFrame();
});
video.addEventListener('seeked', drawFrame);
video.addEventListener('loadeddata', drawFrame);
video.addEventListener('canplay', drawFrame);
video.addEventListener('timeupdate', () => {
  if (state.duration) {
    durationEl.textContent = `${formatTime(video.currentTime)} / ${formatTime(state.duration)}`;
  }
});

setStartBtn.addEventListener('click', () => {
  startTimeInput.value = video.currentTime.toFixed(1);
  sanitizeTimes();
});

setEndBtn.addEventListener('click', () => {
  endTimeInput.value = video.currentTime.toFixed(1);
  sanitizeTimes();
});

useSourceBtn.addEventListener('click', () => {
  if (video.videoWidth && video.videoHeight) {
    setCropFull();
    drawFrame();
  }
});

[startTimeInput, endTimeInput].forEach((input) => {
  input.addEventListener('change', () => {
    sanitizeTimes();
  });
});

[outWidthInput, outHeightInput].forEach((input) => {
  input.addEventListener('change', () => {
    applyCropSizeFromInputs();
    drawFrame();
  });
});

if (playbackRateInput) {
  playbackRateInput.addEventListener('input', () => {
    applyPlaybackRate(sanitizePlaybackRate(playbackRateInput.value));
  });
}

if (modeButtons.length) {
  modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setUIMode(button.dataset.mode);
    });
  });
}

exportVideoBtn.addEventListener('click', async () => {
  if (!state.duration) {
    setStatus('先に動画を読み込んでください。');
    return;
  }
  setProcessing(true);
  try {
    setStatus('MP4を書き出し中...');
    await exportVideoWithFfmpeg();
    setStatus('MP4の書き出しが完了しました。');
  } catch (error) {
    setStatus(error.message || 'MP4の書き出しに失敗しました。');
  } finally {
    setProcessing(false);
  }
});

async function handleExportFrame({ statusPrefix, mode }) {
  if (!state.duration) {
    setStatus('先に動画を読み込んでください。');
    return;
  }
  setProcessing(true);
  try {
    setStatus(`${statusPrefix}...`);
    if (mode === 'crop') {
      await exportFrameCroppedWithFfmpeg();
    } else {
      await exportFrameFullWithFfmpeg();
    }
    setStatus('フレームを保存しました。');
  } catch (error) {
    try {
      setStatus('FFmpegに失敗しました。キャンバスで保存します...');
      if (mode === 'crop') {
        await exportFrameCroppedFromCanvas();
      } else {
        await exportFrameFullFromCanvas();
      }
      setStatus('フレームを保存しました。');
    } catch (fallbackError) {
      setStatus(fallbackError.message || error.message || 'フレーム保存に失敗しました。');
    }
  } finally {
    setProcessing(false);
  }
}

exportFrameBtn.addEventListener('click', () => {
  handleExportFrame({ statusPrefix: 'フレームを書き出し中', mode: 'full' });
});

if (exportFrameCropBtn) {
  exportFrameCropBtn.addEventListener('click', () => {
    handleExportFrame({ statusPrefix: 'クロップフレームを書き出し中', mode: 'crop' });
  });
}

exportAudioBtn.addEventListener('click', async () => {
  if (!state.duration) {
    setStatus('先に動画を読み込んでください。');
    return;
  }
  setProcessing(true);
  try {
    setStatus('MP3を書き出し中...');
    await exportAudioWithFfmpeg();
    setStatus('MP3の書き出しが完了しました。');
  } catch (error) {
    setStatus(error.message || 'MP3の書き出しに失敗しました。');
  } finally {
    setProcessing(false);
  }
});

// Init
setButtonsEnabled(false);
updateInfo();
updateCropBox();
updateCropSizeLabel();
if (clearVideo) {
  clearVideo.disabled = true;
}
setHasVideo(false);
applyPlaybackRate(DEFAULT_PLAYBACK_RATE);
setUIMode(loadUIMode());
setStatus('動画をドロップして開始してください。');
