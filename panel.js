// DOM
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const batchFrameInput = document.getElementById('batchFrameInput');
const batchAudioInput = document.getElementById('batchAudioInput');
const fileNameEl = document.getElementById('fileName');
const durationEl = document.getElementById('duration');
const sourceSizeEl = document.getElementById('sourceSize');
const video = document.getElementById('video');
const preview = document.getElementById('preview');
const cropBox = document.getElementById('cropBox');
const cropSizeEl = document.getElementById('cropSize');
const aspectButtons = document.querySelectorAll('.aspect-btn');
const editModeButtons = document.querySelectorAll('.edit-mode-btn');
const bulkTimeline = document.getElementById('bulkTimeline');
const bulkClipList = document.getElementById('bulkClipList');
const bulkClipCount = document.getElementById('bulkClipCount');
const bulkAddHere = document.getElementById('bulkAddHere');
const bulkRemoveLast = document.getElementById('bulkRemoveLast');
const bulkClearMarkers = document.getElementById('bulkClearMarkers');
const bulkAutoSeconds = document.getElementById('bulkAutoSeconds');
const bulkAutoApply = document.getElementById('bulkAutoApply');
const bulkExportAllMp4 = document.getElementById('bulkExportAllMp4');
const bulkExportAllMp3 = document.getElementById('bulkExportAllMp3');
const bulkExportFrames = document.getElementById('bulkExportFrames');
const batchFrameChoose = document.getElementById('batchFrameChoose');
const batchFrameSecond = document.getElementById('batchFrameSecond');
const batchFrameExport = document.getElementById('batchFrameExport');
const batchFrameCount = document.getElementById('batchFrameCount');
const batchFrameSummary = document.getElementById('batchFrameSummary');
const batchAudioChoose = document.getElementById('batchAudioChoose');
const batchAudioChannelSelect = document.getElementById('batchAudioChannelMode');
const batchAudioExport = document.getElementById('batchAudioExport');
const batchAudioCount = document.getElementById('batchAudioCount');
const batchAudioSummary = document.getElementById('batchAudioSummary');
const processingOverlay = document.getElementById('processingOverlay');
const processingLabel = document.getElementById('processingLabel');
const processingBar = document.getElementById('processingBar');
const processingFill = document.getElementById('processingFill');
const processingCount = document.getElementById('processingCount');
const previewSection = document.getElementById('previewSection');
const clearVideo = document.getElementById('clearVideo');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const trimStartRange = document.getElementById('trimStartRange');
const trimEndRange = document.getElementById('trimEndRange');
const trimRangeFill = document.getElementById('trimRange');
const trimThumbsCanvas = document.getElementById('trimThumbs');
const trimStartLabel = document.getElementById('trimStartLabel');
const trimEndLabel = document.getElementById('trimEndLabel');
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
const audioChannelSelect = document.getElementById('audioChannelMode');
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
  audioChannelMode: 'none',
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
  aspect: 'free',
  shiftHeld: false,
  thumbnails: { generated: false, duration: 0, rotation: 0, generation: 0 },
  uiMode: 'normal',
  splitMarkers: [],
  batchFrameFiles: [],
  batchAudioFiles: [],
  bulkProgress: { total: 0, done: 0, label: '', itemProgress: null },
};

// FFmpeg state
const ffmpegState = {
  instance: null,
  loading: null,
  progressHandler: null,
  lastProgressBucket: -1,
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
const MIN_GAP = 0.05;

function clampProgressValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
}

function setProcessingBarPercent(percent) {
  const number = Number(percent);
  const clamped = Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 0;
  const rounded = Math.round(clamped);
  if (processingFill) {
    processingFill.style.width = `${clamped}%`;
  }
  if (processingBar) {
    processingBar.setAttribute('aria-valuenow', `${rounded}`);
    processingBar.setAttribute('aria-valuetext', `${rounded}%`);
  }
}

function setActiveFfmpegProgressHandler(handler) {
  ffmpegState.progressHandler = typeof handler === 'function' ? handler : null;
  ffmpegState.lastProgressBucket = -1;
}
const UI_MODE_NORMAL = 'normal';
const UI_MODE_BULK = 'bulk';
const UI_MODE_BATCH = 'batch';
const CHANNEL_MODE_NONE = 'none';
const CHANNEL_MODE_LEFT_TO_STEREO = 'left-to-stereo';
const CHANNEL_MODE_RIGHT_TO_STEREO = 'right-to-stereo';
const BATCH_FRAME_MAX_FILES = 60;
const BATCH_AUDIO_MAX_FILES = 60;
const BATCH_MAX_TOTAL_BYTES = 8 * 1024 * 1024 * 1024;
const BATCH_AUDIO_MAX_FILE_BYTES = 1536 * 1024 * 1024;
const BATCH_FRAME_MAX_PIXELS = 33_000_000;

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
  if (state.uiMode === UI_MODE_BULK) drawBulkTimeline();
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

