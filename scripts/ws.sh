#!/usr/bin/env bash
# ws.sh — ciclo de vida de tu workstream. Lo usan las skills /ws-start y /ws-merge.
#
#   scripts/ws.sh start <ws>    crea o retoma tu rama desde origin/main (solo si M0 ya está) e imprime tu sección
#   scripts/ws.sh check <ws>    verifica que tu rama solo toca TUS archivos (plan.md §4.3)
#   scripts/ws.sh merge <ws>    trae main a tu rama, corre las verificaciones y publica a main en fast-forward
#
#   Emergencias (anótalas como deuda):  SKIP_CHECKS=1  salta typecheck/tests · ALLOW_OUTSIDE=1  permite tocar archivos ajenos
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "$ROOT" in */.worktrees/*) echo "✗ Corre este script desde el repo principal, no desde el worktree." >&2; exit 2 ;; esac
cd "$ROOT"
REMOTE="${PLAN_REMOTE:-origin}"
MAIN="${PLAN_BRANCH:-main}"

die()  { echo "✗ $*" >&2; exit 1; }
info() { echo "→ $*"; }

branch_of() {
  case "$1" in
    0) echo "ws/0-plataforma" ;; 1) echo "ws/1-dashboard" ;; 2) echo "ws/2-lab" ;;
    3) echo "ws/3-motion" ;;     4) echo "ws/4-estado" ;;    5) echo "ws/5-agente" ;;
    *) die "Workstream inválido: '$1'. Usa 0-5 (0 José Luis · 1 Daniela · 2 Elías · 3 Sebas · 4 Fernando · 5 Adrián)." ;;
  esac
}

# Rutas propias de cada workstream (plan.md §4.3). WS-0 no tiene restricción.
owned_re() {
  case "$1" in
    1) echo '^frontend/(src/dashboard/|public/samples/)' ;;
    2) echo '^frontend/src/lab/' ;;
    3) echo '^frontend/src/motion/' ;;
    4) echo '^(backend/app/bus/|backend/tests/test_bus_|frontend/src/status/)' ;;
    5) echo '^(backend/app/agent/|backend/tests/test_agent_)' ;;
  esac
}
# Archivos compartidos que cualquiera puede tocar (dependencias y su sección de deuda).
COMMON_RE='^(Deuda_Tecnica\.md|frontend/package\.json|frontend/package-lock\.json|backend/pyproject\.toml|backend/uv\.lock)$'

m0_ready() {
  git cat-file -e "$REMOTE/$MAIN:frontend/package.json" 2>/dev/null \
    && git cat-file -e "$REMOTE/$MAIN:backend/pyproject.toml" 2>/dev/null
}

strip_debt_section() {
  awk -v ws="$1" '
    /^## / { insec = (index($0, "## WS-" ws " ") == 1) }
    !insec { print }'
}

cmd_start() {
  local ws="${1:-}" br
  br="$(branch_of "$ws")"
  git fetch -q "$REMOTE" || die "No pude hacer fetch (¿sin red?)."
  if [ "$ws" != "0" ] && ! m0_ready; then
    echo "⏳ M0 todavía no está en $MAIN (falta el esqueleto de WS-0). NO abras rama todavía."
    echo "   Trabaja el bloque \"Mientras esperas M0\" de tu sección. Vuelve a correr esto cuando WS-0 avise."
    echo
    "$ROOT/scripts/plan.sh" show "$ws"
    return 0
  fi
  if [ "$(git rev-parse --abbrev-ref HEAD)" = "$br" ]; then
    info "Ya estás en $br."
  elif git show-ref -q --verify "refs/heads/$br"; then
    git checkout -q "$br" || die "No pude cambiar a $br (¿cambios sin commitear que chocan?)."
    info "Retomando rama local $br."
  elif git show-ref -q --verify "refs/remotes/$REMOTE/$br"; then
    git checkout -q -b "$br" --track "$REMOTE/$br" || die "No pude crear $br desde $REMOTE/$br."
    info "Retomando rama remota $br."
  else
    git checkout -q -b "$br" --no-track "$REMOTE/$MAIN" || die "No pude crear $br desde $REMOTE/$MAIN."
    git push -q -u "$REMOTE" "$br" || echo "⚠ Rama creada en local, pero no pude subirla todavía." >&2
    info "Rama nueva $br creada desde $REMOTE/$MAIN."
  fi
  echo
  "$ROOT/scripts/plan.sh" show "$ws"
}

cmd_check() {
  local ws="${1:-}" re files bad="" f a b
  branch_of "$ws" >/dev/null
  git fetch -q "$REMOTE" "$MAIN" || die "No pude hacer fetch."
  [ "$ws" = "0" ] && { info "WS-0: sin restricción de archivos."; return 0; }
  re="$(owned_re "$ws")"
  files="$(git diff --name-only "$REMOTE/$MAIN...HEAD")"
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    if [ "$f" = "plan.md" ]; then
      bad="$bad
  plan.md  ← nunca se edita en tu rama: usa /plan-update (scripts/plan.sh)"
    elif echo "$f" | grep -Eq "$re" || echo "$f" | grep -Eq "$COMMON_RE"; then
      :
    else
      bad="$bad
  $f"
    fi
  done <<EOF_FILES
$files
EOF_FILES

  if echo "$files" | grep -qx 'Deuda_Tecnica.md'; then
    a="$(mktemp)"; b="$(mktemp)"
    git show "$(git merge-base "$REMOTE/$MAIN" HEAD):Deuda_Tecnica.md" 2>/dev/null | strip_debt_section "$ws" > "$a" || true
    git show "HEAD:Deuda_Tecnica.md" | strip_debt_section "$ws" > "$b"
    if ! diff -q "$a" "$b" >/dev/null; then
      bad="$bad
  Deuda_Tecnica.md  ← tocaste una sección que no es la de WS-$ws"
    fi
    rm -f "$a" "$b"
  fi

  if [ -n "$bad" ]; then
    echo "✗ Tu rama toca archivos que no son de WS-$ws (plan.md §4.3):$bad" >&2
    if [ "${ALLOW_OUTSIDE:-0}" = "1" ]; then
      echo "⚠ ALLOW_OUTSIDE=1: se permite. Avisa al dueño y regístralo con /deuda." >&2
      return 0
    fi
    echo "  Si de verdad hace falta: acuérdalo con el dueño y repite con ALLOW_OUTSIDE=1." >&2
    return 1
  fi
  info "Propiedad de archivos OK (WS-$ws)."
}

run_checks() {
  if [ "${SKIP_CHECKS:-0}" = "1" ]; then echo "⚠ SKIP_CHECKS=1: sin typecheck ni tests. Regístralo con /deuda." >&2; return 0; fi
  if [ -f frontend/package.json ]; then
    info "Frontend: typecheck…"
    ( cd frontend && { [ -d node_modules ] || npm install --silent; } && npm run --silent typecheck ) \
      || die "El typecheck del frontend falla. Arréglalo antes de integrar."
  fi
  if [ -f backend/pyproject.toml ]; then
    info "Backend: pytest…"
    local rc=0
    ( cd backend && uv run --quiet pytest -q ) || rc=$?
    # 5 = pytest no encontró tests: todavía no es un error
    [ "$rc" = "0" ] || [ "$rc" = "5" ] || die "Los tests del backend fallan. Arréglalos antes de integrar."
  fi
}

cmd_merge() {
  local ws="${1:-}" br n=0
  br="$(branch_of "$ws")"
  [ "$(git rev-parse --abbrev-ref HEAD)" = "$br" ] || die "Debes estar en tu rama $br (estás en $(git rev-parse --abbrev-ref HEAD))."
  [ -z "$(git status --porcelain)" ] || die "Tienes cambios sin commitear. Haz commit (o stash) y repite."
  while :; do
    n=$((n + 1)); [ "$n" -le 3 ] || die "main se movió 3 veces seguidas mientras integrabas. Espera un minuto y repite."
    git fetch -q "$REMOTE" "$MAIN" || die "No pude hacer fetch."
    if ! git merge -q --no-edit "$REMOTE/$MAIN"; then
      die "Conflicto al traer $MAIN a tu rama. Resuélvelo (solo en TUS archivos), haz commit y repite: scripts/ws.sh merge $ws"
    fi
    run_checks
    cmd_check "$ws" || exit 1
    git push -q "$REMOTE" "HEAD:refs/heads/$br" || die "No pude subir tu rama."
    if git push -q "$REMOTE" "HEAD:$MAIN" 2>/dev/null; then break; fi
    info "main se movió mientras verificabas; reintentando ($n/3)…"
  done
  info "Integrado en $REMOTE/$MAIN: $(git rev-parse --short HEAD)"
  echo "   Siguiente paso: /plan-update para marcar tus tareas como ✅ Hecho."
}

case "${1:-}" in
  start) shift; cmd_start "$@" ;;
  check) shift; cmd_check "$@" ;;
  merge) shift; cmd_merge "$@" ;;
  *) sed -n '2,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
