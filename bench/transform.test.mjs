// bench/transform.test.mjs
// webcodecs-export.js の純粋関数（DOM・WebCodecs 不要）の node 実行テスト。
// 期待値は panel.js の rotateCropRect / flipCropRect / getDisplaySize と整合させる。
// 使い方: node bench/transform.test.mjs
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../webcodecs-export.js');

let passed = 0;
let failed = 0;

function eq(actual, expected, name) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`PASS ${name}`);
  } else {
    failed++;
    console.log(`FAIL ${name}: got ${a}, want ${e}`);
  }
}

// --- getDisplaySizeFor（panel.js getDisplaySize 対応）---
eq(api.getDisplaySizeFor(852, 480, 0), { width: 852, height: 480 }, 'display rot0');
eq(api.getDisplaySizeFor(852, 480, 90), { width: 480, height: 852 }, 'display rot90');
eq(api.getDisplaySizeFor(852, 480, 180), { width: 852, height: 480 }, 'display rot180');
eq(api.getDisplaySizeFor(852, 480, 270), { width: 480, height: 852 }, 'display rot270');
eq(api.getDisplaySizeFor(852, 480, -90), { width: 480, height: 852 }, 'display rot-90');
eq(api.getDisplaySizeFor(0, 480, 0), { width: 0, height: 0 }, 'display empty');

// --- rotateCropRect（panel.js と同一式）---
const rect = { x: 10, y: 20, width: 100, height: 60 };
eq(api.rotateCropRect(rect, 200, 100, 90), { x: 20, y: 10, width: 60, height: 100 }, 'rotate 90');
eq(api.rotateCropRect(rect, 200, 100, 180), { x: 90, y: 20, width: 100, height: 60 }, 'rotate 180');
eq(api.rotateCropRect(rect, 200, 100, 270), { x: 20, y: 90, width: 60, height: 100 }, 'rotate 270');
eq(api.rotateCropRect(rect, 200, 100, 0), rect, 'rotate 0');
// 往復で戻る
const r90 = api.rotateCropRect(rect, 200, 100, 90);
eq(api.rotateCropRect(r90, 100, 200, 270), rect, 'rotate 90 then 270');
const r180 = api.rotateCropRect(rect, 200, 100, 180);
eq(api.rotateCropRect(r180, 200, 100, 180), rect, 'rotate 180 twice');

// --- flipCropRect（panel.js と同一式）---
eq(
  api.flipCropRect(rect, 200, 100, true, false),
  { x: 90, y: 20, width: 100, height: 60 },
  'flipH'
);
eq(
  api.flipCropRect(rect, 200, 100, false, true),
  { x: 10, y: 20, width: 100, height: 60 },
  'flipV'
);
eq(
  api.flipCropRect(api.flipCropRect(rect, 200, 100, true, false), 200, 100, true, false),
  rect,
  'flipH twice'
);

// --- computeExportPlan ---
// 全面・回転なし
eq(api.computeExportPlan(852, 480, 0, null), {
  displayW: 852, displayH: 480,
  cropX: 0, cropY: 0, cropW: 852, cropH: 480,
  outW: 852, outH: 480,
}, 'plan full');
// 全面・90度回転で表示が入れ替わる
{
  const plan = api.computeExportPlan(852, 480, 90, null);
  eq({ w: plan.displayW, h: plan.displayH }, { w: 480, h: 852 }, 'plan rot90 display');
  eq({ w: plan.outW, h: plan.outH }, { w: 480, h: 852 }, 'plan rot90 out');
}
// 奇数 crop は偶数へ切り上げ（ffmpeg の ceil(iw/2)*2 相当）
{
  const plan = api.computeExportPlan(852, 480, 0, { x: 10, y: 20, width: 101, height: 61 });
  eq({ x: plan.cropX, y: plan.cropY, w: plan.cropW, h: plan.cropH },
    { x: 10, y: 20, w: 101, h: 61 }, 'plan crop rect');
  eq({ w: plan.outW, h: plan.outH }, { w: 102, h: 62 }, 'plan crop even');
}
// はみ出し crop は表示内に収まる
{
  const plan = api.computeExportPlan(200, 100, 0, { x: 150, y: 80, width: 100, height: 60 });
  const inside = plan.cropX + plan.cropW <= 200 && plan.cropY + plan.cropH <= 100;
  eq(inside, true, 'plan crop clamped');
  eq(plan.outW % 2, 0, 'plan outW even');
  eq(plan.outH % 2, 0, 'plan outH even');
}

// --- outputTimestamp（setpts=PTS/speed 対応）---
eq(api.outputTimestamp(5, 2, 2), 1.5, 'ts speed2');
eq(api.outputTimestamp(5, 2, 0.5), 6, 'ts speed0.5');
eq(api.outputTimestamp(2, 2, 1), 0, 'ts start');