function setBatchButtonsEnabled() {
  const processing = isProcessing();
  if (batchFrameChoose) batchFrameChoose.disabled = processing;
  if (batchFrameSecond) batchFrameSecond.disabled = processing;
  if (batchFrameExport) {
    batchFrameExport.disabled = processing || state.batchFrameFiles.length === 0;
  }
  if (batchAudioChoose) batchAudioChoose.disabled = processing;
  if (batchAudioChannelSelect) batchAudioChannelSelect.disabled = processing;
  if (batchAudioExport) {
    batchAudioExport.disabled = processing || state.batchAudioFiles.length === 0;
  }
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
  if (bulkAddHere) bulkAddHere.disabled = !enabled || isAudio;
  if (bulkRemoveLast) bulkRemoveLast.disabled = !enabled || isAudio;
  if (bulkClearMarkers) bulkClearMarkers.disabled = !enabled || isAudio;
  if (bulkAutoApply) bulkAutoApply.disabled = !enabled || isAudio;
  if (bulkAutoSeconds) bulkAutoSeconds.disabled = !enabled || isAudio;
  if (bulkExportAllMp4) bulkExportAllMp4.disabled = !enabled || isAudio;
  if (bulkExportAllMp3) bulkExportAllMp3.disabled = !enabled;
  if (bulkExportFrames) bulkExportFrames.disabled = !enabled || isAudio;
  aspectButtons.forEach((b) => { b.disabled = !enabled || isAudio; });
  editModeButtons.forEach((b) => {
    const mode = b.dataset.editMode;
    b.disabled = isProcessing() || (mode === UI_MODE_BULK ? (!enabled || isAudio) : false);
  });
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
  if (audioChannelSelect) {
    audioChannelSelect.disabled = !enabled;
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
  setBatchButtonsEnabled();
}

function setProcessing(processing) {
  document.body.classList.toggle('processing', processing);
  if (fileInput) fileInput.disabled = processing;
  if (dropzone) dropzone.classList.toggle('disabled', processing);
  if (clearVideo) clearVideo.disabled = processing || !state.file;
  if (processingOverlay) {
    if (processing) {
      processingOverlay.hidden = false;
      if (processingLabel) processingLabel.textContent = '処理中...';
      setProcessingBarPercent(0);
      if (processingCount) processingCount.textContent = '';
    } else {
      processingOverlay.hidden = true;
    }
  }
  if (processing) {
    setButtonsEnabled(false);
    return;
  }
  setButtonsEnabled(Boolean(state.duration));
}

function isProcessing() {
  return document.body.classList.contains('processing');
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

function baseNameFromFile(fileName) {
  if (!fileName) {
    return 'export';
  }
  return fileName.replace(/\.[^.]+$/, '') || 'export';
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

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
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

function sanitizeAudioChannelMode(mode) {
  if (mode === CHANNEL_MODE_LEFT_TO_STEREO || mode === CHANNEL_MODE_RIGHT_TO_STEREO) {
    return mode;
  }
  return CHANNEL_MODE_NONE;
}

function setAudioChannelMode(mode) {
  state.audioChannelMode = sanitizeAudioChannelMode(mode);
  if (audioChannelSelect) {
    audioChannelSelect.value = state.audioChannelMode;
  }
}

function getAudioChannelFilter(mode = state.audioChannelMode) {
  const channelMode = sanitizeAudioChannelMode(mode);
  if (channelMode === CHANNEL_MODE_LEFT_TO_STEREO) {
    return 'pan=stereo|c0=c0|c1=c0';
  }
  if (channelMode === CHANNEL_MODE_RIGHT_TO_STEREO) {
    return 'pan=stereo|c0=c1|c1=c1';
  }
  return null;
}

function buildAudioFilters({ includeVolume = true, speed = 1, channelMode = state.audioChannelMode } = {}) {
  const filters = [];
  const channelFilter = getAudioChannelFilter(channelMode);
  if (channelFilter) {
    filters.push(channelFilter);
  }
  if (includeVolume) {
    const volumeFilter = getVolumeFilter();
    if (volumeFilter) {
      filters.push(volumeFilter);
    }
  }
  filters.push(...buildAtempoFilters(speed));
  return filters;
}

// Trim scrubber (dual range + thumbnail strip)
const TRIM_RANGE_MIN = 1000;
const TRIM_RANGE_MAX = 100000;
const TRIM_THUMB_COUNT = 5;
let trimSyncing = false;

function getTrimRangeMax() {
  if (!state.duration) return TRIM_RANGE_MIN;
  return Math.max(TRIM_RANGE_MIN, Math.min(TRIM_RANGE_MAX, Math.round(state.duration * 10)));
}

function rangeToTime(value) {
  if (!state.duration) return 0;
  const max = getTrimRangeMax();
  return (Number(value) / max) * state.duration;
}

function timeToRange(time) {
  if (!state.duration) return 0;
  const max = getTrimRangeMax();
  return Math.round((time / state.duration) * max);
}

function applyTrimRangeMax() {
  if (!trimStartRange || !trimEndRange) return;
  const max = getTrimRangeMax();
  trimStartRange.max = String(max);
  trimEndRange.max = String(max);
}

function updateTrimRangeFill() {
  if (!trimRangeFill || !trimStartRange || !trimEndRange) return;
  const max = getTrimRangeMax() || 1;
  const start = Number(trimStartRange.value) / max;
  const end = Number(trimEndRange.value) / max;
  const left = Math.max(0, Math.min(1, start));
  const right = Math.max(0, Math.min(1, end));
  trimRangeFill.style.clipPath = `inset(0 ${(1 - right) * 100}% 0 ${left * 100}%)`;
}

function updateTrimLabels() {
  if (!trimStartLabel || !trimEndLabel) return;
  const start = rangeToTime(trimStartRange?.value ?? 0);
  const end = rangeToTime(trimEndRange?.value ?? getTrimRangeMax());
  trimStartLabel.textContent = formatTrimTime(start);
  trimEndLabel.textContent = formatTrimTime(end);
}

function formatTrimTime(seconds) {
  if (!Number.isFinite(seconds)) return '00:00.0';
  const total = Math.max(0, seconds);
  const mins = Math.floor(total / 60);
  const secs = total - mins * 60;
  return `${String(mins).padStart(2, '0')}:${secs.toFixed(1).padStart(4, '0')}`;
}

function applyTrimUIFromInputs() {
  const start = parseFloat(startTimeInput.value);
  const end = parseFloat(endTimeInput.value);
  if (Number.isFinite(start) && trimStartRange) {
    trimStartRange.value = String(timeToRange(start));
  }
  if (Number.isFinite(end) && trimEndRange) {
    trimEndRange.value = String(timeToRange(end));
  }
  updateTrimRangeFill();
  updateTrimLabels();
}

function syncTrimFromInputs() {
  if (trimSyncing) return;
  trimSyncing = true;
  try {
    applyTrimUIFromInputs();
  } finally {
    trimSyncing = false;
  }
}

function syncTrimFromRange(source) {
  if (trimSyncing) return;
  trimSyncing = true;
  try {
    const max = getTrimRangeMax();
    let startVal = Number(trimStartRange?.value || 0);
    let endVal = Number(trimEndRange?.value || max);
    if (source === 'start' && startVal > endVal) {
      endVal = Math.min(max, startVal);
      if (trimEndRange) trimEndRange.value = String(endVal);
    } else if (source === 'end' && endVal < startVal) {
      startVal = Math.max(0, endVal);
      if (trimStartRange) trimStartRange.value = String(startVal);
    }
    const startSec = rangeToTime(startVal);
    const endSec = rangeToTime(endVal);
    if (startTimeInput) startTimeInput.value = startSec.toFixed(1);
    if (endTimeInput) endTimeInput.value = endSec.toFixed(1);
    sanitizeTimes();
    applyTrimUIFromInputs();
    // プレビュー追従: 操作中のハンドル時刻にseek
    if (state.mediaType === MEDIA_VIDEO || state.mediaType === MEDIA_AUDIO) {
      const targetTime = source === 'end' ? endSec : startSec;
      if (Number.isFinite(targetTime) && Math.abs(video.currentTime - targetTime) > 0.01) {
        try {
          // duration ピッタリへの seek は ended 状態を誘発するので余裕を取る
          const safeTarget = Math.max(0, Math.min(state.duration - 0.05, targetTime));
          video.currentTime = safeTarget;
        } catch (error) { /* seek失敗は無視 */ }
      }
    }
  } finally {
    trimSyncing = false;
  }
}

// 専用オフスクリーン video からサムネを焼く（再生位置を壊さない）
async function generateTrimThumbnails() {
  if (!trimThumbsCanvas) return;
  if (state.mediaType !== MEDIA_VIDEO) {
    const ctx = trimThumbsCanvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, trimThumbsCanvas.width, trimThumbsCanvas.height);
    state.thumbnails.generated = false;
    return;
  }
  if (!state.objectUrl || !state.duration) return;
  // 再生成判定（同条件なら現在のcanvas描画をそのまま使う）
  const cached = state.thumbnails;
  if (cached.generated && cached.duration === state.duration && cached.rotation === state.transform.rotation) {
    return;
  }
  const generation = ++state.thumbnails.generation;
  const offscreen = document.createElement('video');
  offscreen.muted = true;
  offscreen.preload = 'auto';
  offscreen.crossOrigin = 'anonymous';
  try {
    offscreen.src = state.objectUrl;
    await new Promise((resolve, reject) => {
      offscreen.addEventListener('loadedmetadata', resolve, { once: true });
      offscreen.addEventListener('error', reject, { once: true });
    }).catch(() => {});
    if (generation !== state.thumbnails.generation) return;
    const srcW = offscreen.videoWidth, srcH = offscreen.videoHeight;
    if (!srcW || !srcH) return;
    const stripRect = trimThumbsCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    trimThumbsCanvas.width = Math.max(1, Math.round(stripRect.width * dpr));
    trimThumbsCanvas.height = Math.max(1, Math.round(stripRect.height * dpr));
    const ctx = trimThumbsCanvas.getContext('2d');
    ctx.clearRect(0, 0, trimThumbsCanvas.width, trimThumbsCanvas.height);
    const cellW = trimThumbsCanvas.width / TRIM_THUMB_COUNT;
    const cellH = trimThumbsCanvas.height;
    for (let i = 0; i < TRIM_THUMB_COUNT; i++) {
      if (generation !== state.thumbnails.generation) return;
      const t = (i + 0.5) * (state.duration / TRIM_THUMB_COUNT);
      try {
        offscreen.currentTime = Math.min(state.duration - 0.05, Math.max(0, t));
        await new Promise((resolve) => {
          const onSeeked = () => { offscreen.removeEventListener('seeked', onSeeked); resolve(); };
          offscreen.addEventListener('seeked', onSeeked);
          setTimeout(() => { offscreen.removeEventListener('seeked', onSeeked); resolve(); }, 1500);
        });
      } catch (error) {
        continue;
      }
      if (generation !== state.thumbnails.generation) return;
      // rotation考慮: getDisplaySize の比率で fit
      const display = state.transform.rotation % 180 === 0
        ? { w: srcW, h: srcH } : { w: srcH, h: srcW };
      const scale = Math.max(cellW / display.w, cellH / display.h);
      const drawW = display.w * scale;
      const drawH = display.h * scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(i * cellW, 0, cellW, cellH);
      ctx.clip();
      ctx.translate(i * cellW + cellW / 2, cellH / 2);
      ctx.rotate((state.transform.rotation * Math.PI) / 180);
      if (state.transform.flipH) ctx.scale(-1, 1);
      if (state.transform.flipV) ctx.scale(1, -1);
      if (state.transform.rotation % 180 === 0) {
        ctx.drawImage(offscreen, -drawW / 2, -drawH / 2, drawW, drawH);
      } else {
        ctx.drawImage(offscreen, -drawH / 2, -drawW / 2, drawH, drawW);
      }
      ctx.restore();
    }
    state.thumbnails.generated = true;
    state.thumbnails.duration = state.duration;
    state.thumbnails.rotation = state.transform.rotation;
  } finally {
    offscreen.removeAttribute('src');
    offscreen.load();
  }
}

function clearTrimThumbnails() {
  if (!trimThumbsCanvas) return;
  const ctx = trimThumbsCanvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, trimThumbsCanvas.width, trimThumbsCanvas.height);
  state.thumbnails.generated = false;
  state.thumbnails.duration = 0;
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

const ASPECT_RATIOS = {
  free: null,
  '1:1': 1,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
};

// 各ハンドルが「どの辺をどう動かすか」と「アンカー（固定する点）」
// edges係数: dx/dyを掛けて「左/右/上/下辺の移動量」に
// anchorX/Y: 固定したい横/縦の基準位置（'min'|'max'|'mid'）
const HANDLE_SPEC = {
  tl: { edges: { left: 1, right: 0, top: 1, bottom: 0 }, anchorX: 'max', anchorY: 'max' },
  tr: { edges: { left: 0, right: 1, top: 1, bottom: 0 }, anchorX: 'min', anchorY: 'max' },
  br: { edges: { left: 0, right: 1, top: 0, bottom: 1 }, anchorX: 'min', anchorY: 'min' },
  bl: { edges: { left: 1, right: 0, top: 0, bottom: 1 }, anchorX: 'max', anchorY: 'min' },
  t:  { edges: { left: 0, right: 0, top: 1, bottom: 0 }, anchorX: 'mid', anchorY: 'max' },
  b:  { edges: { left: 0, right: 0, top: 0, bottom: 1 }, anchorX: 'mid', anchorY: 'min' },
  l:  { edges: { left: 1, right: 0, top: 0, bottom: 0 }, anchorX: 'max', anchorY: 'mid' },
  r:  { edges: { left: 0, right: 1, top: 0, bottom: 0 }, anchorX: 'min', anchorY: 'mid' },
};

function syncAspectButtons() {
  aspectButtons.forEach((b) => {
    const isActive = b.dataset.aspect === state.aspect;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function getActiveAspectRatio() {
  if (state.shiftHeld && state.aspect === 'free') {
    if (state.crop.width && state.crop.height) {
      return state.crop.width / state.crop.height;
    }
  }
  return ASPECT_RATIOS[state.aspect];
}

// 8点リサイズ：handleに応じてedgesを動かす。anchorに対する自由度の制約を保つ。
function applyHandleDelta(start, handle, dx, dy) {
  if (handle === 'move') {
    return { x: start.x + dx, y: start.y + dy, width: start.width, height: start.height };
  }
  const spec = HANDLE_SPEC[handle];
  if (!spec) return { ...start };
  let left = start.x + spec.edges.left * dx;
  let right = start.x + start.width + spec.edges.right * dx;
  let top = start.y + spec.edges.top * dy;
  let bottom = start.y + start.height + spec.edges.bottom * dy;
  if (right < left + MIN_CROP_SIZE) {
    if (spec.edges.left)  left = right - MIN_CROP_SIZE;
    if (spec.edges.right) right = left + MIN_CROP_SIZE;
  }
  if (bottom < top + MIN_CROP_SIZE) {
    if (spec.edges.top)    top = bottom - MIN_CROP_SIZE;
    if (spec.edges.bottom) bottom = top + MIN_CROP_SIZE;
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

// アスペクト固定: 指定アンカーを保ったまま、片方のサイズに合わせてもう片方を再計算
function fitAspectFromAnchor(rect, handle, ratio, bounds) {
  if (!ratio) return rect;
  const spec = HANDLE_SPEC[handle];
  if (!spec) return rect;
  let { x, y, width, height } = rect;
  // 横辺ハンドル(t/b)では heightドリブン → width決定
  // 縦辺ハンドル(l/r)では widthドリブン → height決定
  // 角ハンドルでは大きい方ドリブン → 比率に詰める（widthドリブンで統一）
  let driveByWidth;
  if (handle === 't' || handle === 'b') driveByWidth = false;
  else if (handle === 'l' || handle === 'r') driveByWidth = true;
  else driveByWidth = (width / height) > ratio;
  if (driveByWidth) {
    height = width / ratio;
  } else {
    width = height * ratio;
  }
  // アンカーに従って x/y を再配置
  const anchorXPos = spec.anchorX === 'max' ? rect.x + rect.width
    : spec.anchorX === 'mid' ? rect.x + rect.width / 2 : rect.x;
  const anchorYPos = spec.anchorY === 'max' ? rect.y + rect.height
    : spec.anchorY === 'mid' ? rect.y + rect.height / 2 : rect.y;
  x = spec.anchorX === 'max' ? anchorXPos - width
    : spec.anchorX === 'mid' ? anchorXPos - width / 2 : anchorXPos;
  y = spec.anchorY === 'max' ? anchorYPos - height
    : spec.anchorY === 'mid' ? anchorYPos - height / 2 : anchorYPos;
  return { x, y, width, height };
}

// 比率を保ったまま境界内に収める。境界に当たったら同方向に縮める。
function clampPreservingAspect(rect, handle, ratio, bounds) {
  if (!ratio) return clampCropRect(rect);
  const spec = HANDLE_SPEC[handle];
  if (!spec) return clampCropRect(rect);
  let { x, y, width, height } = rect;
  const minW = Math.min(MIN_CROP_SIZE, bounds.width);
  const minH = Math.min(MIN_CROP_SIZE, bounds.height);
  width = Math.max(width, minW);
  height = Math.max(height, minH);
  // 境界外にはみ出しているなら、アンカー固定で縮める
  let maxWidth = bounds.width;
  let maxHeight = bounds.height;
  if (spec.anchorX === 'max') maxWidth = Math.min(maxWidth, x + width);
  else if (spec.anchorX === 'min') maxWidth = Math.min(maxWidth, bounds.width - x);
  else maxWidth = Math.min(maxWidth, 2 * Math.min(x + width / 2, bounds.width - (x + width / 2)));
  if (spec.anchorY === 'max') maxHeight = Math.min(maxHeight, y + height);
  else if (spec.anchorY === 'min') maxHeight = Math.min(maxHeight, bounds.height - y);
  else maxHeight = Math.min(maxHeight, 2 * Math.min(y + height / 2, bounds.height - (y + height / 2)));
  // 比率を保ちながら縮める
  if (width > maxWidth) {
    width = Math.max(maxWidth, minW);
    height = width / ratio;
  }
  if (height > maxHeight) {
    height = Math.max(maxHeight, minH);
    width = height * ratio;
  }
  // アンカー基準で再配置
  const anchorXPos = spec.anchorX === 'max' ? x + rect.width
    : spec.anchorX === 'mid' ? x + rect.width / 2 : x;
  const anchorYPos = spec.anchorY === 'max' ? y + rect.height
    : spec.anchorY === 'mid' ? y + rect.height / 2 : y;
  x = spec.anchorX === 'max' ? anchorXPos - width
    : spec.anchorX === 'mid' ? anchorXPos - width / 2 : anchorXPos;
  y = spec.anchorY === 'max' ? anchorYPos - height
    : spec.anchorY === 'mid' ? anchorYPos - height / 2 : anchorYPos;
  // 最終的な境界 clamp（アンカー方向には動かさない）
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + width > bounds.width) x = bounds.width - width;
  if (y + height > bounds.height) y = bounds.height - height;
  return { x, y, width, height };
}

// プリセット切替時用：中心固定で短辺合わせ
function fitAspectCentered(rect, ratio, bounds) {
  if (!ratio) return rect;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  let width = rect.width;
  let height = rect.height;
  if (width / height > ratio) {
    width = height * ratio;
  } else {
    height = width / ratio;
  }
  // 境界に収める（中心軸を維持しつつ縮小）
  const maxW = Math.min(bounds.width, 2 * Math.min(cx, bounds.width - cx));
  const maxH = Math.min(bounds.height, 2 * Math.min(cy, bounds.height - cy));
  if (width > maxW) {
    width = maxW;
    height = width / ratio;
  }
  if (height > maxH) {
    height = maxH;
    width = height * ratio;
  }
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

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
  // canvasがmax-height制約で中央寄せされるケースに対応：
  // cropBoxの親（canvas-stage）基準で配置するため、canvasのオフセットを加算
  const parent = cropBox.offsetParent || cropBox.parentElement;
  const parentRect = parent ? parent.getBoundingClientRect() : rect;
  const offsetX = rect.left - parentRect.left;
  const offsetY = rect.top - parentRect.top;
  const scaleX = rect.width / videoW;
  const scaleY = rect.height / videoH;
  cropBox.style.left = `${offsetX + state.crop.x * scaleX}px`;
  cropBox.style.top = `${offsetY + state.crop.y * scaleY}px`;
  cropBox.style.width = `${state.crop.width * scaleX}px`;
  cropBox.style.height = `${state.crop.height * scaleY}px`;
}

function setCropRect(rect) {
  state.crop = clampCropRect(rect);
  updateCropInputs();
  updateCropSizeLabel();
  updateCropBox();
}

// 既に正規化済み（比率固定+境界収束済み）の矩形を直接適用する。
function setCropRectRaw(rect) {
  state.crop = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
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
  if (state.mediaType === MEDIA_VIDEO) {
    state.thumbnails.generated = false;
    generateTrimThumbnails();
  }
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
  if (state.mediaType === MEDIA_VIDEO) {
    state.thumbnails.generated = false;
    generateTrimThumbnails();
  }
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
  if (state.uiMode === UI_MODE_BATCH) {
    const frameCount = state.batchFrameFiles.length;
    const audioCount = state.batchAudioFiles.length;
    const total = [...state.batchFrameFiles, ...state.batchAudioFiles]
      .reduce((sum, file) => sum + file.size, 0);
    fileNameEl.textContent = `一括処理 ${frameCount + audioCount} 件`;
    durationEl.textContent = formatBytes(total);
    sourceSizeEl.textContent = frameCount && audioCount
      ? '画像/両耳'
      : frameCount
        ? 'まとめ画像'
        : audioCount
          ? '両耳化'
          : '--';
    return;
  }
  fileNameEl.textContent = state.fileName || '未選択';
  durationEl.textContent = state.duration ? formatTime(state.duration) : '--';
  if (video.videoWidth && video.videoHeight) {
    sourceSizeEl.textContent = `${video.videoWidth} x ${video.videoHeight}`;
  } else {
    sourceSizeEl.textContent = '--';
  }
}

function summarizeFiles(files) {
  if (!files.length) {
    return '未選択';
  }
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const firstNames = files.slice(0, 3).map((file) => file.name).join(' / ');
  const rest = files.length > 3 ? ` ほか ${files.length - 3} 件` : '';
  return `${files.length} 件・${formatBytes(totalBytes)}｜${firstNames}${rest}`;
}

function validateBatchSelection(files, { maxFiles, maxFileBytes = 0, allowedMediaTypes }) {
  const picked = Array.from(files || []);
  const accepted = [];
  const skipped = [];
  for (const file of picked) {
    const mediaType = detectMediaType(file);
    if (allowedMediaTypes.includes(mediaType)) {
      accepted.push(file);
    } else {
      skipped.push(file.name);
    }
  }
  if (accepted.length > maxFiles) {
    throw new Error(`一度に処理できるのは ${maxFiles} 件までです。`);
  }
  if (maxFileBytes > 0) {
    const oversized = accepted.find((file) => file.size > maxFileBytes);
    if (oversized) {
      throw new Error(`${oversized.name} が ${formatBytes(maxFileBytes)} を超えています。`);
    }
  }
  const totalBytes = accepted.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > BATCH_MAX_TOTAL_BYTES) {
    throw new Error(`合計容量は ${formatBytes(BATCH_MAX_TOTAL_BYTES)} までにしてください。`);
  }
  return { accepted, skipped };
}

function setBatchFrameFiles(files) {
  try {
    const { accepted, skipped } = validateBatchSelection(files, {
      maxFiles: BATCH_FRAME_MAX_FILES,
      allowedMediaTypes: [MEDIA_VIDEO],
    });
    state.batchFrameFiles = accepted;
    if (skipped.length) {
      setStatus(`${skipped.length} 件は動画ではないため除外しました。`);
    } else if (accepted.length) {
      setStatus(`${accepted.length} 件の動画を選択しました。`);
    }
  } catch (error) {
    state.batchFrameFiles = [];
    setStatus(error.message || 'ファイルを選択できませんでした。');
  }
  updateBatchSummaries();
}

function setBatchAudioFiles(files) {
  try {
    const { accepted, skipped } = validateBatchSelection(files, {
      maxFiles: BATCH_AUDIO_MAX_FILES,
      maxFileBytes: BATCH_AUDIO_MAX_FILE_BYTES,
      allowedMediaTypes: [MEDIA_VIDEO, MEDIA_AUDIO],
    });
    state.batchAudioFiles = accepted;
    if (skipped.length) {
      setStatus(`${skipped.length} 件は動画/音声ではないため除外しました。`);
    } else if (accepted.length) {
      setStatus(`${accepted.length} 件の動画/音声を選択しました。`);
    }
  } catch (error) {
    state.batchAudioFiles = [];
    setStatus(error.message || 'ファイルを選択できませんでした。');
  }
  updateBatchSummaries();
}

function updateBatchSummaries() {
  if (batchFrameCount) {
    batchFrameCount.textContent = `${state.batchFrameFiles.length} 件`;
  }
  if (batchFrameSummary) {
    batchFrameSummary.textContent = summarizeFiles(state.batchFrameFiles);
  }
  if (batchAudioCount) {
    batchAudioCount.textContent = `${state.batchAudioFiles.length} 件`;
  }
  if (batchAudioSummary) {
    batchAudioSummary.textContent = summarizeFiles(state.batchAudioFiles);
  }
  setBatchButtonsEnabled();
  updateInfo();
}

function revokeObjectUrl() {
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }
}

// File lifecycle
function loadFile(file) {
  if (isProcessing()) {
    setStatus('処理中はファイルを変更できません。');
    return;
  }
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
  state.splitMarkers = [];
  state.aspect = 'free';
  state.thumbnails.generated = false;
  state.thumbnails.duration = 0;
  state.thumbnails.rotation = 0;
  state.thumbnails.generation++;
  syncAspectButtons();
  updateInfo();
  updateCropInputs();
  updateCropSizeLabel();
  updateCropBox();
  setMediaMode(mediaType);
  if (mediaType === MEDIA_AUDIO) {
    setEditMode(UI_MODE_NORMAL);
  }
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
  if (isProcessing()) {
    setStatus('処理中はクリアできません。');
    return;
  }
  const clearedLabel = getMediaLabel();
  stopRenderLoop();
  revokeObjectUrl();
  state.file = null;
  state.fileName = null;
  state.duration = 0;
  state.crop = { x: 0, y: 0, width: 0, height: 0 };
  state.splitMarkers = [];
  state.aspect = 'free';
  syncAspectButtons();
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  fileInput.value = '';
  startTimeInput.value = '';
  endTimeInput.value = '';
  clearTrimThumbnails();
  applyTrimRangeMax();
  if (trimStartRange) trimStartRange.value = '0';
  if (trimEndRange) trimEndRange.value = String(getTrimRangeMax());
  updateTrimRangeFill();
  updateTrimLabels();
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
    if (!Number.isFinite(progress)) return;
    const normalized = clampProgressValue(progress);
    const bucket = Math.floor(normalized * 100);
    if (bucket === ffmpegState.lastProgressBucket) return;
    ffmpegState.lastProgressBucket = bucket;
    const percent = Math.round(normalized * 100);
    if (ffmpegState.progressHandler) {
      ffmpegState.progressHandler(normalized, percent);
      return;
    }
    setStatus(`FFmpeg 処理中 ${percent}%`);
  });
  const coreURL = chrome.runtime.getURL('vendor/ffmpeg/ffmpeg-core.js');
  const wasmURL = chrome.runtime.getURL('vendor/ffmpeg/ffmpeg-core.wasm');
  setStatus('FFmpeg を読み込み中...');
  if (processingOverlay && !processingOverlay.hidden) {
    if (processingLabel) processingLabel.textContent = 'FFmpeg を読み込み中...';
    if (processingCount) processingCount.textContent = '初回のみ少し時間がかかります';
  }
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

async function execFfmpegWithProgress(ffmpeg, args, onProgress) {
  setActiveFfmpegProgressHandler(onProgress);
  try {
    await ffmpeg.exec(args);
  } finally {
    setActiveFfmpegProgressHandler(null);
  }
}

// FFmpeg exec を直列化する mutex。UI disabled とは別レイヤーで FS 整合性を保護。
const ffmpegQueue = {
  tail: Promise.resolve(),
  run(task) {
    const next = this.tail.then(() => task());
    this.tail = next.catch(() => {});
    return next;
  },
};

// items: [{ variants: [{args}, ...], outputName, outputType }]
// onItemDone(item, blob, index): 各item完了直後に呼ぶ。Blobをbatch配列に貯めずメモリピークを抑える。
async function runFfmpegBatch(items, { onItemStart, onItemProgress, onItemDone } = {}) {
  if (!state.file) {
    throw new Error('先にファイルを読み込んでください。');
  }
  return ffmpegQueue.run(async () => {
    const ffmpeg = await ensureFfmpeg();
    const inputName = getInputName();
    await safeDelete(ffmpeg, inputName);
    const buffer = await state.file.arrayBuffer();
    await ffmpeg.writeFile(inputName, new Uint8Array(buffer));
    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (onItemStart) onItemStart(item, i);
        let blob = null;
        let lastError = null;
        for (let variantIndex = 0; variantIndex < item.variants.length; variantIndex++) {
          const variant = item.variants[variantIndex];
          await safeDelete(ffmpeg, item.outputName);
          try {
            if (onItemProgress) onItemProgress(item, 0, i, variantIndex);
            await execFfmpegWithProgress(ffmpeg, variant.args, (progress, percent) => {
              if (onItemProgress) onItemProgress(item, progress, i, variantIndex, percent);
            });
            const data = await ffmpeg.readFile(item.outputName);
            blob = toBlob(data, item.outputType);
            break;
          } catch (error) {
            lastError = error;
          }
        }
        await safeDelete(ffmpeg, item.outputName);
        if (!blob) {
          throw lastError || new Error(`書き出しに失敗しました: ${item.outputName}`);
        }
        if (onItemDone) {
          await onItemDone(item, blob, i);
        }
      }
    } finally {
      await safeDelete(ffmpeg, inputName);
    }
  });
}

// 既存呼び出し点向けの薄いラッパ。primary/fallback を variants に詰める。
async function runFfmpegCommand({ args, outputName, outputType, fallbackArgs, onProgress }) {
  const variants = [{ args }];
  if (fallbackArgs) {
    variants.push({ args: fallbackArgs });
  }
  let resultBlob = null;
  await runFfmpegBatch(
    [{ variants, outputName, outputType }],
    {
      onItemProgress: (_item, progress) => {
        if (onProgress) onProgress(progress);
      },
      onItemDone: (_item, blob) => { resultBlob = blob; },
    }
  );
  return resultBlob;
}


// Export actions
async function exportVideoWithFfmpeg({ onProgress } = {}) {
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
  const audioFilters = buildAudioFilters({ speed });
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
  const blob = await runFfmpegCommand({
    args: primaryArgs,
    fallbackArgs,
    outputName,
    outputType: 'video/mp4',
    onProgress,
  });
  const clip = formatClipLabel(start, end);
  downloadBlob(blob, `${baseName()}-${clip}.mp4`);
}

async function exportAudioWithFfmpeg({ onProgress } = {}) {
  const { start, end } = sanitizeTimes();
  const duration = Math.max(0.1, end - start);
  const speed = getPlaybackRate();
  const audioFilters = buildAudioFilters({ speed });
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
  const blob = await runFfmpegCommand({
    args: primaryArgs,
    fallbackArgs,
    outputName,
    outputType: 'audio/mpeg',
    onProgress,
  });
  const clip = formatClipLabel(start, end);
  downloadBlob(blob, `${baseName()}-audio-${clip}.mp3`);
}

async function exportFrameFullWithFfmpeg({ onProgress } = {}) {
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
    onProgress,
  });
  downloadBlob(blob, `${baseName()}-frame-${formatStamp(time)}.png`);
}

