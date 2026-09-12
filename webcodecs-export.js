/* webcodecs-export.js
 * WebCodecs（ハードウェアエンコード）による映像書き出しモジュール。
 * panel.js とは別ファイルのクラシックスクリプト。DOM には依存しない
 * （描画は OffscreenCanvas のみ）。window.SilvaWebCodecs として公開する。
 *
 * 変換の順序は panel.js のプレビュー描画と一致させる:
 *  - panel.js の drawTransformedSource と同じ変換（回転→反転）を Canvas に適用し、
 *    その後に crop 領域を切り出す（getCropFilter と同じ「回転・反転後の表示座標系」）。
 *  - ffmpeg 経路の -vf は transpose → hflip → vflip の後に crop、その後
 *    scale=ceil(iw/2)*2:ceil(ih/2)*2 が並ぶ。Canvas 経路では crop 後に
 *    偶数サイズへ描画することで同等の出力サイズにする。
 *  - 速度は setpts=PTS/speed と同じく 出力TS=(入力TS-start)/speed。
 *
 * 音声処理と最終 mux は `audio: 'auto'` のとき mediabunny の同じ Output で行う。
 * mediabunny は映像の demux→decode→Canvas変換→自前 VideoEncoder→mp4 mux に使う。
 * （第 1 ラウンドの Conversion 一本化は頭打ちのため第 2 ラウンドで置き換えた。
 * 映像フェーズが解像度に関係なく約 2 秒で頭打ちになることが実測で判明したため。）
 */
