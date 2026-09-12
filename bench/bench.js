/* bench/bench.js
 * 拡張の外で WebCodecs 経路と ffmpeg 経路を公平比較するベンチページ用。
 * 拡張と同じ ../webcodecs-export.js と ../vendor/ 配下だけを読む（コピー禁止）。
 * ffmpeg 側は panel.js の exportVideoWithFfmpeg と同じ引数
 * （libx264 -preset veryfast -crf 23、MT なら -threads 2）で実行する。
 */
(function () {
  'use strict';

  var fileInput = document.getElementById('file');
  var startInput = document.getElementById('start');
  var endInput = document.getElementById('end');
  var speedInput = document.getElementById('speed');
  var rotationInput = document.getElementById('rotation');
  var flipHInput = document.getElementById('flipH');
  var flipVInput = document.getElementById('flipV');
  var cropXInput = document.getElementById('cropX');
  var cropYInput = document.getElementById('cropY');
  var cropWInput = document.getElementById('cropW');
  var cropHInput = document.getElementById('cropH');
  var resultsBody = document.querySelector('#results tbody');
  var logEl = document.getElementById('log');
  var fileUrlInput = document.getElementById('fileUrl');
  var loadedNameEl = document.getElementById('loadedName');
  // URL から読み込んだ File（ファイル選択ダイアログを使えない自動操作用）。
  var loadedFile = null;

  function log(message) {
    var line = String(message);
    logEl.textContent += line + '\n';
  }

  function readParams() {
    var file = (fileInput.files && fileInput.files[0]) || loadedFile;
    if (!file) throw new Error('ファイルを選択してください。');
    var start = Math.max(0, Number(startInput.value) || 0);
    var end = Number(endInput.value);
    if (!Number.isFinite(end) || end <= start) throw new Error('終了秒が不正です。');
    var speed = Math.min(4, Math.max(0.25, Number(speedInput.value) || 1));
    var crop = null;
    var cx = Number(cropXInput.value);
    var cy = Number(cropYInput.value);
    var cw = Number(cropWInput.value);
    var ch = Number(cropHInput.value);
    if (Number.isFinite(cx) && Number.isFinite(cy) && cw > 0 && ch > 0) {
      crop = { x: cx, y: cy, width: cw, height: ch };
    }
    return {
      file: file,
      start: start,
      end: end,
      speed: speed,
      rotation: Number(rotationInput.value) || 0,
      flipH: Boolean(flipHInput.checked),
      flipV: Boolean(flipVInput.checked),
      crop: crop,
    };
  }

  // panel.js の getTransformFilters / getCropFilter / setpts / 偶数化と同等。
  function buildVideoFilters(params) {
    var filters = [];
    if (params.rotation === 90) filters.push('transpose=1');
    else if (params.rotation === 180) filters.push('transpose=1', 'transpose=1');
    else if (params.rotation === 270) filters.push('transpose=2');
    if (params.flipH) filters.push('hflip');
    if (params.flipV) filters.push('vflip');
    if (params.crop) {
      filters.push(
        'crop=' + Math.round(params.crop.width) + ':' + Math.round(params.crop.height) +
        ':' + Math.round(params.crop.x) + ':' + Math.round(params.crop.y)
      );
    }
    if (Math.abs(params.speed - 1) >= 0.001) {
      filters.push('setpts=PTS/' + Number(params.speed.toFixed(3)));
    }
    filters.push('scale=ceil(iw/2)*2:ceil(ih/2)*2');
    return filters;
  }

  // panel.js の buildAtempoFilters と同等（速度のみ。音量・チャンネルは無し）。
  function buildAtempoFilters(rate) {
    var filters = [];
    var remaining = rate;
    if (!Number.isFinite(remaining) || remaining <= 0 || Math.abs(remaining - 1) < 0.001) {
      return filters;
    }
    while (remaining < 0.5) {
      filters.push('atempo=0.5');
      remaining /= 0.5;
    }
    while (remaining > 2) {
      filters.push('atempo=2.0');
      remaining /= 2.0;
    }
    var finalRate = Number(remaining.toFixed(3));
    if (Math.abs(finalRate - 1) >= 0.001) filters.push('atempo=' + finalRate);
    return filters;
  }

  var ffmpegInstance = null;
  var ffmpegCoreLabel = null;

  // core は worker 内で importScripts されるため相対 URL では解決できない。
  // panel.js の chrome.runtime.getURL と同じく絶対 URL にする。
  function abs(path) {
    return new URL(path, window.location.href).href;
  }

  async function ensureFfmpeg() {
    if (ffmpegInstance) return ffmpegInstance;
    var ffmpeg = new window.FFmpegWASM.FFmpeg();
    var configs = [];
    if (window.crossOriginIsolated) {
      configs.push({
        label: 'mt',
        coreURL: abs('../vendor/ffmpeg-mt/ffmpeg-core.js'),
        wasmURL: abs('../vendor/ffmpeg-mt/ffmpeg-core.wasm'),
        workerURL: abs('../vendor/ffmpeg-mt/ffmpeg-core.worker.js'),
      });
    }
    configs.push({
      label: 'st',
      coreURL: abs('../vendor/ffmpeg/ffmpeg-core.js'),
      wasmURL: abs('../vendor/ffmpeg/ffmpeg-core.wasm'),
    });
    var lastError = null;
    for (var i = 0; i < configs.length; i++) {
      try {
        var label = configs[i].label;
        await ffmpeg.load({
          coreURL: configs[i].coreURL,
          wasmURL: configs[i].wasmURL,
          workerURL: configs[i].workerURL,
        });
        ffmpegInstance = ffmpeg;
        ffmpegCoreLabel = label;
        log('ffmpeg core 読み込み: ' + label);
        return ffmpeg;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('FFmpeg の読み込みに失敗しました。');
  }

  async function writeInput(ffmpeg, file, name) {
    try { await ffmpeg.deleteFile(name); } catch (error) { /* 無視 */ }
    var buffer = await file.arrayBuffer();
    await ffmpeg.writeFile(name, new Uint8Array(buffer));
  }

  async function readOutput(ffmpeg, name, type) {
    var data = await ffmpeg.readFile(name);
    var buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    return new Blob([buffer], { type: type });
  }

  async function withThreads(args) {
    if (ffmpegCoreLabel !== 'mt' || args.indexOf('-threads') !== -1) return args;
    var limited = args.slice();
    // panel.js の MT_THREAD_COUNT と同じ 2。
    limited.splice(limited.length - 1, 0, '-threads', '2');
    return limited;
  }

  function probeResolution(blob) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(blob);
      var video = document.createElement('video');
      video.muted = true;
      video.preload = 'auto';
      var done = function (value) {
        URL.revokeObjectURL(url);
        resolve(value);
      };
      video.addEventListener('loadedmetadata', function () {
        done(video.videoWidth + 'x' + video.videoHeight);
      });
      video.addEventListener('error', function () {
        done('--');
      });
      setTimeout(function () { done('--'); }, 5000);
      video.src = url;
    });
  }

  function addResult(row) {
    var tr = document.createElement('tr');
    ['route', 'ms', 'bytes', 'resolution', 'encoder', 'log'].forEach(function (key) {
      var td = document.createElement('td');
      td.textContent = String(row[key]);
      tr.appendChild(td);
    });
    var td = document.createElement('td');
    var a = document.createElement('a');
    a.href = row.url;
    a.download = row.filename;
    a.textContent = '保存';
    td.appendChild(a);
    tr.appendChild(td);
    resultsBody.appendChild(tr);
  }

  // panel.js の exportVideoWithWebCodecs と同じ判定。速度 1（atempo 不要）なら
  // audio:'auto' で mediabunny 内に音声まで入れ、ffmpeg を一切使わない。
  // 速度≠1 なら従来どおり ffmpeg 音声 + mux。
  async function runWebCodecs() {
    var params = readParams();
    var api = window.SilvaWebCodecs;
    if (!api) throw new Error('SilvaWebCodecs が読み込まれていません。');
    var started = performance.now();
    log('[webcodecs] 開始: ' + params.file.name);
    var supported = await api.isSupported();
    log('[webcodecs] isSupported: ' + supported);
    if (!supported) throw new Error('WebCodecs 未対応の環境です。');
    var duration = Math.max(0.1, params.end - params.start);
    var useFfmpegAudio = buildAtempoFilters(params.speed).length > 0;

    var lastPct = -1;
    function videoProgress(p) {
      var pct = Math.floor(p * 10) * 10;
      if (pct !== lastPct) { lastPct = pct; log('[webcodecs] 映像 ' + pct + '%'); }
    }

    var videoResult;
    var audioBlob = null;
    var tAudio = 0;
    var tVideo = 0;
    var tMux = 0;
    var finalBlob;
    if (!useFfmpegAudio) {
      videoResult = await api.exportVideo({
        file: params.file,
        start: params.start,
        end: params.end,
        crop: params.crop,
        rotation: params.rotation,
        flipH: params.flipH,
        flipV: params.flipV,
        speed: params.speed,
        audio: 'auto',
        onProgress: videoProgress,
      });
      finalBlob = videoResult.blob;
      // exportVideo 内部の実測フェーズ時間（デコード+エンコード / 音声 / finalize）。
      tVideo = videoResult.phaseMs.video;
      tAudio = videoResult.phaseMs.audio;
      tMux = videoResult.phaseMs.finalize;
      log('[webcodecs] 映像: ' + videoResult.width + 'x' + videoResult.height +
        ' ' + videoResult.codec + '/' + videoResult.hardwareAcceleration +
        ' frames ' + videoResult.framesOut + '/' + videoResult.framesIn +
        ' dropped ' + videoResult.framesDropped + ' fps ' + videoResult.fps);
      log('[webcodecs] 内訳 映像(デコード+エンコード) ' + tVideo + 'ms / 音声 ' + tAudio +
        'ms / finalize ' + tMux + 'ms (audioMode ' + videoResult.audioMode + ')');
    } else {
      var needAudio = await api.hasAudio(params.file).catch(function () { return true; });
      log('[webcodecs] hasAudio: ' + needAudio);
      var tAudio0 = performance.now();
      if (needAudio) {
        var ffmpeg = await ensureFfmpeg();
        log('[webcodecs] ffmpeg 準備 ' + Math.round(performance.now() - tAudio0) + 'ms');
        tAudio0 = performance.now();
        await writeInput(ffmpeg, params.file, 'b-input');
        var audioArgs = [
          '-ss', String(params.start), '-t', String(duration), '-i', 'b-input',
          '-map', '0:a:0?', '-vn',
        ];
        var af = buildAtempoFilters(params.speed);
        if (af.length) audioArgs.push('-af', af.join(','));
        audioArgs.push('-c:a', 'aac', '-b:a', '128k', 'b-audio.m4a');
        await ffmpeg.exec(await withThreads(audioArgs));
        audioBlob = await readOutput(ffmpeg, 'b-audio.m4a', 'audio/mp4');
      }
      tAudio = Math.round(performance.now() - tAudio0);
      var tVideo0 = performance.now();
      videoResult = await api.exportVideo({
        file: params.file,
        start: params.start,
        end: params.end,
        crop: params.crop,
        rotation: params.rotation,
        flipH: params.flipH,
        flipV: params.flipV,
        speed: params.speed,
        onProgress: videoProgress,
      });
      tVideo = Math.round(performance.now() - tVideo0);
      var tMux0 = performance.now();
      log('[webcodecs] 映像: ' + videoResult.width + 'x' + videoResult.height +
        ' ' + videoResult.codec + '/' + videoResult.hardwareAcceleration +
        ' frames ' + videoResult.framesOut + '/' + videoResult.framesIn +
        ' dropped ' + videoResult.framesDropped + ' fps ' + videoResult.fps);

      finalBlob = videoResult.blob;
      if (audioBlob && audioBlob.size) {
        var ffmpeg2 = await ensureFfmpeg();
        try { await ffmpeg2.deleteFile('b-video.mp4'); } catch (error) { /* 無視 */ }
        try { await ffmpeg2.deleteFile('b-audio2.m4a'); } catch (error) { /* 無視 */ }
        await ffmpeg2.writeFile('b-video.mp4', new Uint8Array(await videoResult.blob.arrayBuffer()));
        await ffmpeg2.writeFile('b-audio2.m4a', new Uint8Array(await audioBlob.arrayBuffer()));
        await ffmpeg2.exec(await withThreads([
          '-i', 'b-video.mp4', '-i', 'b-audio2.m4a',
          '-map', '0:v:0', '-map', '1:a:0?', '-c', 'copy',
          '-movflags', '+faststart', 'b-muxed.mp4',
        ]));
        finalBlob = await readOutput(ffmpeg2, 'b-muxed.mp4', 'video/mp4');
      }
      tMux = Math.round(performance.now() - tMux0);
      log('[webcodecs] 内訳 音声 ' + tAudio + 'ms / 映像 ' + tVideo + 'ms / mux ' + tMux + 'ms' +
        ' (audioMode ' + videoResult.audioMode + ')');
    }
    var ms = Math.round(performance.now() - started);
    window.__lastWebCodecsBlob = finalBlob;
    var resolution = await probeResolution(finalBlob);
    addResult({
      route: 'WebCodecs',
      ms: ms,
      bytes: finalBlob.size,
      resolution: resolution,
      encoder: videoResult.codec + ' / ' + videoResult.hardwareAcceleration +
        ' / ' + Math.round(videoResult.bitrate / 1000) + 'kbps',
      log: '映像 ' + videoResult.framesOut + '/' + videoResult.framesIn +
        '・音声 ' + (videoResult.audioIncluded ? videoResult.audioMode : (audioBlob ? audioBlob.size + 'B' : 'なし')) +
        '・audioMode ' + videoResult.audioMode,
      url: URL.createObjectURL(finalBlob),
      filename: 'bench-webcodecs.mp4',
    });
    log('[webcodecs] 完了 ' + ms + 'ms ' + finalBlob.size + 'B ' + resolution);
  }

  async function runFfmpeg() {
    var params = readParams();
    var started = performance.now();
    log('[ffmpeg] 開始: ' + params.file.name);
    var ffmpeg = await ensureFfmpeg();
    await writeInput(ffmpeg, params.file, 'b-input');
    var duration = Math.max(0.1, params.end - params.start);
    var args = [
      '-ss', String(params.start), '-t', String(duration), '-i', 'b-input',
      '-map', '0:v:0', '-map', '0:a:0?',
      '-vf', buildVideoFilters(params).join(','),
    ];
    var af = buildAtempoFilters(params.speed);
    if (af.length) args.push('-af', af.join(','));
    args = args.concat([
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart', 'b-out.mp4',
    ]);
    await ffmpeg.exec(await withThreads(args));
    var blob = await readOutput(ffmpeg, 'b-out.mp4', 'video/mp4');
    var ms = Math.round(performance.now() - started);
    window.__lastFfmpegBlob = blob;
    var resolution = await probeResolution(blob);
    addResult({
      route: 'ffmpeg (' + ffmpegCoreLabel + ')',
      ms: ms,
      bytes: blob.size,
      resolution: resolution,
      encoder: 'libx264 veryfast crf23' + (ffmpegCoreLabel === 'mt' ? ' threads=2' : ''),
      log: '-vf ' + buildVideoFilters(params).join(','),
      url: URL.createObjectURL(blob),
      filename: 'bench-ffmpeg.mp4',
    });
    log('[ffmpeg] 完了 ' + ms + 'ms ' + blob.size + 'B ' + resolution);
  }

  document.getElementById('loadUrl').addEventListener('click', function () {
    var url = fileUrlInput.value.trim();
    if (!url) return;
    fetch(url).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.blob();
    }).then(function (blob) {
      var name = url.split('/').pop() || 'input.mp4';
      loadedFile = new File([blob], name, { type: blob.type || 'video/mp4' });
      loadedNameEl.textContent = name + ' (' + blob.size + 'B)';
      log('URL 読み込み: ' + name + ' ' + blob.size + 'B');
    }).catch(function (error) {
      log('URL 読み込み失敗: ' + (error && error.message || error));
    });
  });
  document.getElementById('runWebcodecs').addEventListener('click', function () {
    runWebCodecs().catch(function (error) {
      log('[webcodecs] 失敗: ' + (error && error.message || error));
    });
  });
  document.getElementById('runFfmpeg').addEventListener('click', function () {
    runFfmpeg().catch(function (error) {
      log('[ffmpeg] 失敗: ' + (error && error.message || error));
    });
  });
  log('準備完了。crossOriginIsolated=' + window.crossOriginIsolated);
})();
