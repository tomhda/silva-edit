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
const audioQualitySelect = document.getElementById('audioQuality');
const volumeInput = document.getElementById('volume');
const volumeValue = document.getElementById('volumeValue');
const rotateLeftBtn = document.getElementById('rotateLeft');
const rotateRightBtn = document.getElementById('rotateRight');
const flipHBtn = document.getElementById('flipH');
const flipVBtn = document.getElementById('flipV');
const transformState = document.getElementById('transformState');
const modeButtons = document.querySelectorAll('.mode-btn');

// State
const state = {
  objectUrl: null,
  file: null,
  fileName: null,
  mediaType: null,
  duration: 0,
  renderHandle: null,
  playbackRate: 1,
  volume: 1,
  transform: {
    rotation: 0,
    flipH: false,
    flipV: false,
  },
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
const DEFAULT_VOLUME = 1;
const MIN_VOLUME = 0;
const MAX_VOLUME = 2;
const MEDIA_VIDEO = 'video';
const MEDIA_AUDIO = 'audio';
const DEFAULT_AUDIO_QUALITY = 'high';
const AUDIO_BITRATES = {
  high: '320k',
  medium: '192k',
};
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'opus']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'ogv', 'mkv']);
const ROTATION_STEP = 90;
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

function setMediaMode(type) {
  const hasMedia = type === MEDIA_VIDEO || type === MEDIA_AUDIO;
  state.mediaType = type;
  document.body.classList.toggle('has-video', hasMedia);
  document.body.classList.toggle('media-audio', type === MEDIA_AUDIO);
  document.body.classList.toggle('media-video', type === MEDIA_VIDEO);
}

