#!/usr/bin/env sh
# Creates the audio toolkit venv (default tools/audio/.venv, gitignored; override with AUDIO_VENV) and
# installs the pinned requirements, then fetches the soundfonts into tools/audio/cache/.
#   sh tools/audio/setup_venv.sh            then   "$AUDIO_VENV/bin/python" tools/audio/studio.py list
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
VENV="${AUDIO_VENV:-$HERE/.venv}"
python3 -m venv "$VENV"
"$VENV/bin/pip" install --quiet -r "$HERE/requirements.txt"
"$VENV/bin/python" "$HERE/studio.py" fetch
for tool in ffmpeg fluidsynth; do
  command -v "$tool" >/dev/null 2>&1 || echo "missing system tool: $tool (apt install $tool)"
done
echo "audio toolkit ready: $VENV/bin/python $HERE/studio.py list"