// --- shouldDropFrame（speed>1 かつ 120fps 超のみ）---
eq(api.shouldDropFrame(1.0, 0.0, 1), false, 'drop speed1');
eq(api.shouldDropFrame(1.0, 0.0, 0.5), false, 'drop slow');
eq(api.shouldDropFrame(1 / 240, 0, 2), true, 'drop 240fps out');
eq(api.shouldDropFrame(1 / 60, 0, 2), false, 'keep 60fps out');
eq(api.shouldDropFrame(1 / 120, 0, 4), false, 'keep exactly 120fps');
eq(api.shouldDropFrame(0.5, Number.NEGATIVE_INFINITY, 4), false, 'keep first frame');

// --- computeVideoBitrate（w*h*fps*0.15 を 1〜20Mbps にクランプ）---
eq(api.computeVideoBitrate(1920, 1080, 30), 9331200, 'bitrate 1080p30');
eq(api.computeVideoBitrate(852, 480, 24), 1472256, 'bitrate 480p24');
eq(api.computeVideoBitrate(160, 120, 30), 1000000, 'bitrate clamp min');
eq(api.computeVideoBitrate(3840, 2160, 60), 20000000, 'bitrate clamp max');
eq(api.computeVideoBitrate(852, 480, 0), 1840320, 'bitrate fps fallback');

// --- toMicroseconds（秒→マイクロ秒、VideoFrame 用）---
eq(api.toMicroseconds(1), 1000000, 'us 1s');
eq(api.toMicroseconds(0), 0, 'us 0s');
eq(api.toMicroseconds(1 / 24), 41667, 'us 1/24s');
eq(api.toMicroseconds(0.1 + 0.2), 300000, 'us float');

// --- estimateFpsFromTimestamps（先頭サンプル時刻→fps、中央値方式）---
{
  const ts24 = [];
  for (let i = 0; i < 30; i++) ts24.push(i / 24);
  const fps24 = api.estimateFpsFromTimestamps(ts24);
  eq(Math.abs(fps24 - 24) < 0.001, true, 'fps 24');
  const ts30 = [];
  for (let i = 0; i < 30; i++) ts30.push(2 + i / 30);
  const fps30 = api.estimateFpsFromTimestamps(ts30);
  eq(Math.abs(fps30 - 30) < 0.001, true, 'fps 30 offset');
  // 外れ値（ドロップで 1 フレーム飛び）があっても中央値で復帰する
  const withGap = ts24.slice();
  withGap.splice(10, 1);
  const fpsGap = api.estimateFpsFromTimestamps(withGap);
  eq(Math.abs(fpsGap - 24) < 0.001, true, 'fps 24 with gap');
  eq(api.estimateFpsFromTimestamps([]), null, 'fps empty');
  eq(api.estimateFpsFromTimestamps([1.5]), null, 'fps single');
  eq(api.estimateFpsFromTimestamps([1, 1, 1]), null, 'fps flat');
}

// --- selectAvcCodecStrings（High→Main→Baseline、解像度別レベル）---
eq(api.selectAvcCodecStrings(640, 480),
  ['avc1.64001F', 'avc1.4D401F', 'avc1.42E01F'], 'codec 480p level 3.1');
eq(api.selectAvcCodecStrings(1920, 1080),
  ['avc1.640028', 'avc1.4D4028', 'avc1.42E028'], 'codec 1080p level 4.0');
eq(api.selectAvcCodecStrings(3840, 2160),
  ['avc1.640033', 'avc1.4D4033', 'avc1.42E033'], 'codec 4k level 5.1');

// --- toEvenSize（ceil(iw/2)*2 対応）---
eq(api.toEvenSize(101), 102, 'even up');
eq(api.toEvenSize(100), 100, 'even keep');
eq(api.toEvenSize(853), 854, 'even 853');

// --- repeatTimestamp（k 周目のタイムスタンプ = ts + k * segmentDuration）---
eq(api.repeatTimestamp(1.5, 0, 10), 1.5, 'repeat round0');
eq(api.repeatTimestamp(1.5, 1, 10), 11.5, 'repeat round1');
eq(api.repeatTimestamp(1.5, 2, 10), 21.5, 'repeat round2');
eq(api.repeatTimestamp(0, 2, 9.99), 19.98, 'repeat fractional');

// --- withRepeatSuffix（×2 以上で末尾に -xN）---
eq(api.withRepeatSuffix('movie-0p0-10p0.mp4', 1), 'movie-0p0-10p0.mp4', 'repeat suffix x1');
eq(api.withRepeatSuffix('movie-0p0-10p0.mp4', 2), 'movie-0p0-10p0-x2.mp4', 'repeat suffix x2');
eq(api.withRepeatSuffix('movie-0p0-10p0.mp4', 3), 'movie-0p0-10p0-x3.mp4', 'repeat suffix x3');
eq(api.withRepeatSuffix('noext', 2), 'noext-x2', 'repeat suffix noext');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