function setButtonsEnabled(enabled) {
  const isAudio = state.mediaType === MEDIA_AUDIO;
  exportVideoBtn.disabled = !enabled || isAudio;
  exportFrameBtn.disabled = !enabled || isAudio;
  if (exportFrameCropBtn) {
    exportFrameCropBtn.disabled = !enabled || isAudio;
  }
  exportAudioBtn.disabled = !enabled;
  setStartBtn.disabled = !enabled;
  setEndBtn.disabled = !enabled;
  useSourceBtn.disabled = !enabled || isAudio;
  if (rotateLeftBtn) {
    rotateLeftBtn.disabled = !enabled || isAudio;
  }
  if (rotateRightBtn) {
    rotateRightBtn.disabled = !enabled || isAudio;
  }
  if (flipHBtn) {
    flipHBtn.disabled = !enabled || isAudio;
  }
  if (flipVBtn) {
    flipVBtn.disabled = !enabled || isAudio;
  }
  if (playbackRateInput) {
    playbackRateInput.disabled = !enabled;
  }
  if (audioQualitySelect) {
    audioQualitySelect.disabled = !enabled;
  }
  if (volumeInput) {
    volumeInput.disabled = !enabled || isAudio;
  }
  if (outWidthInput) {
    outWidthInput.disabled = !enabled || isAudio;
  }
  if (outHeightInput) {
    outHeightInput.disabled = !enabled || isAudio;
  }
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

function getMediaLabel(type = state.mediaType) {
  return type === MEDIA_AUDIO ? '音声' : '動画';
}

function getFileExtension(fileName) {
  if (!fileName) {
    return '';
  }
  const parts = fileName.split('.');
  if (parts.length < 2) {
    return '';
  }
  return parts.pop().toLowerCase();
}

function detectMediaType(file) {
  if (!file) {
    return null;
  }
  if (file.type) {
    if (file.type.startsWith('video/')) {
      return MEDIA_VIDEO;
    }
    if (file.type.startsWith('audio/')) {
      return MEDIA_AUDIO;
    }
  }
  const ext = getFileExtension(file.name);
  if (AUDIO_EXTENSIONS.has(ext)) {
    return MEDIA_AUDIO;
  }
  if (VIDEO_EXTENSIONS.has(ext)) {
    return MEDIA_VIDEO;
  }
  return null;
}

function getAudioBitrate() {
  if (!audioQualitySelect) {
    return AUDIO_BITRATES[DEFAULT_AUDIO_QUALITY];
  }
  const value = audioQualitySelect.value;
  return AUDIO_BITRATES[value] || AUDIO_BITRATES[DEFAULT_AUDIO_QUALITY];
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

function sanitizeVolume(value) {
  let percent = parseFloat(value);
  if (!Number.isFinite(percent)) {
    percent = DEFAULT_VOLUME * 100;
  }
  const min = MIN_VOLUME * 100;
  const max = MAX_VOLUME * 100;
  percent = Math.min(Math.max(percent, min), max);
  return Math.round(percent);
}

function applyVolume(percent) {
  const clamped = sanitizeVolume(percent);
  state.volume = clamped / 100;
  if (volumeInput) {
    volumeInput.value = String(clamped);
  }
  if (volumeValue) {
    volumeValue.textContent = `${clamped}%`;
  }
  video.volume = Math.min(state.volume, 1);
}

function getVolume() {
  return Math.min(Math.max(state.volume, MIN_VOLUME), MAX_VOLUME);
}

function getVolumeFilter() {
  if (state.mediaType === MEDIA_AUDIO) {
    return null;
  }
  const volume = getVolume();
  if (Math.abs(volume - 1) < 0.001) {
    return null;
  }
  return `volume=${volume.toFixed(2)}`;
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

function getSourceSize() {
  return {
    width: video.videoWidth || 0,
    height: video.videoHeight || 0,
  };
}

function getDisplaySize() {
  const { width, height } = getSourceSize();
  if (!width || !height) {
    return { width: 0, height: 0 };
  }
  if (state.transform.rotation % 180 === 0) {
    return { width, height };
  }
  return { width: height, height: width };
}

function clampCropRect(rect) {
  const { width: videoW, height: videoH } = getDisplaySize();
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
  const { width: videoW, height: videoH } = getDisplaySize();
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
  const { width, height } = getDisplaySize();
  setCropRect({ x: 0, y: 0, width, height });
}

function updatePreviewLayout() {
  if (!previewSection) {
    return;
  }
  const { width, height } = getDisplaySize();
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
  const { width: videoW, height: videoH } = getDisplaySize();
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

// Transform
function normalizeRotation(degrees) {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function updateTransformUI() {
  if (transformState) {
    transformState.textContent = `回転 ${state.transform.rotation}°`;
  }
  if (flipHBtn) {
    flipHBtn.classList.toggle('active', state.transform.flipH);
    flipHBtn.setAttribute('aria-pressed', state.transform.flipH ? 'true' : 'false');
  }
  if (flipVBtn) {
    flipVBtn.classList.toggle('active', state.transform.flipV);
    flipVBtn.setAttribute('aria-pressed', state.transform.flipV ? 'true' : 'false');
  }
}

function applyVideoTransform() {
  const { rotation, flipH, flipV } = state.transform;
  const transforms = [];
  if (rotation) {
    transforms.push(`rotate(${rotation}deg)`);
  }
  if (flipH) {
    transforms.push('scaleX(-1)');
  }
  if (flipV) {
    transforms.push('scaleY(-1)');
  }
  video.style.transform = transforms.length ? transforms.join(' ') : 'none';
}

function rotateCropRect(rect, prevW, prevH, delta) {
  const amount = normalizeRotation(delta);
  if (!prevW || !prevH) {
    return rect;
  }
  if (amount === 90) {
    return {
      x: prevH - (rect.y + rect.height),
      y: rect.x,
      width: rect.height,
      height: rect.width,
    };
  }
  if (amount === 180) {
    return {
      x: prevW - (rect.x + rect.width),
      y: prevH - (rect.y + rect.height),
      width: rect.width,
      height: rect.height,
    };
  }
  if (amount === 270) {
    return {
      x: rect.y,
      y: prevW - (rect.x + rect.width),
      width: rect.height,
      height: rect.width,
    };
  }
  return rect;
}

function flipCropRect(rect, displayW, displayH, flipH, flipV) {
  let next = { ...rect };
  if (flipH) {
    next.x = displayW - (next.x + next.width);
  }
  if (flipV) {
    next.y = displayH - (next.y + next.height);
  }
  return next;
}

function rotateTransform(delta) {
  const prevDisplay = getDisplaySize();
  const rotated = rotateCropRect(state.crop, prevDisplay.width, prevDisplay.height, delta);
  state.transform.rotation = normalizeRotation(state.transform.rotation + delta);
  applyVideoTransform();
  updatePreviewLayout();
  if (state.duration) {
    setCropRect(rotated);
  } else {
    updateCropBox();
  }
  updateTransformUI();
  drawFrame();
}

function toggleFlip(axis) {
  const display = getDisplaySize();
  if (axis === 'h') {
    state.transform.flipH = !state.transform.flipH;
  } else {
    state.transform.flipV = !state.transform.flipV;
  }
  applyVideoTransform();
  if (state.duration) {
    const flipped = flipCropRect(
      state.crop,
      display.width,
      display.height,
      axis === 'h',
      axis === 'v'
    );
    setCropRect(flipped);
  } else {
    updateCropBox();
  }
  updateTransformUI();
  drawFrame();
}

function drawTransformedSource(ctx, source, sourceW, sourceH, displayW, displayH) {
  if (!sourceW || !sourceH) {
    return false;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(displayW / 2, displayH / 2);
  const rad = (state.transform.rotation * Math.PI) / 180;
  ctx.rotate(rad);
  const scaleX = state.transform.flipH ? -1 : 1;
  const scaleY = state.transform.flipV ? -1 : 1;
  ctx.scale(scaleX, scaleY);
  ctx.drawImage(source, -sourceW / 2, -sourceH / 2, sourceW, sourceH);
  ctx.restore();
  return true;
}

function drawTransformedVideo(ctx, displayW, displayH) {
  const { width: srcW, height: srcH } = getSourceSize();
  return drawTransformedSource(ctx, video, srcW, srcH, displayW, displayH);
}

async function getFrameBitmap() {
  if (!('createImageBitmap' in window)) {
    return null;
  }
  try {
    return await createImageBitmap(video, {
      colorSpaceConversion: 'none',
      premultiplyAlpha: 'none',
    });
  } catch (error) {
    try {
      return await createImageBitmap(video);
    } catch (fallbackError) {
      return null;
    }
  }
}

// Preview rendering
function drawFrame() {
  if (state.mediaType !== MEDIA_VIDEO) {
    return;
  }
  const { width: displayW, height: displayH } = getDisplaySize();
  if (!displayW || !displayH || video.readyState < 2) {
    return;
  }
  const ctx = preview.getContext('2d');
  if (preview.width !== displayW || preview.height !== displayH) {
    preview.width = displayW;
    preview.height = displayH;
  }
  ctx.clearRect(0, 0, preview.width, preview.height);
  drawTransformedVideo(ctx, preview.width, preview.height);
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
  if (state.mediaType !== MEDIA_VIDEO) {
    return;
  }
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
  const mediaType = detectMediaType(file);
  if (!file || !mediaType) {
    setStatus('動画/音声ファイルを選択してください。');
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
  setMediaMode(mediaType);
  if (clearVideo) {
    clearVideo.disabled = false;
  }
  setButtonsEnabled(false);
  video.src = state.objectUrl;
  video.load();
  applyPlaybackRate(state.playbackRate);
  applyVolume(state.volume * 100);
  applyVideoTransform();
  setStatus(`${getMediaLabel(mediaType)}を読み込みました。`);
}

function clearVideoState() {
  const clearedLabel = getMediaLabel();
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
  state.transform = { rotation: 0, flipH: false, flipV: false };
  state.volume = DEFAULT_VOLUME;
  applyPlaybackRate(DEFAULT_PLAYBACK_RATE);
  applyVolume(DEFAULT_VOLUME * 100);
  applyVideoTransform();
  updateTransformUI();
  setMediaMode(null);
  setButtonsEnabled(false);
  if (clearVideo) {
    clearVideo.disabled = true;
  }
  setStatus(`${clearedLabel}をクリアしました。`);
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
  const { width: videoW, height: videoH } = getDisplaySize();
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

function getTransformFilters() {
  const filters = [];
  const rotation = state.transform.rotation;
  if (rotation === 90) {
    filters.push('transpose=1');
  } else if (rotation === 180) {
    filters.push('transpose=1', 'transpose=1');
  } else if (rotation === 270) {
    filters.push('transpose=2');
  }
  if (state.transform.flipH) {
    filters.push('hflip');
  }
  if (state.transform.flipV) {
    filters.push('vflip');
  }
  return filters;
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
    throw new Error('先にファイルを読み込んでください。');
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
  const videoFilters = getTransformFilters();
  if (cropFilter) {
    videoFilters.push(cropFilter);
  }
  if (Math.abs(speed - 1) >= 0.001) {
    videoFilters.push(`setpts=PTS/${Number(speed.toFixed(3))}`);
  }
  const audioFilters = [];
  const volumeFilter = getVolumeFilter();
  if (volumeFilter) {
    audioFilters.push(volumeFilter);
  }
  audioFilters.push(...buildAtempoFilters(speed));
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
  const audioFilters = [];
  const volumeFilter = getVolumeFilter();
  if (volumeFilter) {
    audioFilters.push(volumeFilter);
  }
  audioFilters.push(...buildAtempoFilters(speed));
  const bitrate = getAudioBitrate();
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
    '-b:a',
    bitrate,
    outputName,
  ]);
  const fallbackArgs = baseArgs.concat([
    '-c:a',
    'mp3',
    '-b:a',
    bitrate,
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
  const transformFilters = getTransformFilters();
  const filters = transformFilters.slice();
  filters.push('format=rgb24');
  if (filters.length) {
    args.push('-vf', filters.join(','));
  }
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
  const transformFilters = getTransformFilters();
  const inputName = getInputName();
  const outputName = 'frame-crop.png';
  const args = ['-ss', `${time}`, '-i', inputName, '-frames:v', '1'];
  const filters = transformFilters.slice();
  if (cropFilter) {
    filters.push(cropFilter);
  }
  filters.push('format=rgb24');
  if (filters.length) {
    args.push('-vf', filters.join(','));
  }
  args.push(outputName);
  const blob = await runFfmpegCommand({
    args,
    outputName,
    outputType: 'image/png',
  });
  downloadBlob(blob, `${baseName()}-crop-${formatStamp(time)}.png`);
}

async function exportFrameCroppedFromCanvas() {
  const { width: displayW, height: displayH } = getDisplaySize();
  if (!displayW || !displayH) {
    throw new Error('先に動画ファイルを読み込んでください。');
  }
  const crop = clampCropRect(state.crop);
  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = displayW;
  frameCanvas.height = displayH;
  const frameCtx = frameCanvas.getContext('2d');
  const bitmap = await getFrameBitmap();
  if (bitmap) {
    drawTransformedSource(
      frameCtx,
      bitmap,
      bitmap.width,
      bitmap.height,
      frameCanvas.width,
      frameCanvas.height
    );
    bitmap.close();
  } else if (!drawTransformedVideo(frameCtx, frameCanvas.width, frameCanvas.height)) {
    throw new Error('フレーム保存に失敗しました。');
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(crop.width));
  canvas.height = Math.max(1, Math.round(crop.height));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    frameCanvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    throw new Error('フレーム保存に失敗しました。');
  }
  const time = video.currentTime.toFixed(1).replace('.', 'p');
  downloadBlob(blob, `${baseName()}-crop-${time}.png`);
}

async function exportFrameFullFromCanvas() {
  const { width: displayW, height: displayH } = getDisplaySize();
  if (!displayW || !displayH) {
    throw new Error('先に動画ファイルを読み込んでください。');
  }
  const canvas = document.createElement('canvas');
  canvas.width = displayW;
  canvas.height = displayH;
  const ctx = canvas.getContext('2d');
  const bitmap = await getFrameBitmap();
  if (bitmap) {
    drawTransformedSource(ctx, bitmap, bitmap.width, bitmap.height, canvas.width, canvas.height);
    bitmap.close();
  } else if (!drawTransformedVideo(ctx, canvas.width, canvas.height)) {
    throw new Error('フレーム保存に失敗しました。');
  }
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    throw new Error('フレーム保存に失敗しました。');
  }
  const time = video.currentTime.toFixed(1).replace('.', 'p');
  downloadBlob(blob, `${baseName()}-frame-${time}.png`);
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
  const { width: displayW, height: displayH } = getDisplaySize();
  cropDrag.scaleX = rect.width / (displayW || 1);
  cropDrag.scaleY = rect.height / (displayH || 1);
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
  updateInfo();
  if (state.mediaType === MEDIA_VIDEO) {
    setCropFull();
    drawFrame();
    updatePreviewLayout();
    primeFirstFrame();
    applyPlaybackRate(state.playbackRate);
    applyVolume(state.volume * 100);
    applyVideoTransform();
  } else {
    clearPreviewCanvas();
    updatePreviewLayout();
    applyPlaybackRate(state.playbackRate);
    state.volume = DEFAULT_VOLUME;
    applyVolume(DEFAULT_VOLUME * 100);
    video.style.transform = 'none';
  }
  setButtonsEnabled(true);
  updateTransformUI();
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

if (volumeInput) {
  volumeInput.addEventListener('input', () => {
    applyVolume(volumeInput.value);
  });
}

if (rotateLeftBtn) {
  rotateLeftBtn.addEventListener('click', () => {
    rotateTransform(-ROTATION_STEP);
  });
}

if (rotateRightBtn) {
  rotateRightBtn.addEventListener('click', () => {
    rotateTransform(ROTATION_STEP);
  });
}

if (flipHBtn) {
  flipHBtn.addEventListener('click', () => {
    toggleFlip('h');
  });
}

if (flipVBtn) {
  flipVBtn.addEventListener('click', () => {
    toggleFlip('v');
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
    setStatus('先に動画ファイルを読み込んでください。');
    return;
  }
  if (state.mediaType !== MEDIA_VIDEO) {
    setStatus('動画ファイルのみ対応です。');
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
    setStatus('先に動画ファイルを読み込んでください。');
    return;
  }
  if (state.mediaType !== MEDIA_VIDEO) {
    setStatus('動画ファイルのみ対応です。');
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
    setStatus('先にファイルを読み込んでください。');
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
setMediaMode(null);
applyPlaybackRate(DEFAULT_PLAYBACK_RATE);
applyVolume(DEFAULT_VOLUME * 100);
applyVideoTransform();
updateTransformUI();
setUIMode(loadUIMode());
setStatus('動画/音声をドロップして開始してください。');