async function exportFrameCroppedWithFfmpeg({ onProgress } = {}) {
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
    onProgress,
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

// Bulk split mode
function setEditMode(mode) {
  let target = mode === UI_MODE_BULK ? UI_MODE_BULK : UI_MODE_NORMAL;
  if (mode === UI_MODE_BATCH) {
    target = UI_MODE_BATCH;
  }
  if (target === UI_MODE_BULK && state.mediaType !== MEDIA_VIDEO) {
    target = UI_MODE_NORMAL;
  }
  state.uiMode = target;
  document.body.classList.toggle('mode-bulk', target === UI_MODE_BULK);
  document.body.classList.toggle('mode-batch', target === UI_MODE_BATCH);
  editModeButtons.forEach((b) => {
    const isActive = b.dataset.editMode === target;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  if (target === UI_MODE_BULK) {
    renderClipList();
    drawBulkTimeline();
  }
  updateInfo();
  setBatchButtonsEnabled();
}

function sortAndDedupeMarkers(markers, duration) {
  const valid = markers
    .filter((m) => Number.isFinite(m) && m >= MIN_GAP && m <= duration - MIN_GAP)
    .sort((a, b) => a - b);
  const out = [];
  for (const m of valid) {
    if (!out.length || m - out[out.length - 1] >= MIN_GAP) out.push(m);
  }
  return out;
}

function markersToClips() {
  if (!state.duration) return [];
  const points = [0, ...state.splitMarkers, state.duration];
  const clips = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    clips.push({
      index: i,
      start,
      end,
      duration: end - start,
      label: `clip_${String(i + 1).padStart(2, '0')}`,
    });
  }
  return clips;
}

function setSplitMarkers(next) {
  state.splitMarkers = sortAndDedupeMarkers(next, state.duration);
  renderClipList();
  drawBulkTimeline();
}

function bulkAddMarkerAt(time) {
  if (!state.duration) return false;
  const t = Math.min(Math.max(time, MIN_GAP), state.duration - MIN_GAP);
  const next = [...state.splitMarkers, t];
  const sorted = sortAndDedupeMarkers(next, state.duration);
  if (sorted.length === state.splitMarkers.length) {
    setStatus('近すぎる位置のため追加できませんでした。');
    return false;
  }
  state.splitMarkers = sorted;
  renderClipList();
  drawBulkTimeline();
  return true;
}

function bulkRemoveLastMarker() {
  if (!state.splitMarkers.length) return;
  state.splitMarkers = state.splitMarkers.slice(0, -1);
  renderClipList();
  drawBulkTimeline();
}

function bulkClearAllMarkers() {
  if (!state.splitMarkers.length) return;
  state.splitMarkers = [];
  renderClipList();
  drawBulkTimeline();
}

function bulkAutoSplitEvery(seconds) {
  if (!state.duration) return;
  const step = Number(seconds);
  if (!Number.isFinite(step) || step < 1) {
    setStatus('1秒以上の値を指定してください。');
    return;
  }
  const next = [];
  for (let t = step; t < state.duration - MIN_GAP; t += step) {
    next.push(t);
  }
  setSplitMarkers(next);
  setStatus(`${state.splitMarkers.length} 個のマーカーを追加しました。`);
}

function commitClipBoundary(rowIndex, edge, rawValue) {
  const markerIndex = edge === 'start' ? rowIndex - 1 : rowIndex;
  if (markerIndex < 0 || markerIndex >= state.splitMarkers.length) return false;
  const prev = state.splitMarkers[markerIndex - 1] ?? 0;
  const next = state.splitMarkers[markerIndex + 1] ?? state.duration;
  const lo = prev + MIN_GAP;
  const hi = next - MIN_GAP;
  if (lo >= hi) return false;
  if (!Number.isFinite(rawValue)) return false;
  const value = Math.min(Math.max(rawValue, lo), hi);
  const trial = [...state.splitMarkers];
  trial[markerIndex] = value;
  const sorted = sortAndDedupeMarkers(trial, state.duration);
  if (sorted.length !== state.splitMarkers.length) return false;
  if (Math.abs(sorted[markerIndex] - value) > 0.01) return false;
  state.splitMarkers = sorted;
  if (Math.abs(value - rawValue) > 0.01) {
    setStatus(`値を ${value.toFixed(1)}秒 に調整しました。`);
  }
  return true;
}

function drawBulkTimeline() {
  if (!bulkTimeline) return;
  const rect = bulkTimeline.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = window.devicePixelRatio || 1;
  bulkTimeline.width = Math.max(1, Math.round(rect.width * dpr));
  bulkTimeline.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = bulkTimeline.getContext('2d');
  ctx.clearRect(0, 0, bulkTimeline.width, bulkTimeline.height);
  if (!state.duration) return;
  const styles = getComputedStyle(document.body);
  const accent = styles.getPropertyValue('--accent').trim() || '#d35f42';
  const muted = styles.getPropertyValue('--muted').trim() || '#888';
  const bg = styles.getPropertyValue('--surface').trim() || '#fff';
  const clips = markersToClips();
  const w = bulkTimeline.width;
  const h = bulkTimeline.height;
  const palette = ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.16)'];
  for (const clip of clips) {
    const x0 = (clip.start / state.duration) * w;
    const x1 = (clip.end / state.duration) * w;
    ctx.fillStyle = palette[clip.index % 2];
    ctx.fillRect(x0, 0, Math.max(1, x1 - x0), h);
    // ラベル
    ctx.fillStyle = bg;
    ctx.font = `${12 * dpr}px sans-serif`;
    ctx.textBaseline = 'middle';
    if (x1 - x0 > 36 * dpr) {
      ctx.fillText(clip.label, x0 + 6 * dpr, h / 2);
    }
  }
  // マーカー線
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2 * dpr;
  for (const m of state.splitMarkers) {
    const x = (m / state.duration) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  // 現在再生位置
  if (state.mediaType === MEDIA_VIDEO && Number.isFinite(video.currentTime)) {
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1 * dpr;
    const x = (video.currentTime / state.duration) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  if (bulkClipCount) {
    bulkClipCount.textContent = `${clips.length} 件`;
  }
}

function renderClipList() {
  if (!bulkClipList) return;
  const clips = markersToClips();
  // 行DOMの再利用（フォーカス保持）
  const existing = Array.from(bulkClipList.children);
  while (existing.length > clips.length) {
    bulkClipList.removeChild(existing.pop());
  }
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    let row = existing[i];
    if (!row) {
      row = document.createElement('li');
      row.className = 'clip-row';
      row.innerHTML = `
        <span class="clip-label"></span>
        <input class="clip-start" type="number" step="0.1" min="0" />
        <input class="clip-end" type="number" step="0.1" min="0" />
        <button class="clip-export-mp4 ghost small" type="button">MP4</button>
        <button class="clip-export-mp3 ghost small" type="button">MP3</button>
      `;
      bulkClipList.appendChild(row);
      const startInput = row.querySelector('.clip-start');
      const endInput = row.querySelector('.clip-end');
      startInput.addEventListener('change', () => {
        const idx = Number(row.dataset.clipIndex);
        const ok = commitClipBoundary(idx, 'start', parseFloat(startInput.value));
        renderClipList();
        drawBulkTimeline();
        if (!ok) startInput.value = (markersToClips()[idx]?.start ?? 0).toFixed(1);
      });
      endInput.addEventListener('change', () => {
        const idx = Number(row.dataset.clipIndex);
        const ok = commitClipBoundary(idx, 'end', parseFloat(endInput.value));
        renderClipList();
        drawBulkTimeline();
        if (!ok) endInput.value = (markersToClips()[idx]?.end ?? state.duration).toFixed(1);
      });
      row.querySelector('.clip-export-mp4').addEventListener('click', () => {
        const idx = Number(row.dataset.clipIndex);
        runSingleClipExport(markersToClips()[idx], 'mp4');
      });
      row.querySelector('.clip-export-mp3').addEventListener('click', () => {
        const idx = Number(row.dataset.clipIndex);
        runSingleClipExport(markersToClips()[idx], 'mp3');
      });
    }
    row.dataset.clipIndex = String(i);
    row.querySelector('.clip-label').textContent = clip.label;
    const startInput = row.querySelector('.clip-start');
    const endInput = row.querySelector('.clip-end');
    if (document.activeElement !== startInput) startInput.value = clip.start.toFixed(1);
    if (document.activeElement !== endInput) endInput.value = clip.end.toFixed(1);
    startInput.disabled = i === 0;
    endInput.disabled = i === clips.length - 1;
  }
}

// Bulk timeline interactions
const timelineDrag = {
  active: false,
  markerIndex: -1,
  startX: 0,
  startMarker: 0,
};

function timelineHitTest(clientX) {
  if (!bulkTimeline || !state.duration || !state.splitMarkers.length) return -1;
  const rect = bulkTimeline.getBoundingClientRect();
  const x = clientX - rect.left;
  const tol = 8;
  let best = -1, bestDist = Infinity;
  for (let i = 0; i < state.splitMarkers.length; i++) {
    const mx = (state.splitMarkers[i] / state.duration) * rect.width;
    const dist = Math.abs(mx - x);
    if (dist < tol && dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  }
  return best;
}

function timelineClientToTime(clientX) {
  const rect = bulkTimeline.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return ratio * state.duration;
}

if (bulkTimeline) {
  bulkTimeline.addEventListener('pointerdown', (event) => {
    if (!state.duration) return;
    const idx = timelineHitTest(event.clientX);
    if (idx >= 0) {
      timelineDrag.active = true;
      timelineDrag.markerIndex = idx;
      timelineDrag.startX = event.clientX;
      timelineDrag.startMarker = state.splitMarkers[idx];
      bulkTimeline.setPointerCapture(event.pointerId);
    } else {
      // クリックで分割追加
      const t = timelineClientToTime(event.clientX);
      bulkAddMarkerAt(t);
    }
  });
  bulkTimeline.addEventListener('pointermove', (event) => {
    if (!timelineDrag.active) return;
    const t = timelineClientToTime(event.clientX);
    const prev = state.splitMarkers[timelineDrag.markerIndex - 1] ?? 0;
    const next = state.splitMarkers[timelineDrag.markerIndex + 1] ?? state.duration;
    const clamped = Math.min(Math.max(t, prev + MIN_GAP), next - MIN_GAP);
    state.splitMarkers[timelineDrag.markerIndex] = clamped;
    renderClipList();
    drawBulkTimeline();
  });
  const endTimelineDrag = (event) => {
    if (!timelineDrag.active) return;
    timelineDrag.active = false;
    timelineDrag.markerIndex = -1;
    if (bulkTimeline.hasPointerCapture(event.pointerId)) {
      bulkTimeline.releasePointerCapture(event.pointerId);
    }
    state.splitMarkers = sortAndDedupeMarkers(state.splitMarkers, state.duration);
    renderClipList();
    drawBulkTimeline();
  };
  bulkTimeline.addEventListener('pointerup', endTimelineDrag);
  bulkTimeline.addEventListener('pointercancel', endTimelineDrag);
}

if (editModeButtons.length) {
  editModeButtons.forEach((b) => {
    b.addEventListener('click', () => setEditMode(b.dataset.editMode));
  });
}

if (bulkAddHere) {
  bulkAddHere.addEventListener('click', () => {
    if (!state.duration) return;
    bulkAddMarkerAt(video.currentTime);
  });
}
if (bulkRemoveLast) {
  bulkRemoveLast.addEventListener('click', bulkRemoveLastMarker);
}
if (bulkClearMarkers) {
  bulkClearMarkers.addEventListener('click', bulkClearAllMarkers);
}
if (bulkAutoApply) {
  bulkAutoApply.addEventListener('click', () => {
    bulkAutoSplitEvery(parseFloat(bulkAutoSeconds?.value || '10'));
  });
}
if (bulkExportAllMp4) {
  bulkExportAllMp4.addEventListener('click', () => handleBulkExportClick('mp4'));
}
if (bulkExportAllMp3) {
  bulkExportAllMp3.addEventListener('click', () => handleBulkExportClick('mp3'));
}
if (bulkExportFrames) {
  bulkExportFrames.addEventListener('click', () => handleBulkExportClick('frame'));
}

// 個別clip書き出し（Phase 3 / Phase 4 共用）
async function buildClipVideoVariants(clip) {
  const cropFilter = getCropFilter();
  const speed = getPlaybackRate();
  const videoFilters = getTransformFilters();
  if (cropFilter) videoFilters.push(cropFilter);
  if (Math.abs(speed - 1) >= 0.001) {
    videoFilters.push(`setpts=PTS/${Number(speed.toFixed(3))}`);
  }
  const audioFilters = buildAudioFilters({ speed });
  const inputName = getInputName();
  const outputName = `clip-${clip.index}.mp4`;
  const baseArgs = [
    '-i', inputName,
    '-ss', `${clip.start}`,
    '-t', `${clip.duration}`,
    '-map', '0:v:0',
    '-map', '0:a:0?',
  ];
  if (videoFilters.length) baseArgs.push('-vf', videoFilters.join(','));
  if (audioFilters.length) baseArgs.push('-af', audioFilters.join(','));
  const primaryArgs = baseArgs.concat([
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outputName,
  ]);
  const fallbackArgs = baseArgs.concat([
    '-c:v', 'mpeg4', '-q:v', '4', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outputName,
  ]);
  return {
    variants: [{ args: primaryArgs }, { args: fallbackArgs }],
    outputName,
    outputType: 'video/mp4',
  };
}

async function buildClipAudioVariants(clip) {
  const speed = getPlaybackRate();
  const audioFilters = buildAudioFilters({ speed });
  const bitrate = getAudioBitrate();
  const inputName = getInputName();
  const outputName = `clip-${clip.index}.mp3`;
  const baseArgs = [
    '-i', inputName,
    '-ss', `${clip.start}`,
    '-t', `${clip.duration}`,
    '-vn', '-ar', '44100', '-ac', '2',
  ];
  if (audioFilters.length) baseArgs.push('-af', audioFilters.join(','));
  const primaryArgs = baseArgs.concat(['-c:a', 'libmp3lame', '-b:a', bitrate, outputName]);
  const fallbackArgs = baseArgs.concat(['-c:a', 'mp3', '-b:a', bitrate, outputName]);
  return {
    variants: [{ args: primaryArgs }, { args: fallbackArgs }],
    outputName,
    outputType: 'audio/mpeg',
  };
}

function setProgress({ done = 0, total = 0, label, itemProgress = null, detail }) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeDone = Math.min(safeTotal, Math.max(0, Number(done) || 0));
  const hasItemProgress = itemProgress !== null && itemProgress !== undefined && safeDone < safeTotal;
  const currentProgress = hasItemProgress ? clampProgressValue(itemProgress) : 0;
  const progressUnits = hasItemProgress ? safeDone + currentProgress : safeDone;
  const percent = safeTotal > 0 ? Math.min(100, (progressUnits / safeTotal) * 100) : 0;
  state.bulkProgress = {
    done: safeDone,
    total: safeTotal,
    label: label || '',
    itemProgress: hasItemProgress ? currentProgress : null,
  };
  if (safeTotal > 0) {
    if (processingLabel) processingLabel.textContent = label || '処理中';
    setProcessingBarPercent(percent);
    if (processingCount) {
      if (detail) {
        processingCount.textContent = detail;
      } else if (hasItemProgress) {
        processingCount.textContent = `${Math.min(safeDone + 1, safeTotal)} / ${safeTotal} ・ ${Math.round(currentProgress * 100)}%`;
      } else {
        processingCount.textContent = `${safeDone} / ${safeTotal}`;
      }
    }
    const statusSuffix = hasItemProgress ? `${Math.round(percent)}%` : `${safeDone} / ${safeTotal}`;
    setStatus(`${label || '処理中'} ${statusSuffix}`);
  } else {
    if (processingLabel) processingLabel.textContent = '処理中...';
    setProcessingBarPercent(0);
    if (processingCount) processingCount.textContent = '';
  }
}

// File System Access API の writable は MV3 サイドパネルで Chrome クラッシュを誘発するため無効化。
// 一括書き出しはブラウザの通常ダウンロードで対応（Chromeのダウンロード設定で保存先を指定可）。
async function writeBlobToDirOrDownload(_dirHandle, filename, blob) {
  downloadBlob(blob, filename);
}

// frame draw 可能状態を待つ（loadedmetadata 後でも readyState 不足時がある）
function waitVideoReady(videoEl) {
  if (videoEl.readyState >= 2) return Promise.resolve();
  return new Promise((resolve) => {
    const cleanup = () => {
      videoEl.removeEventListener('loadeddata', onReady);
      videoEl.removeEventListener('canplay', onReady);
    };
    const onReady = () => { cleanup(); resolve(); };
    videoEl.addEventListener('loadeddata', onReady, { once: true });
    videoEl.addEventListener('canplay', onReady, { once: true });
    setTimeout(() => { cleanup(); resolve(); }, 3000);
  });
}

async function seekVideoTo(videoEl, target) {
  // 既に近い位置にいればフレーム準備状態だけ待つ
  if (Math.abs(videoEl.currentTime - target) < 0.001) {
    await waitVideoReady(videoEl);
    return;
  }
  await new Promise((resolve) => {
    const onDone = () => {
      videoEl.removeEventListener('seeked', onDone);
      videoEl.removeEventListener('loadeddata', onDone);
      resolve();
    };
    videoEl.addEventListener('seeked', onDone, { once: true });
    videoEl.addEventListener('loadeddata', onDone, { once: true });
    try { videoEl.currentTime = target; }
    catch (error) { videoEl.removeEventListener('seeked', onDone); resolve(); }
    setTimeout(onDone, 3000);
  });
}

// 一括フレーム抽出: FFmpeg WASM だと clip 数だけフル decode が走り Chrome がクラッシュしやすい。
// canvas+オフスクリーン video の seek 経路に切り替えて軽量化（サムネ生成と同じ仕組み）。
async function exportClipFramesViaCanvas(clips, dirHandle, onProgress) {
  const offscreen = document.createElement('video');
  offscreen.muted = true;
  offscreen.preload = 'auto';
  offscreen.crossOrigin = 'anonymous';
  try {
    offscreen.src = state.objectUrl;
    await new Promise((resolve, reject) => {
      offscreen.addEventListener('loadedmetadata', resolve, { once: true });
      offscreen.addEventListener('error', reject, { once: true });
      setTimeout(() => reject(new Error('動画メタデータの読み込みに失敗しました。')), 5000);
    });
    await waitVideoReady(offscreen);
    const srcW = offscreen.videoWidth;
    const srcH = offscreen.videoHeight;
    if (!srcW || !srcH) throw new Error('動画の解像度を取得できませんでした。');
    const display = state.transform.rotation % 180 === 0
      ? { width: srcW, height: srcH }
      : { width: srcH, height: srcW };
    const crop = clampCropRect(state.crop);
    const useCrop = crop.width > 0 && crop.height > 0
      && !(crop.x === 0 && crop.y === 0 && crop.width === display.width && crop.height === display.height);
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = display.width;
    frameCanvas.height = display.height;
    const frameCtx = frameCanvas.getContext('2d');
    const outCanvas = document.createElement('canvas');
    const outCtx = outCanvas.getContext('2d');
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const target = Math.min(state.duration - 0.05, Math.max(0, clip.start));
      await seekVideoTo(offscreen, target);
      // transform 適用してフルフレームへ
      frameCtx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
      drawTransformedSource(frameCtx, offscreen, srcW, srcH, frameCanvas.width, frameCanvas.height);
      // crop 適用
      if (useCrop) {
        outCanvas.width = Math.max(1, Math.round(crop.width));
        outCanvas.height = Math.max(1, Math.round(crop.height));
        outCtx.drawImage(frameCanvas, crop.x, crop.y, crop.width, crop.height,
          0, 0, outCanvas.width, outCanvas.height);
      } else {
        outCanvas.width = frameCanvas.width;
        outCanvas.height = frameCanvas.height;
        outCtx.drawImage(frameCanvas, 0, 0);
      }
      const blob = await new Promise((resolve) => outCanvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error(`${clip.label} のPNG化に失敗しました。`);
      const filename = `${baseName()}-${clip.label}-firstframe.png`;
      await writeBlobToDirOrDownload(dirHandle, filename, blob);
      onProgress(i + 1);
      await new Promise((r) => setTimeout(r, 30));
    }
  } finally {
    offscreen.removeAttribute('src');
    offscreen.load();
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function captureFrameFromFile(file, seconds) {
  const objectUrl = URL.createObjectURL(file);
  const offscreen = document.createElement('video');
  const canvas = document.createElement('canvas');
  try {
    offscreen.muted = true;
    offscreen.preload = 'auto';
    offscreen.src = objectUrl;
    await new Promise((resolve, reject) => {
      offscreen.addEventListener('loadedmetadata', resolve, { once: true });
      offscreen.addEventListener('error', reject, { once: true });
      setTimeout(() => reject(new Error('動画メタデータの読み込みに失敗しました。')), 8000);
    });
    await waitVideoReady(offscreen);
    const width = offscreen.videoWidth;
    const height = offscreen.videoHeight;
    if (!width || !height) {
      throw new Error('動画の解像度を取得できませんでした。');
    }
    if (width * height > BATCH_FRAME_MAX_PIXELS) {
      throw new Error(`解像度が大きすぎます（上限 ${BATCH_FRAME_MAX_PIXELS.toLocaleString()} px）。`);
    }
    const duration = Number.isFinite(offscreen.duration) ? offscreen.duration : 0;
    const safeDurationEnd = Math.max(0, duration - 0.05);
    const target = Math.min(Math.max(0, seconds), safeDurationEnd);
    await seekVideoTo(offscreen, target);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      throw new Error('PNG化に失敗しました。');
    }
    return { blob, actualTime: target };
  } finally {
    offscreen.removeAttribute('src');
    offscreen.load();
    URL.revokeObjectURL(objectUrl);
    canvas.width = 0;
    canvas.height = 0;
  }
}

async function runBatchFrameExport() {
  const files = state.batchFrameFiles;
  if (!files.length) {
    setStatus('先に動画を選択してください。');
    return;
  }
  const seconds = parseFloat(batchFrameSecond?.value || '0');
  if (!Number.isFinite(seconds) || seconds < 0) {
    setStatus('秒位置は0以上で指定してください。');
    return;
  }
  setProcessing(true);
  const failures = [];
  let success = 0;
  try {
    setProgress({ done: 0, total: files.length, label: 'まとめて画像保存中' });
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const { blob, actualTime } = await captureFrameFromFile(file, seconds);
        const filename = `${baseNameFromFile(file.name)}-frame-${formatStamp(actualTime)}.png`;
        downloadBlob(blob, filename);
        success++;
      } catch (error) {
        failures.push(`${file.name}: ${error.message || '失敗'}`);
      }
      setProgress({ done: i + 1, total: files.length, label: 'まとめて画像保存中' });
      await delay(60);
    }
    const failed = failures.length;
    if (failed) {
      setStatus(`${success} 枚を書き出し、${failed} 件失敗しました。${failures[0]}`);
    } else {
      setStatus(`${success} 枚の画像を保存しました。`);
    }
  } finally {
    setProgress({ done: 0, total: 0 });
    setProcessing(false);
  }
}

function buildBatchAudioRepairItem(file, inputName, index, channelMode) {
  const mediaType = detectMediaType(file);
  const channelFilter = getAudioChannelFilter(channelMode);
  if (!channelFilter) {
    throw new Error('元にする音を選択してください。');
  }
  if (mediaType === MEDIA_VIDEO) {
    const outputName = `batch-audio-${index}.mp4`;
    const baseArgs = [
      '-i', inputName,
      '-map', '0:v:0?',
      '-map', '0:a:0',
      '-af', channelFilter,
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
    ];
    const copyArgs = baseArgs.concat(['-c:v', 'copy', outputName]);
    const h264Args = [
      '-i', inputName,
      '-map', '0:v:0?',
      '-map', '0:a:0',
      '-af', channelFilter,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputName,
    ];
    const mpeg4Args = [
      '-i', inputName,
      '-map', '0:v:0?',
      '-map', '0:a:0',
      '-af', channelFilter,
      '-c:v', 'mpeg4',
      '-q:v', '4',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputName,
    ];
    return {
      variants: [{ args: copyArgs }, { args: h264Args }, { args: mpeg4Args }],
      outputName,
      outputType: 'video/mp4',
      downloadName: `${baseNameFromFile(file.name)}-stereo.mp4`,
    };
  }
  const bitrate = getAudioBitrate();
  const outputName = `batch-audio-${index}.mp3`;
  const baseArgs = [
    '-i', inputName,
    '-vn',
    '-af', channelFilter,
    '-ar', '44100',
    '-ac', '2',
  ];
  const primaryArgs = baseArgs.concat(['-c:a', 'libmp3lame', '-b:a', bitrate, outputName]);
  const fallbackArgs = baseArgs.concat(['-c:a', 'mp3', '-b:a', bitrate, outputName]);
  return {
    variants: [{ args: primaryArgs }, { args: fallbackArgs }],
    outputName,
    outputType: 'audio/mpeg',
    downloadName: `${baseNameFromFile(file.name)}-stereo.mp3`,
  };
}

async function runFfmpegFileBatch(files, {
  buildItem,
  onItemStart,
  onItemProgress,
  onItemDone,
  onItemFailed,
}) {
  return ffmpegQueue.run(async () => {
    const ffmpeg = await ensureFfmpeg();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = getFileExtension(file.name) || 'dat';
      const inputName = `batch-input-${i}.${ext}`;
      let item = null;
      try {
        item = buildItem(file, inputName, i);
        if (onItemStart) onItemStart(file, item, i);
        await safeDelete(ffmpeg, inputName);
        await safeDelete(ffmpeg, item.outputName);
        const buffer = await file.arrayBuffer();
        await ffmpeg.writeFile(inputName, new Uint8Array(buffer));
        let blob = null;
        let lastError = null;
        for (let variantIndex = 0; variantIndex < item.variants.length; variantIndex++) {
          const variant = item.variants[variantIndex];
          await safeDelete(ffmpeg, item.outputName);
          try {
            if (onItemProgress) onItemProgress(file, item, 0, i, variantIndex);
            await execFfmpegWithProgress(ffmpeg, variant.args, (progress, percent) => {
              if (onItemProgress) onItemProgress(file, item, progress, i, variantIndex, percent);
            });
            const data = await ffmpeg.readFile(item.outputName);
            blob = toBlob(data, item.outputType);
            break;
          } catch (error) {
            lastError = error;
          }
        }
        if (!blob) {
          throw lastError || new Error('書き出しに失敗しました。');
        }
        if (onItemDone) {
          await onItemDone(item, blob, i);
        }
      } catch (error) {
        if (onItemFailed) {
          await onItemFailed(file, error, i);
        }
      } finally {
        await safeDelete(ffmpeg, inputName);
        if (item) {
          await safeDelete(ffmpeg, item.outputName);
        }
      }
    }
  });
}

