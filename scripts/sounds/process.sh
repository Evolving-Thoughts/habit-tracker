#!/usr/bin/env bash
# Turns the raw ElevenLabs files (sounds-raw/*.mp3) into what the app plays
# (sounds/*.ogg): Opus, loudness evened out with a two-pass linear loudnorm,
# so no file is much louder than the next and loops keep their seam.
#
#   scripts/sounds/process.sh            all files in sounds-raw/
#   scripts/sounds/process.sh rain cafe  just these
#
# Music is trimmed of silence at both ends (the player cross-fades it);
# ambience loops are left whole, trimming would break the seamless loop;
# chimes lose only the silence before the first sound.
# Needs ffmpeg. Both folders are ignored by git (ElevenLabs' terms).
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
raw="$root/sounds-raw"
out="$root/sounds"
prompts="$root/scripts/sounds/prompts.json"
mkdir -p "$out"

kind_of() {
  node -e '
    const p = require(process.argv[1]).sounds[process.argv[2]];
    if (!p) process.exit(1);
    console.log(p.type === "music" ? "music" : p.loop ? "ambience" : "chime");
  ' "$prompts" "$1"
}

if [ "$#" -gt 0 ]; then ids=("$@"); else
  ids=()
  for f in "$raw"/*.mp3; do ids+=("$(basename "$f" .mp3)"); done
fi

for id in "${ids[@]}"; do
  src="$raw/$id.mp3"
  [ -f "$src" ] || { echo "$id: $src fehlt" >&2; exit 1; }
  kind="$(kind_of "$id")" || { echo "$id: nicht in prompts.json" >&2; exit 1; }
  case "$kind" in
    music)
      lufs=-20; bitrate=128k
      trim="silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse," ;;
    ambience)
      lufs=-23; bitrate=96k; trim="" ;;
    chime)
      lufs=-18; bitrate=96k
      trim="silenceremove=start_periods=1:start_threshold=-50dB," ;;
  esac
  target="I=$lufs:TP=-1.5:LRA=11"

  # Pass 1: measure. Pass 2: apply linearly with the measured values.
  stats="$(ffmpeg -hide_banner -nostats -i "$src" \
    -af "${trim}loudnorm=$target:print_format=json" -f null - 2>&1 |
    sed -n '/^{/,/^}/p')"
  get() { printf '%s' "$stats" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[process.argv[1]]))' "$1"; }
  measured="measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset)"

  ffmpeg -hide_banner -loglevel error -y -i "$src" \
    -af "${trim}loudnorm=$target:$measured:linear=true,aresample=48000" \
    -c:a libopus -b:a "$bitrate" -vbr on "$out/$id.ogg"
  printf '%-20s %-9s %s\n' "$id" "$kind" "$(du -h "$out/$id.ogg" | cut -f1)"
done
echo "Fertig: $out"
