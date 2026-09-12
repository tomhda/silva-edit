#!/usr/bin/env python3
"""配布用 zip を作る。リポジトリ直下で `python tools/build-zip.py` と実行する。

manifest.json の name / action.default_title を `SILVA EDIT` に書き換えた
コピーを zip に入れ、dist/SILVA-EDIT-<version>-webstore.zip を作る。
リポジトリ側の manifest.json（SILVA EDIT-dev のまま）は変更しない。
既存の zip があれば確認せず上書きする。Python 3 標準ライブラリのみを使う。
"""

import json
import sys
import zipfile
from pathlib import Path

STORE_NAME = "SILVA EDIT"

# zip に入れるファイル・ディレクトリ（リポジトリ直下からの相対パス）。
INCLUDE_FILES = [
    "LICENSE",
    "README.md",
    "THIRD_PARTY_NOTICES.md",
    "background.js",
    "icon.svg",
    "manifest.json",
    "panel.css",
    "panel.html",
    "panel.js",
    "webcodecs-export.js",
]
INCLUDE_DIRS = [
    Path("images"),
    Path("vendor/ffmpeg"),
    Path("vendor/ffmpeg-mt"),
    Path("vendor/mediabunny"),
]

# 含めないもの（明示的に除外する名前）。
EXCLUDE_TOP_NAMES = {
    "bench",
    "tools",
    "dist",
    ".git",
    ".gitignore",
    "silva_edit_ui_mockup_v1.png",
}


def is_excluded(path: Path) -> bool:
    if path.suffix == ".tmp.md":
        return True
    return any(part in EXCLUDE_TOP_NAMES for part in path.parts)


def collect_files(root: Path) -> list[Path]:
    collected: list[Path] = []
    for name in INCLUDE_FILES:
        candidate = root / name
        if not candidate.is_file():
            raise FileNotFoundError(f"必須ファイルがありません: {candidate}")
        collected.append(candidate)
    for directory in INCLUDE_DIRS:
        target = root / directory
        if not target.is_dir():
            raise FileNotFoundError(f"必須ディレクトリがありません: {target}")
        for child in sorted(target.rglob("*")):
            if child.is_file() and not is_excluded(child.relative_to(root)):
                collected.append(child)
    for path in collected:
        if is_excluded(path.relative_to(root)):
            raise ValueError(f"除外対象が含まれています: {path}")
    return collected


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    with open(root / "manifest.json", encoding="utf-8") as handle:
        manifest = json.load(handle)
    version = manifest.get("version")
    if not version:
        raise ValueError("manifest.json に version がありません。")

    store_manifest = dict(manifest)
    store_manifest["name"] = STORE_NAME
    action = dict(manifest.get("action", {}))
    action["default_title"] = STORE_NAME
    store_manifest["action"] = action
    store_manifest_text = json.dumps(store_manifest, ensure_ascii=False, indent=2) + "\n"

    dist_dir = root / "dist"
    dist_dir.mkdir(exist_ok=True)
    zip_path = dist_dir / f"SILVA-EDIT-{version}-webstore.zip"

    files = collect_files(root)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            relative = path.relative_to(root).as_posix()
            if relative == "manifest.json":
                archive.writestr(relative, store_manifest_text.encode("utf-8"))
            else:
                archive.write(path, relative)
    print(f"作成しました: {zip_path}（{len(files)} ファイル）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