async function runBatchAudioRepairExport() {
  const files = state.batchAudioFiles;
  if (!files.length) {
    setStatus('先に動画/音声を選択してください。');
    return;
  }
  const channelMode = sanitizeAudioChannelMode(batchAudioChannelSelect?.value);
  if (channelMode === CHANNEL_MODE_NONE) {
    setStatus('元にする音を選択してください。');
    return;
  }
  setProcessing(true);
  const failures = [];
  let success = 0;
  try {
    setProgress({ done: 0, total: files.length, label: '音を両耳にしています' });
    await runFfmpegFileBatch(files, {
      buildItem: (file, inputName, index) => buildBatchAudioRepairItem(
        file,
        inputName,
        index,
        channelMode
      ),
      onItemDone: async (item, blob, i) => {
        downloadBlob(blob, item.downloadName);
        success++;
        setProgress({ done: i + 1, total: files.length, label: '音を両耳にしています' });
        await delay(60);
      },
      onItemStart: (_file, _item, i) => {
        setProgress({ done: i, total: files.length, label: '音を両耳にしています', itemProgress: 0 });
      },
      onItemProgress: (_file, _item, progress, i) => {
        setProgress({ done: i, total: files.length, label: '音を両耳にしています', itemProgress: progress });
      },
      onItemFailed: async (file, error, i) => {
        failures.push(`${file.name}: ${error.message || '失敗'}`);
        setProgress({ done: i + 1, total: files.length, label: '音を両耳にしています' });
        await delay(60);
      },
    });
    const failed = failures.length;
    if (failed) {
      setStatus(`${success} 件を書き出し、${failed} 件失敗しました。${failures[0]}`);
    } else {
      setStatus(`${success} 件の音を両耳で聞けるようにしました。`);
    }
  } finally {
    setProgress({ done: 0, total: 0 });
    setProcessing(false);
  }
}

