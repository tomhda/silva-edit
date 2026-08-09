# THIRD-PARTY NOTICES

この拡張機能は、以下の第三者コンポーネントを同梱または利用しています。

## 1. ffmpeg.wasm ラッパー

- 名称: `@ffmpeg/ffmpeg`
- 利用ファイル: `vendor/ffmpeg/ffmpeg.js`, `vendor/ffmpeg/814.ffmpeg.js`
- ライセンス: MIT
- 参照: https://github.com/ffmpegwasm/ffmpeg.wasm

## 2. ffmpeg-core（WASM バイナリ）

- 名称: `@ffmpeg/core` 系のビルド成果物
- 利用ファイル: `vendor/ffmpeg/ffmpeg-core.js`, `vendor/ffmpeg/ffmpeg-core.wasm`
- 参照: https://github.com/ffmpegwasm/ffmpeg.wasm

### 2-1. ffmpeg-core（マルチスレッド版）

- 名称: `@ffmpeg/core-mt` 0.12.4（umd ビルド）
- 利用ファイル: `vendor/ffmpeg-mt/ffmpeg-core.js`, `vendor/ffmpeg-mt/ffmpeg-core.wasm`, `vendor/ffmpeg-mt/ffmpeg-core.worker.js`
- 参照: https://github.com/ffmpegwasm/ffmpeg.wasm

シングルスレッド版と同じ FFmpeg 構成のマルチスレッドビルドです。ライセンス条件も同じ扱いとしてください。

`ffmpeg-core.wasm` に含まれるビルド設定文字列から、少なくとも以下の構成が確認できます。

- `--enable-gpl`
- `--enable-libx264`
- `--enable-libx265`
- `--enable-libvpx`
- `--enable-libmp3lame`
- `--enable-libtheora`
- `--enable-libvorbis`
- `--enable-libopus`
- `--enable-zlib`
- `--enable-libwebp`
- `--enable-libfreetype`
- `--enable-libfribidi`
- `--enable-libass`
- `--enable-libzimg`

このため、本リポジトリは GPL 互換条件で配布する前提とし、プロジェクトライセンスを `GPL-2.0-or-later` としています。

## 3. 主な上流プロジェクト

実際のバイナリに含まれるコンポーネントの正確なライセンス条件は、各上流の配布物・ライセンス文書を参照してください。

- FFmpeg: https://ffmpeg.org/
- x264: https://code.videolan.org/videolan/x264
- x265: https://bitbucket.org/multicoreware/x265_git
- libvpx: https://chromium.googlesource.com/webm/libvpx
- LAME (libmp3lame): https://lame.sourceforge.io/
- libopus: https://opus-codec.org/
- libtheora: https://www.theora.org/
- libvorbis: https://xiph.org/vorbis/
- zlib: https://zlib.net/
- libwebp: https://chromium.googlesource.com/webm/libwebp
- FreeType: https://freetype.org/
- FriBidi: https://github.com/fribidi/fribidi
- libass: https://github.com/libass/libass
- zimg: https://github.com/sekrit-twc/zimg

## 4. 配布時の注意

- 再配布時は `LICENSE` と本 `THIRD_PARTY_NOTICES.md` を同梱してください。
- 追加で、利用する ffmpeg-core バイナリに対応する上流ソースとライセンス情報を確認し、必要な案内を維持してください。

