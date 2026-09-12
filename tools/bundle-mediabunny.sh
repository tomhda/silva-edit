#!/bin/sh
# mediabunny のブラウザ用 IIFE バンドルを再現する手順。
# 拡張の CSP は script-src 'self' のため CDN 不可。npm の ESM 配布物を
# esbuild で IIFE に束ねて window.Mediabunny として露出させる。
# 使い方: sh tools/bundle-mediabunny.sh [version]
# 必要: node / npm（ネットワーク）。出力: vendor/mediabunny/mediabunny.iife.js
set -eu
VERSION="${1:-1.56.1}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT INT TERM
cd "$WORK"
npm pack "mediabunny@${VERSION}" >/dev/null 2>&1
tar xzf "mediabunny-${VERSION}.tgz"
npm init -y >/dev/null 2>&1
npm install esbuild >/dev/null 2>&1
./node_modules/.bin/esbuild "package/dist/bundles/mediabunny.mjs" \
  --bundle --format=iife --global-name=Mediabunny --minify --platform=browser \
  --log-level=warning \
  --outfile=mediabunny.iife.js
cp package/LICENSE mediabunny.LICENSE
echo "成果物: $WORK/mediabunny.iife.js / $WORK/mediabunny.LICENSE"
echo "リポジトリへ反映: vendor/mediabunny/mediabunny.iife.js と vendor/mediabunny/LICENSE に上書きコピーすること。"