async function runBulkExport(kind, dirHandle) {
  if (state.mediaType !== MEDIA_VIDEO && kind !== 'mp3') {
    setStatus('動画ファイルのみ対応です。');
    return;
  }
  const clips = markersToClips();
  if (!clips.length) {
    setStatus('クリップがありません。');
    return;
  }
  setProcessing(true);
  try {
    setProgress({ done: 0, total: clips.length, label: '一括書き出し中' });
    if (kind === 'frame') {
      // canvas経路（軽量、Chromeクラッシュ回避）
      await exportClipFramesViaCanvas(clips, dirHandle, (done) => {
        setProgress({ done, total: clips.length, label: '一括書き出し中' });
      });
      setStatus(`${clips.length} 枚のフレームを書き出しました。`);
      return;
    }
    const items = [];
    for (const c of clips) {
      if (kind === 'mp3') items.push(await buildClipAudioVariants(c));
      else items.push(await buildClipVideoVariants(c));
    }
    const ext = kind === 'mp3' ? 'mp3' : 'mp4';
    await runFfmpegBatch(items, {
      onItemStart: (_item, i) => {
        setProgress({ done: i, total: clips.length, label: '一括書き出し中', itemProgress: 0 });
      },
      onItemProgress: (_item, progress, i) => {
        setProgress({ done: i, total: clips.length, label: '一括書き出し中', itemProgress: progress });
      },
      onItemDone: async (_item, blob, i) => {
        const clip = clips[i];
        const filename = `${baseName()}-${clip.label}.${ext}`;
        await writeBlobToDirOrDownload(dirHandle, filename, blob);
        setProgress({ done: i + 1, total: clips.length, label: '一括書き出し中' });
      },
    });
    setStatus(`${clips.length} 個のファイルを書き出しました。`);
  } catch (error) {
    setStatus(error.message || '一括書き出しに失敗しました。');
  } finally {
    setProgress({ done: 0, total: 0 });
    setProcessing(false);
  }
}