(function (root) {
  'use strict';

  var MIN_BITRATE = 1000000;
  var MAX_BITRATE = 20000000;
  var KEYFRAME_INTERVAL_SEC = 2;
  // speed>1 で出力 fps がこの値を超える場合のみ間引く。それ以外は全フレーム保持。
  var MAX_OUTPUT_FPS = 120;
  var DEFAULT_FPS_HINT = 30;

  function clamp01(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.min(1, Math.max(0, number));
  }

  function toEvenSize(value) {
    // ffmpeg の scale=ceil(iw/2)*2 と同じく偶数へ切り上げ（H.264 yuv420p の制約）。
    var size = Math.ceil(Number(value) / 2) * 2;
    if (!Number.isFinite(size)) return 2;
    return Math.max(2, size);
  }

  function normalizeRotation(degrees) {
    var normalized = Number(degrees) % 360;
    if (!Number.isFinite(normalized)) return 0;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  // panel.js の getDisplaySize に対応（回転が 90/270 なら幅・高さを交換）。
  function getDisplaySizeFor(sourceW, sourceH, rotation) {
    var width = Number(sourceW) || 0;
    var height = Number(sourceH) || 0;
    if (!width || !height) return { width: 0, height: 0 };
    if (normalizeRotation(rotation) % 180 === 0) {
      return { width: width, height: height };
    }
    return { width: height, height: width };
  }

  // panel.js の rotateCropRect と同じ変換（回転時の crop 矩形の追従用）。
  function rotateCropRect(rect, prevW, prevH, delta) {
    var amount = normalizeRotation(delta);
    if (!prevW || !prevH) return rect;
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

  // panel.js の flipCropRect と同じ変換（反転時の crop 矩形の追従用）。
  function flipCropRect(rect, displayW, displayH, flipH, flipV) {
    var next = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    if (flipH) {
      next.x = displayW - (next.x + next.width);
    }
    if (flipV) {
      next.y = displayH - (next.y + next.height);
    }
    return next;
  }

  // 表示サイズ内に収めるだけのクランプ（panel.js の clampCropRect の
  // 最小サイズ制約を除いた純粋版。境界の扱いを合わせるために使う）。
  function clampCropToDisplay(rect, displayW, displayH) {
    if (!rect || !displayW || !displayH) {
      return { x: 0, y: 0, width: displayW || 0, height: displayH || 0 };
    }
    var width = Math.min(Math.max(rect.width, 1), displayW);
    var height = Math.min(Math.max(rect.height, 1), displayH);
    var x = Math.min(Math.max(rect.x, 0), displayW - width);
    var y = Math.min(Math.max(rect.y, 0), displayH - height);
    return { x: x, y: y, width: width, height: height };
  }

  // 書き出し計画。crop は getCropFilter と同じく「回転・反転後の表示座標系」。
  // crop が null のときは全面。出力サイズは偶数に丸める。
  function computeExportPlan(sourceW, sourceH, rotation, crop) {
    var display = getDisplaySizeFor(sourceW, sourceH, rotation);
    var rect = crop
      ? clampCropToDisplay(
          { x: crop.x, y: crop.y, width: crop.width, height: crop.height },
          display.width,
          display.height
        )
      : { x: 0, y: 0, width: display.width, height: display.height };
    // 整数化は ffmpeg 経路の getCropFilter（Math.round）と合わせる。
    var rounded = {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    };
    // 丸めではみ出したら表示内に引き戻す。
    rounded.x = Math.min(Math.max(rounded.x, 0), Math.max(0, display.width - rounded.width));
    rounded.y = Math.min(Math.max(rounded.y, 0), Math.max(0, display.height - rounded.height));
    rounded.width = Math.min(rounded.width, display.width - rounded.x);
    rounded.height = Math.min(rounded.height, display.height - rounded.y);
    return {
      displayW: display.width,
      displayH: display.height,
      cropX: rounded.x,
      cropY: rounded.y,
      cropW: rounded.width,
      cropH: rounded.height,
      outW: toEvenSize(rounded.width),
      outH: toEvenSize(rounded.height),
    };
  }

  // 映像の速度変換。ffmpeg の setpts=PTS/speed と同じ。
  function outputTimestamp(inputTimestamp, start, speed) {
    return (Number(inputTimestamp) - Number(start)) / Number(speed);
  }

  // フレーム間引き判定。speed>1 で出力 fps が上限を超える場合のみ落とす。
  function shouldDropFrame(outputTs, lastKeptOutputTs, speed) {
    if (!(Number(speed) > 1)) return false;
    if (!Number.isFinite(lastKeptOutputTs)) return false;
    return outputTs - lastKeptOutputTs < 1 / MAX_OUTPUT_FPS;
  }

  // ビットレート目安 width*height*fps*0.15 を 1〜20 Mbps にクランプ。
  // 0.15 は実測で現行 ffmpeg（x264 veryfast crf23）と同等以上の画質
  // （SSIM/PSNR）になる係数。第 1 ラウンドの 0.1 ではやや低画質だった。
  function computeVideoBitrate(width, height, fps) {
    var rate = Number(fps);
    if (!Number.isFinite(rate) || rate <= 0) rate = DEFAULT_FPS_HINT;
    var bitrate = Math.round(Number(width) * Number(height) * rate * 0.15);
    if (!Number.isFinite(bitrate)) bitrate = MIN_BITRATE;
    return Math.min(MAX_BITRATE, Math.max(MIN_BITRATE, bitrate));
  }

  // 秒→マイクロ秒（VideoFrame の timestamp/duration 用）。整数に丸める。
  function toMicroseconds(seconds) {
    var value = Math.round(Number(seconds) * 1e6);
    if (!Number.isFinite(value)) return 0;
    return value;
  }

  // 先頭いくつかのサンプル時刻（秒、表示順）から fps を推定する。
  // 中央値を使うため外れ値（ドロップ等）に強い。推定不能なら null。
  function estimateFpsFromTimestamps(timestamps) {
    if (!timestamps || timestamps.length < 2) return null;
    var diffs = [];
    for (var i = 1; i < timestamps.length; i++) {
      var diff = Number(timestamps[i]) - Number(timestamps[i - 1]);
      if (Number.isFinite(diff) && diff > 0.0005 && diff < 10) {
        diffs.push(diff);
      }
    }
    if (!diffs.length) return null;
    diffs.sort(function (a, b) {
      return a - b;
    });
    var median = diffs[Math.floor(diffs.length / 2)];
    var fps = 1 / median;
    if (!Number.isFinite(fps) || fps <= 0 || fps > 1000) return null;
    return fps;
  }

  // 解像度に合ったレベルの H.264 codec 文字列候補（High→Main→Baseline）。
  function selectAvcCodecStrings(width, height) {
    var pixels = (Number(width) || 0) * (Number(height) || 0);
    var level = '28'; // 4.0: 1080p 級
    if (pixels <= 1280 * 720) {
      level = '1F'; // 3.1: 720p 級
    } else if (pixels > 1920 * 1088) {
      level = '33'; // 5.1: 4K 級
    }
    return ['avc1.6400' + level, 'avc1.4D40' + level, 'avc1.42E0' + level];
  }

  function getMediabunny() {
    return (root && (root.Mediabunny || root.mediabunny)) || null;
  }

  // Input は formats（対応コンテナの一覧）が必須。全対応形式を渡す。
  function createInput(MB, file) {
    return new MB.Input({
      source: new MB.BlobSource(file),
      formats: MB.ALL_FORMATS,
    });
  }

  function isCancelError(error) {
    if (!error) return false;
    var name = error.name || '';
    return (
      name === 'AbortError' ||
      name === 'ConversionCanceledError' ||
      name === 'FfmpegCancelError' ||
      error.aborted === true
    );
  }

  function throwIfAborted(signal) {
    if (signal && signal.aborted) {
      var error = new Error('処理を中断しました。');
      error.name = 'AbortError';
      throw error;
    }
  }

  // 対応可否の事前判定。VideoEncoder の isConfigSupported を直接確認する。
  async function isSupported() {
    try {
      if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') {
        return false;
      }
      if (typeof OffscreenCanvas === 'undefined') return false;
      var MB = getMediabunny();
      if (!MB) return false;
      var candidates = selectAvcCodecStrings(1280, 720);
      var accelerations = ['prefer-hardware', 'no-preference'];
      for (var a = 0; a < accelerations.length; a++) {
        for (var c = 0; c < candidates.length; c++) {
          try {
            var result = await VideoEncoder.isConfigSupported({
              codec: candidates[c],
              width: 1280,
              height: 720,
              hardwareAcceleration: accelerations[a],
              avc: { format: 'avc' },
            });
            if (result && result.supported) return true;
          } catch (error) {
            continue;
          }
        }
      }
      // 直接判定が通らなくても mediabunny 側で符号化可能と判断できれば使う。
      if (MB.canEncodeVideo) {
        try {
          return await MB.canEncodeVideo('avc', { width: 1280, height: 720 });
        } catch (error) {
          return false;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // 入力に音声トラックがあるか。判定不能・失敗時は例外にする
  // （呼び出し側が「失敗=音声あり扱いで試す」か決められるようにするため）。
  async function hasAudio(file) {
    var MB = getMediabunny();
    if (!MB) throw new Error('Mediabunny が読み込まれていません。');
    var input = createInput(MB, file);
    try {
      var tracks = await input.getAudioTracks();
      return tracks.length > 0;
    } finally {
      if (input && typeof input.dispose === 'function') input.dispose();
    }
  }

  // 先頭の映像トラックを返す。プライマリが無ければ先頭を使う。
  async function getVideoTrack(input) {
    var tracks = await input.getVideoTracks();
    if (!tracks.length) throw new Error('映像トラックが見つかりません。');
    try {
      if (typeof input.getPrimaryVideoTrack === 'function') {
        var primary = await input.getPrimaryVideoTrack();
        if (primary) return primary;
      }
    } catch (error) {
      // プライマリ取得に失敗したら先頭トラックに倒す。
    }
    return tracks[0];
  }

  // 映像トラックの実寸を得る。回転メタデータ付き入力では表示寸法に直す。
  function probeVideoSource(track) {
    var codedW = track.codedWidth || 0;
    var codedH = track.codedHeight || 0;
    if (!codedW || !codedH) throw new Error('映像サイズを取得できません。');
    var rotation = track.rotation || 0;
    if (normalizeRotation(rotation) % 180 === 0) {
      return { sourceW: codedW, sourceH: codedH, trackRotation: rotation };
    }
    return { sourceW: codedH, sourceH: codedW, trackRotation: rotation };
  }

  // 映像の実 fps を得る。mediabunny の computeFrameRateMetrics
  // （パケット時刻からの推定。デコード不要）を優先し、取れなければ
  // 先頭サンプルの時刻差から推定、最後は 30 に倒す。
  async function resolveVideoFps(MB, track, start, end) {
    try {
      if (track && typeof track.computeFrameRateMetrics === 'function') {
        var metrics = await track.computeFrameRateMetrics();
        var rate =
          (metrics && (metrics.underlyingFrameRate || metrics.bestGuessFrameRate)) || 0;
        if (Number.isFinite(rate) && rate > 0 && rate <= 1000) {
          return rate;
        }
      }
    } catch (error) {
      // 推定に失敗したら下のフォールバックへ。
    }
    try {
      var sink = new MB.VideoSampleSink(track);
      var stamps = [];
      var probeEnd = Math.min(end, start + 5);
      for await (const sample of sink.samples(start, probeEnd)) {
        stamps.push(sample.timestamp);
        sample.close();
        if (stamps.length >= 30) break;
      }
      var estimated = estimateFpsFromTimestamps(stamps);
      if (estimated) return estimated;
    } catch (error) {
      // 先頭復号に失敗したら既定値へ。
    }
    return DEFAULT_FPS_HINT;
  }

  // isSupported と同じ基準で実際に使う設定を選ぶ。
  // bitrate は実 fps から算出する（第 1 ラウンドの 30 固定をやめた）。
  async function pickEncoderConfig(outW, outH, fps) {
    var candidates = selectAvcCodecStrings(outW, outH);
    var accelerations = ['prefer-hardware', 'no-preference'];
    var bitrate = computeVideoBitrate(outW, outH, fps);
    for (var a = 0; a < accelerations.length; a++) {
      for (var c = 0; c < candidates.length; c++) {
        try {
          var result = await VideoEncoder.isConfigSupported({
            codec: candidates[c],
            width: outW,
            height: outH,
            bitrate: bitrate,
            hardwareAcceleration: accelerations[a],
            avc: { format: 'avc' },
          });
          if (result && result.supported) {
            return {
              codec: candidates[c],
              hardwareAcceleration: accelerations[a],
              bitrate: bitrate,
              latencyMode: 'quality',
            };
          }
        } catch (error) {
          continue;
        }
      }
    }
    throw new Error('H.264 エンコーダを利用できません。');
  }

  function createCanvas(width, height) {
    var canvas = new OffscreenCanvas(Math.max(1, width), Math.max(1, height));
    return canvas;
  }

  function nowMs() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  }

  // バックプレッシャー: encode 待ちが溜まったら dequeue まで待つ（中断時は即時復帰）。
  function waitForEncoderQueue(enc, signal) {
    if (!enc || enc.encodeQueueSize <= 8) return Promise.resolve();
    return new Promise(function (resolve) {
      var done = function () {
        try {
          enc.removeEventListener('dequeue', done);
        } catch (ignored) {
          // removeEventListener の失敗は無視する。
        }
        if (signal) {
          try {
            signal.removeEventListener('abort', done);
          } catch (ignored) {
            // removeEventListener の失敗は無視する。
          }
        }
        resolve();
      };
      enc.addEventListener('dequeue', done, { once: true });
      if (signal) {
        if (signal.aborted) {
          done();
        } else {
          signal.addEventListener('abort', done, { once: true });
        }
      }
    });
  }

  function createFrameCanvases() {
    return { base: null, disp: null, out: null };
  }

  // 3 段 Canvas 変換（回転メタデータ焼き込み → ユーザー変換 → crop 切り出し）。
  // 第 1 ラウンドの Conversion process 内の描画と同一。描画先の outCanvas を返す。
  // panel.js の drawTransformedSource と同じ順序（中央基準で回転→反転）。
  function drawSampleFrame(canvases, sample, plan, rotation, flipH, flipV, rad) {
    var baseW = plan.displayW;
    var baseH = plan.displayH;
    // 入力サンプルを即時 Canvas 化する（VideoFrame は次のマイクロタスクで
    // 閉じられる場合があるため、この関数内で同期的に描画しきる）。
    var image = sample.toCanvasImageSource();
    var codedW = sample.codedWidth || baseW;
    var codedH = sample.codedHeight || baseH;
    // トラックの回転メタデータはここで焼く。以降は表示寸法で扱う。
    var sampleRotation = normalizeRotation(sample.rotation || 0);
    var normW = sampleRotation % 180 === 0 ? codedW : codedH;
    var normH = sampleRotation % 180 === 0 ? codedH : codedW;
    if (!canvases.base || canvases.base.width !== normW || canvases.base.height !== normH) {
      canvases.base = createCanvas(normW, normH);
    }
    var baseCtx = canvases.base.getContext('2d');
    baseCtx.save();
    // 小数残りを避けるため整数キャンバスへリセットしてから描く。
    baseCtx.setTransform(1, 0, 0, 1, 0, 0);
    baseCtx.clearRect(0, 0, normW, normH);
    baseCtx.translate(normW / 2, normH / 2);
    baseCtx.rotate((sampleRotation * Math.PI) / 180);
    baseCtx.drawImage(image, -codedW / 2, -codedH / 2, codedW, codedH);
    baseCtx.restore();
    // ユーザー変換（panel.js の drawTransformedSource と同じ。反転は表示座標基準で、
    // ffmpeg 経路の transpose→hflip/vflip と一致させる。Canvas では scale を先に
    // 呼ぶと描画点には回転→反転の順で掛かる）。
    if (!canvases.disp || canvases.disp.width !== plan.displayW || canvases.disp.height !== plan.displayH) {
      canvases.disp = createCanvas(plan.displayW, plan.displayH);
    }
    var dispCtx = canvases.disp.getContext('2d');
    dispCtx.setTransform(1, 0, 0, 1, 0, 0);
    dispCtx.clearRect(0, 0, plan.displayW, plan.displayH);
    dispCtx.imageSmoothingEnabled = true;
    dispCtx.imageSmoothingQuality = 'high';
    dispCtx.translate(plan.displayW / 2, plan.displayH / 2);
    dispCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    dispCtx.rotate(rad);
    // 元映像と計画の表示寸法が食い違う入力では引き伸ばさず中央に置く。
    dispCtx.drawImage(canvases.base, -normW / 2, -normH / 2, normW, normH);
    // crop 領域を切り出して偶数サイズへ描く（全面のときは等倍コピー）。
    if (!canvases.out || canvases.out.width !== plan.outW || canvases.out.height !== plan.outH) {
      canvases.out = createCanvas(plan.outW, plan.outH);
    }
    var outCtx = canvases.out.getContext('2d');
    outCtx.setTransform(1, 0, 0, 1, 0, 0);
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';
    outCtx.drawImage(
      canvases.disp,
      plan.cropX,
      plan.cropY,
      plan.cropW,
      plan.cropH,
      0,
      0,
      plan.outW,
      plan.outH
    );
    return canvases.out;
  }

  // audio: 'auto' 用の音声トラック準備。Output.start() の前に呼ぶこと。
  // 戻り値: null（音声なし/取り込み不可）か { kind, atrack, codec, decoderConfig }。
  // kind 'copy' は AAC パケットコピー、kind 'aac' はデコード→AAC 再エンコード。
  async function setupAudioTrack(MB, input) {
    var atrack = null;
    try {
      if (typeof input.getPrimaryAudioTrack === 'function') {
        atrack = await input.getPrimaryAudioTrack();
      }
      if (!atrack) {
        var tracks = await input.getAudioTracks();
        atrack = tracks.length ? tracks[0] : null;
      }
    } catch (error) {
      return null;
    }
    if (!atrack) return null;
    var codec = null;
    try {
      if (typeof atrack.getCodec === 'function') {
        codec = await atrack.getCodec();
      } else {
        codec = atrack.codec || null;
      }
    } catch (error) {
      codec = null;
    }
    if (!codec) return null;
    if (codec === 'aac') {
      if (!MB.EncodedAudioPacketSource || !MB.EncodedPacketSink) return null;
      var decoderConfig = null;
      try {
        if (typeof atrack.getDecoderConfig === 'function') {
          decoderConfig = await atrack.getDecoderConfig();
        }
      } catch (error) {
        decoderConfig = null;
      }
      return { kind: 'copy', atrack: atrack, codec: codec, decoderConfig: decoderConfig };
    }
    // AAC 以外は再エンコードを試みる。復号も AAC 符号化もできない環境なら諦め、
    // 呼び出し側の ffmpeg 経路に任せる（audioIncluded: false で返す）。
    if (!MB.AudioSampleSource || !MB.AudioSampleSink) return null;
    try {
      if (typeof atrack.canDecode === 'function') {
        if (!(await atrack.canDecode())) return null;
      }
      if (typeof MB.canEncodeAudio === 'function') {
        if (!(await MB.canEncodeAudio('aac'))) return null;
      }
    } catch (error) {
      return null;
    }
    return { kind: 'aac', atrack: atrack, codec: codec, decoderConfig: null };
  }

  // 映像を WebCodecs（自前 VideoEncoder）で書き出し、mp4 の Blob と使用設定を返す。
  // crop は getCropFilter と同じ「回転・反転後の表示座標系」。null で全面。
  // audio: 'none'（既定）…映像のみ。呼び出し側が ffmpeg で音声処理 + mux する。
  // audio: 'auto' …音声トラックがあれば同じ Output に入れる（AAC はパケット
  // コピー、それ以外は AAC に再エンコード。再エンコード不能なら映像のみで
  // audioIncluded: false を返し、呼び出し側の ffmpeg 経路に任せる）。
  async function exportVideo(options) {
    var opts = options || {};
    var file = opts.file;
    var start = Number(opts.start) || 0;
    var end = Number(opts.end);
    var rotation = normalizeRotation(opts.rotation || 0);
    var flipH = Boolean(opts.flipH);
    var flipV = Boolean(opts.flipV);
    var speed = Number(opts.speed) || 1;
    var wantAudio = opts.audio === 'auto';
    var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
    var signal = opts.signal || null;
    if (!file) throw new Error('入力ファイルがありません。');
    if (!Number.isFinite(end) || end <= start) {
      throw new Error('区間の指定が不正です。');
    }
    if (!(speed >= 0.25 && speed <= 4)) {
      throw new Error('速度は 0.25〜4 の範囲で指定してください。');
    }
    var MB = getMediabunny();
    if (!MB) throw new Error('Mediabunny が読み込まれていません。');
    if (typeof VideoEncoder === 'undefined' || typeof OffscreenCanvas === 'undefined') {
      throw new Error('この環境では WebCodecs を利用できません。');
    }
    throwIfAborted(signal);

    // 自前パイプラインに必要な mediabunny API が揃っているか事前に確認する。
    if (
      !MB.VideoSampleSink ||
      !MB.EncodedVideoPacketSource ||
      !MB.EncodedPacket ||
      !MB.Output ||
      !MB.Mp4OutputFormat ||
      !MB.BufferTarget
    ) {
      throw new Error('Mediabunny の必要な API がありません。');
    }
    throwIfAborted(signal);

    var input = createInput(MB, file);
    var enc = null;
    var output = null;
    var outputStarted = false;
    var finalized = false;
    try {
      var track = await getVideoTrack(input);
      throwIfAborted(signal);
      var probed = probeVideoSource(track);
      var plan = computeExportPlan(probed.sourceW, probed.sourceH, rotation, opts.crop || null);
      if (!plan.outW || !plan.outH) throw new Error('出力サイズを決められません。');
      var fps = await resolveVideoFps(MB, track, start, end);
      throwIfAborted(signal);
      var encoderConfig = await pickEncoderConfig(plan.outW, plan.outH, fps);
      throwIfAborted(signal);
      // 音声の準備。Output へのトラック追加は start() の前に終える必要がある。
      var audioSetup = wantAudio ? await setupAudioTrack(MB, input) : null;
      throwIfAborted(signal);

      var target = new MB.BufferTarget();
      output = new MB.Output({
        format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }),
        target: target,
      });
      var videoSource = new MB.EncodedVideoPacketSource('avc');
      output.addVideoTrack(videoSource);
      var audioSource = null;
      if (audioSetup) {
        if (audioSetup.kind === 'copy') {
          audioSource = new MB.EncodedAudioPacketSource(audioSetup.codec);
        } else {
          audioSource = new MB.AudioSampleSource({ codec: 'aac', bitrate: 128000 });
        }
        var audioMetadata = audioSetup.decoderConfig
          ? { decoderConfig: audioSetup.decoderConfig }
          : undefined;
        output.addAudioTrack(audioSource, audioMetadata);
      }
      await output.start();
      outputStarted = true;
      throwIfAborted(signal);

      // ---- 映像: VideoSampleSink → Canvas 変換 → 自前 VideoEncoder → mux ----
      var tVideo0 = nowMs();
      var lastKeptOutTs = Number.NEGATIVE_INFINITY;
      var lastKeyOutTs = Number.NEGATIVE_INFINITY;
      var framesIn = 0;
      var framesOut = 0;
      var framesDropped = 0;
      var processed = 0;
      // 間引きは出力 fps が MAX_OUTPUT_FPS を超えるときだけ起きるので、
      // 見込み数もそのときだけ減らす（speed で割ると進捗が早く 100% に張り付く）。
      var keepRatio = fps * speed > MAX_OUTPUT_FPS ? MAX_OUTPUT_FPS / (fps * speed) : 1;
      var expectedFrames = Math.max(1, Math.round((end - start) * fps * keepRatio));
      // 進捗配分: 音声ありなら映像 0〜0.9・音声 0.9〜0.98・finalize で 1.0。
      var videoSpan = audioSetup ? 0.9 : 1;
      var rad = (rotation * Math.PI) / 180;
      var canvases = createFrameCanvases();
      var encodeError = null;
      var pending = Promise.resolve();
      var firstMeta = null;
      enc = new VideoEncoder({
        output: function (chunk, meta) {
          // 最初の chunk の decoderConfig を必ず mux に渡す（実測済みの扱い）。
          if (meta && meta.decoderConfig && !firstMeta) {
            firstMeta = meta;
          }
          var useMeta = meta && meta.decoderConfig ? meta : firstMeta || undefined;
          pending = pending.then(function () {
            return videoSource.add(MB.EncodedPacket.fromEncodedChunk(chunk), useMeta);
          });
          // 後で await pending しない経路（中断など）でも未処理扱いにしない。
          pending.then(null, function () {
            // add 側の失敗は await pending で扱うためここでは無視する。
          });
        },
        error: function (e) {
          encodeError = e;
        },
      });
      enc.configure({
        codec: encoderConfig.codec,
        width: plan.outW,
        height: plan.outH,
        bitrate: encoderConfig.bitrate,
        framerate: fps,
        hardwareAcceleration: encoderConfig.hardwareAcceleration,
        avc: { format: 'avc' },
        latencyMode: 'quality',
      });
      var sink = new MB.VideoSampleSink(track);
      for await (var sample of sink.samples(start, end)) {
        throwIfAborted(signal);
        framesIn++;
        var inTs = sample.timestamp;
        // 開始より前のフレームは捨てる（-ss を -i の前に置いた場合と同等の精度）。
        if (!(inTs >= start - 0.001)) {
          framesDropped++;
          sample.close();
          continue;
        }
        var outTs = outputTimestamp(inTs, start, speed);
        if (!(outTs >= 0)) {
          framesDropped++;
          sample.close();
          continue;
        }
        if (shouldDropFrame(outTs, lastKeptOutTs, speed)) {
          framesDropped++;
          sample.close();
          continue;
        }
        var outCanvas = drawSampleFrame(canvases, sample, plan, rotation, flipH, flipV, rad);
        lastKeptOutTs = outTs;
        framesOut++;
        // 約2秒ごとにキーフレームを要求する（先頭は必ずキー）。
        var wantKeyFrame = outTs - lastKeyOutTs >= KEYFRAME_INTERVAL_SEC - 0.001;
        if (wantKeyFrame) lastKeyOutTs = outTs;
        var sampleDuration = sample.duration > 0 ? sample.duration / speed : 1 / fps / speed;
        sample.close();
        // VideoFrame の時刻はマイクロ秒整数。
        var frame = new VideoFrame(outCanvas, {
          timestamp: toMicroseconds(outTs),
          duration: Math.max(1, toMicroseconds(sampleDuration)),
        });
        try {
          enc.encode(frame, { keyFrame: wantKeyFrame });
        } finally {
          frame.close();
        }
        processed++;
        if (onProgress) {
          onProgress(clamp01((processed / expectedFrames) * videoSpan));
        }
        await waitForEncoderQueue(enc, signal);
      }
      await enc.flush();
      enc.close();
      enc = null;
      if (encodeError) {
        throw encodeError;
      }
      await pending;
      videoSource.close();
      var tVideo = nowMs() - tVideo0;
      if (onProgress) {
        onProgress(videoSpan);
      }

      // ---- 音声: 同じ Output へ（AAC はパケットコピー、それ以外は再エンコード） ----
      var tAudio = 0;
      var audioMode = 'none';
      if (audioSetup && audioSource) {
        var tAudio0 = nowMs();
        if (audioSetup.kind === 'copy') {
          var packetSink = new MB.EncodedPacketSink(audioSetup.atrack);
          var firstAudio = true;
          for await (var packet of packetSink.packets()) {
            throwIfAborted(signal);
            // ffmpeg の -ss と同程度にパケット境界で切る。start に掛かる
            // パケットは残し、タイムスタンプを start 分だけ前にずらす。
            if (packet.timestamp < 0) continue;
            if (packet.timestamp + packet.duration <= start) continue;
            if (packet.timestamp >= end) break;
            var shifted = packet.clone({ timestamp: packet.timestamp - start });
            await audioSource.add(
              shifted,
              firstAudio
                ? audioSetup.decoderConfig
                  ? { decoderConfig: audioSetup.decoderConfig }
                  : undefined
                : undefined
            );
            firstAudio = false;
            if (onProgress) {
              onProgress(0.9 + 0.08 * clamp01((packet.timestamp - start) / (end - start)));
            }
          }
          audioMode = 'copy';
        } else {
          var audioSink = new MB.AudioSampleSink(audioSetup.atrack);
          for await (var audioSample of audioSink.samples(start, end)) {
            throwIfAborted(signal);
            if (audioSample.timestamp + audioSample.duration <= start) {
              audioSample.close();
              continue;
            }
            if (audioSample.timestamp >= end) {
              audioSample.close();
              break;
            }
            // 出力 TS は映像と同じく start 基準にずらす。
            var audioInTs = audioSample.timestamp;
            audioSample.setTimestamp(audioInTs - start);
            // add() は shouldClose=false（呼び出し側が close する）。
            // encode 完了まで待ってから閉じるため await の後で close する。
            await audioSource.add(audioSample);
            audioSample.close();
            if (onProgress) {
              onProgress(0.9 + 0.08 * clamp01((audioInTs - start) / (end - start)));
            }
          }
          audioMode = 'aac';
        }
        audioSource.close();
        tAudio = nowMs() - tAudio0;
        if (onProgress) {
          onProgress(0.98);
        }
      }
      throwIfAborted(signal);

      var tFin0 = nowMs();
      await output.finalize();
      finalized = true;
      var tFinalize = nowMs() - tFin0;
      if (onProgress) {
        onProgress(1);
      }
      var buffer = target.buffer;
      if (!buffer || !buffer.byteLength) {
        throw new Error('映像の書き出し結果が空になりました。');
      }
      return {
        blob: new Blob([buffer], { type: 'video/mp4' }),
        width: plan.outW,
        height: plan.outH,
        codec: encoderConfig.codec,
        hardwareAcceleration: encoderConfig.hardwareAcceleration,
        bitrate: encoderConfig.bitrate,
        fps: fps,
        framesIn: framesIn,
        framesOut: framesOut,
        framesDropped: framesDropped,
        audioIncluded: audioMode !== 'none',
        audioMode: audioMode,
        phaseMs: {
          video: Math.round(tVideo),
          audio: Math.round(tAudio),
          finalize: Math.round(tFinalize),
        },
      };
    } catch (error) {
      // キャンセル時は finalize せず Output を捨てる（AbortError を投げる）。
      if (output && outputStarted && !finalized) {
        try {
          await output.cancel();
        } catch (ignored) {
          // 中断・失敗時の後始末の失敗は無視する。
        }
      }
      if (signal && signal.aborted) {
        var abortError = new Error('処理を中断しました。');
        abortError.name = 'AbortError';
        throw abortError;
      }
      if (isCancelError(error)) throw error;
      throw error;
    } finally {
      if (enc) {
        try {
          enc.close();
        } catch (ignored) {
          // 後始末の失敗は無視する。
        }
      }
      if (input && typeof input.dispose === 'function') input.dispose();
    }
  }

  // k 周目（0 始まり）のパケットタイムスタンプ。純粋関数（テスト用）。
  function repeatTimestamp(timestamp, round, segmentDuration) {
    return Number(timestamp) + Number(round) * Number(segmentDuration);
  }

  // 繰り返し書き出し用のファイル名。times>1 のとき末尾（拡張子の前）に
  // -xN を付ける。純粋関数（テスト用）。
  function withRepeatSuffix(filename, times) {
    var count = Math.floor(Number(times));
    if (!(count > 1)) return String(filename);
    var name = String(filename);
    var dot = name.lastIndexOf('.');
    if (dot > 0) {
      return name.slice(0, dot) + '-x' + count + name.slice(dot);
    }
    return name + '-x' + count;
  }

  // 完成済み mp4（1 回分）を N 回連結した 1 本の mp4 を作る。再エンコードしない。
  // 全トラックのパケットを EncodedPacketSink で列挙し、k 周目は
  // clone({ timestamp: timestamp + k * segmentDuration }) でずらして書く。
  // segmentDuration はトラックの computeDuration() と観測した最終パケット終端の
  // 大きい方。初回 add のみ { decoderConfig } を渡す。fastStart: 'in-memory'。
  async function repeatMp4(blob, times, options) {
    var opts = options || {};
    var count = Math.floor(Number(times));
    var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
    var signal = opts.signal || null;
    if (!blob || !blob.size) throw new Error('繰り返す映像がありません。');
    if (!(count > 1)) return blob;
    var MB = getMediabunny();
    if (!MB) throw new Error('Mediabunny が読み込まれていません。');
    if (
      !MB.EncodedPacketSink ||
      !MB.EncodedPacket ||
      !MB.EncodedVideoPacketSource ||
      !MB.EncodedAudioPacketSource ||
      !MB.Output ||
      !MB.Mp4OutputFormat ||
      !MB.BufferTarget
    ) {
      throw new Error('Mediabunny の必要な API がありません。');
    }
    throwIfAborted(signal);

    var input = createInput(MB, blob);
    var output = null;
    var outputStarted = false;
    var finalized = false;
    try {
      var videoTracks = await input.getVideoTracks();
      var audioTracks = await input.getAudioTracks();
      throwIfAborted(signal);
      if (!videoTracks.length) throw new Error('映像トラックが見つかりません。');

      // パケット収集と区間長の確定。packets() は decode 順に列挙する。
      var entries = [];
      var trackList = videoTracks
        .map(function (track) {
          return { kind: 'video', track: track };
        })
        .concat(
          audioTracks.map(function (track) {
            return { kind: 'audio', track: track };
          })
        );
      for (var t = 0; t < trackList.length; t++) {
        throwIfAborted(signal);
        var track = trackList[t].track;
        var sink = new MB.EncodedPacketSink(track);
        var packets = [];
        var maxEnd = 0;
        for await (var packet of sink.packets()) {
          // 0 以前に終わるパケットは出さない（音声コピー経路と同程度の扱い）。
          if (packet.timestamp + packet.duration <= 0) continue;
          packets.push(packet);
          var packetEnd = packet.timestamp + packet.duration;
          if (packetEnd > maxEnd) maxEnd = packetEnd;
        }
        var computed = 0;
        try {
          if (track && typeof track.computeDuration === 'function') {
            computed = (await track.computeDuration()) || 0;
          }
        } catch (error) {
          computed = 0;
        }
        var segmentDuration = Math.max(Number(computed) || 0, maxEnd);
        if (!(segmentDuration > 0)) {
          throw new Error('区間の長さを取得できません。');
        }
        var codec = null;
        try {
          if (track && typeof track.getCodec === 'function') {
            codec = await track.getCodec();
          } else {
            codec = track.codec || null;
          }
        } catch (error) {
          codec = null;
        }
        if (!codec) throw new Error('トラックのコーデックを取得できません。');
        var decoderConfig = null;
        try {
          if (track && typeof track.getDecoderConfig === 'function') {
            decoderConfig = await track.getDecoderConfig();
          }
        } catch (error) {
          decoderConfig = null;
        }
        entries.push({
          kind: trackList[t].kind,
          codec: codec,
          decoderConfig: decoderConfig,
          packets: packets,
          segmentDuration: segmentDuration,
          source: null,
        });
      }
      throwIfAborted(signal);

      var target = new MB.BufferTarget();
      output = new MB.Output({
        format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }),
        target: target,
      });
      for (var e = 0; e < entries.length; e++) {
        var entry = entries[e];
        if (entry.kind === 'video') {
          entry.source = new MB.EncodedVideoPacketSource(entry.codec);
          output.addVideoTrack(entry.source);
        } else {
          entry.source = new MB.EncodedAudioPacketSource(entry.codec);
          output.addAudioTrack(
            entry.source,
            entry.decoderConfig ? { decoderConfig: entry.decoderConfig } : undefined
          );
        }
      }
      await output.start();
      outputStarted = true;
      throwIfAborted(signal);

      var totalWrites = 0;
      for (var w = 0; w < entries.length; w++) {
        totalWrites += entries[w].packets.length * count;
      }
      totalWrites = Math.max(1, totalWrites);
      var written = 0;
      for (var s = 0; s < entries.length; s++) {
        var job = entries[s];
        var firstAdd = true;
        for (var round = 0; round < count; round++) {
          for (var p = 0; p < job.packets.length; p++) {
            throwIfAborted(signal);
            var original = job.packets[p];
            // clone は type・sequenceNumber・sideData を維持する。
            var shifted = original.clone({
              timestamp: repeatTimestamp(original.timestamp, round, job.segmentDuration),
            });
            await job.source.add(
              shifted,
              firstAdd && job.decoderConfig ? { decoderConfig: job.decoderConfig } : undefined
            );
            firstAdd = false;
            written++;
            if (onProgress) {
              onProgress(clamp01((written / totalWrites) * 0.98));
            }
          }
        }
        job.source.close();
      }
      throwIfAborted(signal);

      await output.finalize();
      finalized = true;
      if (onProgress) {
        onProgress(1);
      }
      var buffer = target.buffer;
      if (!buffer || !buffer.byteLength) {
        throw new Error('繰り返し書き出しの結果が空になりました。');
      }
      return new Blob([buffer], { type: 'video/mp4' });
    } catch (error) {
      // キャンセル時は finalize せず Output を捨てる（AbortError を投げる）。
      if (output && outputStarted && !finalized) {
        try {
          await output.cancel();
        } catch (ignored) {
          // 中断・失敗時の後始末の失敗は無視する。
        }
      }
      if (signal && signal.aborted) {
        var abortError = new Error('処理を中断しました。');
        abortError.name = 'AbortError';
        throw abortError;
      }
      if (isCancelError(error)) throw error;
      throw error;
    } finally {
      if (input && typeof input.dispose === 'function') input.dispose();
    }
  }

  var api = {
    isSupported: isSupported,
    hasAudio: hasAudio,
    exportVideo: exportVideo,
    repeatMp4: repeatMp4,
    isCancelError: isCancelError,
    // 純粋関数（node の簡易テスト用に公開。DOM・WebCodecs 不要）。
    getDisplaySizeFor: getDisplaySizeFor,
    rotateCropRect: rotateCropRect,
    flipCropRect: flipCropRect,
    clampCropToDisplay: clampCropToDisplay,
    computeExportPlan: computeExportPlan,
    outputTimestamp: outputTimestamp,
    shouldDropFrame: shouldDropFrame,
    computeVideoBitrate: computeVideoBitrate,
    toMicroseconds: toMicroseconds,
    estimateFpsFromTimestamps: estimateFpsFromTimestamps,
    selectAvcCodecStrings: selectAvcCodecStrings,
    toEvenSize: toEvenSize,
    normalizeRotation: normalizeRotation,
    repeatTimestamp: repeatTimestamp,
    withRepeatSuffix: withRepeatSuffix,
    MAX_OUTPUT_FPS: MAX_OUTPUT_FPS,
  };

  root.SilvaWebCodecs = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
