#!/usr/bin/env bash
# deuda.sh — registra y consulta deuda técnica en Deuda_Tecnica.md (en TU rama). Lo usa la skill /deuda.
#
#   scripts/deuda.sh next <ws>                         siguiente ID libre (DT-<ws>-NN)
#   scripts/deuda.sh add <ws> <alta|media|baja> "<título>" "<dónde>" "<por qué se dejó>" "<riesgo>" "<cómo se paga>"
#   scripts/deuda.sh pay <ID> [commit]                 marca una deuda como pagada (no la borra)
#   scripts/deuda.sh list [open|red|all]               lista (por defecto: abiertas)
#   scripts/deuda.sh orphans                           TODO/FIXME/HACK sin ID de deuda (debe salir vacío)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FILE="$ROOT/Deuda_Tecnica.md"
die() { echo "✗ $*" >&2; exit 1; }
[ -f "$FILE" ] || die "No encuentro $FILE"
valid_ws() { case "${1:-}" in [0-5]) return 0 ;; *) return 1 ;; esac; }

next_id() {
  local ws="$1" max
  max="$(grep -oE "^- \*\*DT-$ws-[0-9]+" "$FILE" | sed -E "s/.*DT-$ws-0*([0-9]+)$/\1/" | sort -n | tail -1 || true)"
  printf 'DT-%s-%02d\n' "$ws" "$(( ${max:-0} + 1 ))"
}

cmd_add() {
  local ws="${1:-}" sev="${2:-}" title="${3:-}" where="${4:-}" why="${5:-}" risk="${6:-}" fix="${7:-}" label id entry out
  valid_ws "$ws" || die "Uso: scripts/deuda.sh add <ws 0-5> <alta|media|baja> \"<título>\" \"<dónde>\" \"<por qué>\" \"<riesgo>\" \"<cómo se paga>\""
  case "$sev" in
    alta)  label="🔴 Alta" ;; media) label="🟡 Media" ;; baja) label="🟢 Baja" ;;
    *) die "Severidad inválida: '$sev'. Usa alta | media | baja." ;;
  esac
  [ -n "$title" ] && [ -n "$where" ] && [ -n "$why" ] && [ -n "$risk" ] && [ -n "$fix" ] \
    || die "Faltan campos: título, dónde, por qué se dejó, riesgo y cómo se paga son obligatorios."
  grep -q "^## WS-$ws " "$FILE" || die "No existe la sección '## WS-$ws' en Deuda_Tecnica.md"

  id="$(next_id "$ws")"
  entry="$(mktemp)"; out="$(mktemp)"
  {
    echo "- **$id** · $label · ⬜ Abierta — $title"
    echo "  - **Dónde:** $where"
    echo "  - **Por qué se dejó:** $why"
    echo "  - **Riesgo:** $risk"
    echo "  - **Cómo se paga:** $fix"
  } > "$entry"

  # Inserta al final de la sección del workstream (o en lugar del marcador "sin deuda registrada").
  awk -v ws="$ws" -v entry="$entry" '
    function emit(   l) { while ((getline l < entry) > 0) print l; close(entry) }
    NR == FNR {
      if ($0 ~ /^## /) { insec = (index($0, "## WS-" ws " ") == 1) }
      if (insec) {
        if ($0 ~ /^- _\(sin deuda registrada\)_/) placeholder = FNR
        else if ($0 !~ /^[[:space:]]*$/ && $0 !~ /^---[[:space:]]*$/) last = FNR
      }
      next
    }
    placeholder && FNR == placeholder { emit(); next }
    { print }
    !placeholder && FNR == last { emit() }
  ' "$FILE" "$FILE" > "$out"
  cat "$out" > "$FILE"; rm -f "$entry" "$out"

  echo "$id"
  echo "→ Registrada. Marca el código con:  TODO($id): $title" >&2
  [ "$sev" = "alta" ] && echo "⚠ Es 🔴: avisa a WS-0 ahora (y déjalo en tu Bitácora con /plan-update)." >&2
  return 0
}

cmd_pay() {
  local id="${1:-}" commit="${2:-}" out
  echo "$id" | grep -Eq '^DT-[0-5]-[0-9]+$' || die "Uso: scripts/deuda.sh pay <DT-N-NN> [commit]"
  grep -q "^- \*\*$id\*\* .*⬜ Abierta" "$FILE" || die "$id no existe o no está abierta."
  [ -n "$commit" ] || commit="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo '?')"
  out="$(mktemp)"
  awk -v id="$id" -v c="$commit" '
    index($0, "- **" id "** ") == 1 { sub(/⬜ Abierta/, "✅ Pagada (" c ")") }
    { print }' "$FILE" > "$out"
  cat "$out" > "$FILE"; rm -f "$out"
  echo "→ $id marcada como pagada ($commit)."
}

cmd_list() {
  case "${1:-open}" in
    open) grep -nE '^- \*\*DT-[0-9].*⬜' "$FILE" || echo "(sin deuda abierta)" ;;
    red)  grep -nE '^- \*\*DT-[0-9].*🔴.*⬜' "$FILE" || echo "(sin deuda 🔴 abierta)" ;;
    all)  grep -nE '^- \*\*DT-[0-9]' "$FILE" || echo "(sin deuda)" ;;
    *) die "Uso: scripts/deuda.sh list [open|red|all]" ;;
  esac
}

cmd_orphans() {
  local dirs="" d found
  for d in frontend/src backend/app; do [ -d "$ROOT/$d" ] && dirs="$dirs $d"; done
  [ -n "$dirs" ] || { echo "(todavía no hay código que revisar)"; return 0; }
  # shellcheck disable=SC2086
  found="$(cd "$ROOT" && grep -rnE '\b(TODO|FIXME|HACK)\b' $dirs 2>/dev/null | grep -vE 'DT-[0-5]-[0-9]+' || true)"
  if [ -n "$found" ]; then
    echo "✗ TODOs huérfanos (sin ID de deuda). Regístralos con /deuda o bórralos:" >&2
    echo "$found"; return 1
  fi
  echo "(sin TODOs huérfanos)"
}

case "${1:-}" in
  next)    shift; valid_ws "${1:-}" || die "Uso: scripts/deuda.sh next <ws 0-5>"; next_id "$1" ;;
  add)     shift; cmd_add "$@" ;;
  pay)     shift; cmd_pay "$@" ;;
  list)    shift; cmd_list "$@" ;;
  orphans) shift; cmd_orphans "$@" ;;
  *) sed -n '2,8p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