async function handleBulkExportClick(kind) {
  if (!state.duration) {
    setStatus('先に動画ファイルを読み込んでください。');
    return;
  }
  await runBulkExport(kind, null);
}

async function runSingleClipExport(clip, kind) {
  if (!clip) return;
  if (state.mediaType !== MEDIA_VIDEO && kind !== 'mp3') {
    setStatus('動画ファイルのみ対応です。');
    return;
  }
  setProcessing(true);
  try {
    const progressLabel = `${clip.label} を ${kind.toUpperCase()} で書き出し中`;
    setProgress({ done: 0, total: 1, label: progressLabel, itemProgress: 0 });
    const item = kind === 'mp3'
      ? await buildClipAudioVariants(clip)
      : await buildClipVideoVariants(clip);
    let resultBlob = null;
    await runFfmpegBatch([item], {
      onItemProgress: (_item, progress) => {
        setProgress({ done: 0, total: 1, label: progressLabel, itemProgress: progress });
      },
      onItemDone: (_i, b) => { resultBlob = b; },
    });
    setProgress({ done: 1, total: 1, label: progressLabel });
    const ext = kind === 'mp3' ? 'mp3' : 'mp4';
    downloadBlob(resultBlob, `${baseName()}-${clip.label}.${ext}`);
    setStatus(`${clip.label} の書き出しが完了しました。`);
  } catch (error) {
    setStatus(error.message || '書き出しに失敗しました。');
  } finally {
    setProcessing(false);
  }
}

