#!/bin/zsh
# 用本機的 Codex CLI 生成活動海報與主視覺圖
#
# 用法：
#   ./scripts/generate-images.sh                 生成所有「還不存在」的圖片
#   ./scripts/generate-images.sh poster-pulse    只重新生成指定的圖（會覆蓋）
#
# 提示詞放在 scripts/image-prompts/<名稱>.txt，改完提示詞再執行即可。
# 需要 cwebp（brew install webp）
# 高畫質原檔存成 assets/generated/<名稱>.webp，網站實際使用的是壓縮過的 public/images/<名稱>.webp

ROOT=${0:A:h:h}
PROMPTS=$ROOT/scripts/image-prompts

gen() {
  local n=$1
  local spec
  spec=$(cat "$PROMPTS/$n.txt") || return 1
  echo "生成中：$n"
  rm -f "$ROOT/assets/generated/$n.png"
  codex exec --skip-git-repo-check --ephemeral -s workspace-write -C "$ROOT" \
    "Use your built-in image generation tool to create ONE image, then save the resulting PNG file to assets/generated/$n.png (relative to the current working directory; copy it from wherever the tool saved it). Do not write any code or create any other files.

Image spec: $spec" > /dev/null 2>&1
  local png=$ROOT/assets/generated/$n.png
  if [[ -f $png ]]; then
    if [[ $n == poster-* ]]; then
      cwebp -quiet -m 6 -sharp_yuv -q 82 -resize 800 1000 "$png" -o "$ROOT/public/images/$n.webp"
    else
      cwebp -quiet -m 6 -sharp_yuv -q 82 "$png" -o "$ROOT/public/images/$n.webp"
    fi
    cwebp -quiet -m 6 -sharp_yuv -q 92 "$png" -o "$ROOT/assets/generated/$n.webp"
    rm -f "$png"
    echo "完成：public/images/$n.webp"
  else
    echo "失敗：$n"
  fi
}

mkdir -p "$ROOT/assets/generated" "$ROOT/public/images"

if (( $# )); then
  for n in "$@"; do gen "$n"; done
else
  for f in "$PROMPTS"/*.txt; do
    n=${f:t:r}
    [[ -f "$ROOT/public/images/$n.webp" ]] || gen "$n"
  done
fi