// Crop interactions
const cropDrag = {
  active: false,
  handle: null,
  startX: 0,
  startY: 0,
  startRect: null,
  scaleX: 1,
  scaleY: 1,
};

function startCropDrag(event, handle) {
  if (!state.duration) {
    return;
  }
  event.preventDefault();
  const rect = preview.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }
  cropDrag.active = true;
  cropDrag.handle = handle;
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
  let next = applyHandleDelta(cropDrag.startRect, cropDrag.handle, dx, dy);
  const ratio = getActiveAspectRatio();
  if (ratio && cropDrag.handle !== 'move') {
    const bounds = getDisplaySize();
    next = fitAspectFromAnchor(next, cropDrag.handle, ratio, bounds);
    next = clampPreservingAspect(next, cropDrag.handle, ratio, bounds);
    setCropRectRaw(next);
  } else {
    setCropRect(next);
  }
}

function endCropDrag(event) {
  if (!cropDrag.active) {
    return;
  }
  cropDrag.active = false;
  cropDrag.handle = null;
  cropDrag.startRect = null;
  if (cropBox && cropBox.hasPointerCapture(event.pointerId)) {
    cropBox.releasePointerCapture(event.pointerId);
  }
}

// Event wiring
if (cropBox) {
  cropBox.addEventListener('pointerdown', (event) => {
    const handle = event.target?.dataset?.handle;
    if (handle && HANDLE_SPEC[handle]) {
      event.stopPropagation();
      startCropDrag(event, handle);
    } else {
      startCropDrag(event, 'move');
    }
  });
  cropBox.addEventListener('pointermove', updateCropDrag);
  cropBox.addEventListener('pointerup', endCropDrag);
  cropBox.addEventListener('pointercancel', endCropDrag);
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Shift') state.shiftHeld = true;
});
window.addEventListener('keyup', (event) => {
  if (event.key === 'Shift') state.shiftHeld = false;
});
window.addEventListener('blur', () => { state.shiftHeld = false; });

if (aspectButtons.length) {
  aspectButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const aspect = button.dataset.aspect;
      if (!aspect || !(aspect in ASPECT_RATIOS)) return;
      state.aspect = aspect;
      syncAspectButtons();
      const ratio = ASPECT_RATIOS[aspect];
      if (ratio && state.duration && state.crop.width && state.crop.height) {
        const bounds = getDisplaySize();
        const fitted = fitAspectCentered(state.crop, ratio, bounds);
        setCropRectRaw(fitted);
        drawFrame();
      }
    });
  });
}

if (clearVideo) {
  clearVideo.addEventListener('click', clearVideoState);
}

if (batchFrameChoose && batchFrameInput) {
  batchFrameChoose.addEventListener('click', () => {
    if (batchFrameChoose.dataset.dropHandled === 'true') return;
    batchFrameInput.value = '';
    batchFrameInput.click();
  });
  batchFrameInput.addEventListener('change', (event) => {
    setBatchFrameFiles(event.target.files);
  });
}

if (batchAudioChoose && batchAudioInput) {
  batchAudioChoose.addEventListener('click', () => {
    if (batchAudioChoose.dataset.dropHandled === 'true') return;
    batchAudioInput.value = '';
    batchAudioInput.click();
  });
  batchAudioInput.addEventListener('change', (event) => {
    setBatchAudioFiles(event.target.files);
  });
}

if (batchFrameExport) {
  batchFrameExport.addEventListener('click', runBatchFrameExport);
}

if (batchAudioExport) {
  batchAudioExport.addEventListener('click', runBatchAudioRepairExport);
}

document.querySelectorAll('[data-batch-drop]').forEach((target) => {
  const kind = target.dataset.batchDrop;
  const applyFiles = (files) => {
    if (kind === 'frame') {
      setBatchFrameFiles(files);
    } else if (kind === 'audio') {
      setBatchAudioFiles(files);
    }
  };
  target.addEventListener('dragover', (event) => {
    if (isProcessing()) return;
    event.preventDefault();
    target.classList.add('drag-active');
  });
  target.addEventListener('dragleave', (event) => {
    if (!target.contains(event.relatedTarget)) {
      target.classList.remove('drag-active');
    }
  });
  target.addEventListener('drop', (event) => {
    event.preventDefault();
    target.classList.remove('drag-active');
    if (isProcessing()) {
      setStatus('処理中はファイルを変更できません。');
      return;
    }
    const files = event.dataTransfer?.files;
    if (files && files.length) {
      target.dataset.dropHandled = 'true';
      applyFiles(files);
      setTimeout(() => {
        delete target.dataset.dropHandled;
      }, 250);
    }
  });
});

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
  if (state.uiMode === UI_MODE_BULK) drawBulkTimeline();
});

video.addEventListener('loadedmetadata', () => {
  state.duration = video.duration;
  startTimeInput.value = '0.0';
  endTimeInput.value = state.duration.toFixed(1);
  updateInfo();
  applyTrimRangeMax();
  syncTrimFromInputs();
  if (state.mediaType === MEDIA_VIDEO) {
    setCropFull();
    drawFrame();
    updatePreviewLayout();
    primeFirstFrame();
    applyPlaybackRate(state.playbackRate);
    applyVolume(state.volume * 100);
    applyVideoTransform();
    generateTrimThumbnails();
  } else {
    clearPreviewCanvas();
    updatePreviewLayout();
    applyPlaybackRate(state.playbackRate);
    state.volume = DEFAULT_VOLUME;
    applyVolume(DEFAULT_VOLUME * 100);
    video.style.transform = 'none';
    clearTrimThumbnails();
  }
  setButtonsEnabled(true);
  updateTransformUI();
  if (state.uiMode === UI_MODE_BULK) {
    renderClipList();
    drawBulkTimeline();
  }
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
  if (state.uiMode === UI_MODE_BULK) drawBulkTimeline();
});

setStartBtn.addEventListener('click', () => {
  startTimeInput.value = video.currentTime.toFixed(1);
  sanitizeTimes();
  syncTrimFromInputs();
});

setEndBtn.addEventListener('click', () => {
  endTimeInput.value = video.currentTime.toFixed(1);
  sanitizeTimes();
  syncTrimFromInputs();
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
    syncTrimFromInputs();
  });
});

if (trimStartRange) {
  trimStartRange.addEventListener('input', () => syncTrimFromRange('start'));
  trimStartRange.addEventListener('pointerdown', () => {
    trimStartRange.classList.remove('is-front');
    if (trimEndRange) trimEndRange.classList.remove('is-front');
    if (video && !video.paused) video.pause();
  });
}
if (trimEndRange) {
  trimEndRange.addEventListener('input', () => syncTrimFromRange('end'));
  trimEndRange.addEventListener('pointerdown', () => {
    if (trimStartRange) trimStartRange.classList.remove('is-front');
    trimEndRange.classList.add('is-front');
    if (video && !video.paused) video.pause();
  });
}

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

if (audioChannelSelect) {
  audioChannelSelect.addEventListener('change', () => {
    setAudioChannelMode(audioChannelSelect.value);
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
    const progressLabel = 'MP4を書き出し中';
    setProgress({ done: 0, total: 1, label: progressLabel, itemProgress: 0 });
    await exportVideoWithFfmpeg({
      onProgress: (progress) => {
        setProgress({ done: 0, total: 1, label: progressLabel, itemProgress: progress });
      },
    });
    setProgress({ done: 1, total: 1, label: progressLabel });
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
    const progressLabel = statusPrefix;
    setProgress({ done: 0, total: 1, label: progressLabel, itemProgress: 0 });
    if (mode === 'crop') {
      await exportFrameCroppedWithFfmpeg({
        onProgress: (progress) => {
          setProgress({ done: 0, total: 1, label: progressLabel, itemProgress: progress });
        },
      });
    } else {
      await exportFrameFullWithFfmpeg({
        onProgress: (progress) => {
          setProgress({ done: 0, total: 1, label: progressLabel, itemProgress: progress });
        },
      });
    }
    setProgress({ done: 1, total: 1, label: progressLabel });
    setStatus('フレームを保存しました。');
  } catch (error) {
    try {
      setStatus('FFmpegに失敗しました。キャンバスで保存します...');
      setProgress({ done: 0, total: 1, label: 'キャンバスで保存中', itemProgress: 0.5 });
      if (mode === 'crop') {
        await exportFrameCroppedFromCanvas();
      } else {
        await exportFrameFullFromCanvas();
      }
      setProgress({ done: 1, total: 1, label: 'キャンバスで保存中' });
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
    const progressLabel = 'MP3を書き出し中';
    setProgress({ done: 0, total: 1, label: progressLabel, itemProgress: 0 });
    await exportAudioWithFfmpeg({
      onProgress: (progress) => {
        setProgress({ done: 0, total: 1, label: progressLabel, itemProgress: progress });
      },
    });
    setProgress({ done: 1, total: 1, label: progressLabel });
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
applyTrimRangeMax();
updateTrimRangeFill();
updateTrimLabels();
if (clearVideo) {
  clearVideo.disabled = true;
}
setMediaMode(null);
applyPlaybackRate(DEFAULT_PLAYBACK_RATE);
applyVolume(DEFAULT_VOLUME * 100);
setAudioChannelMode(CHANNEL_MODE_NONE);
applyVideoTransform();
updateTransformUI();
updateBatchSummaries();
setUIMode(loadUIMode());
setEditMode(UI_MODE_NORMAL);
setStatus('動画/音声をドロップして開始してください。');
