#!/usr/bin/env bash
# plan.sh — lee y publica plan.md SIEMPRE contra origin/main, sin tocar tu rama ni tu working tree.
# Trabaja en un worktree aparte (.worktrees/plan, ignorado por git). Lo usa la skill /plan-update.
#
#   scripts/plan.sh begin                      prepara el worktree e imprime la ruta del plan.md a editar
#   scripts/plan.sh publish <ws> "<mensaje>"   valida que solo tocaste tu sección, hace commit y push a main
#   scripts/plan.sh abort                      descarta la edición en curso
#   scripts/plan.sh show [ws]                  imprime el plan vigente (o solo la sección WS-<ws>)
#   scripts/plan.sh board                      tablero: fases + estado de los 6 workstreams
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "$ROOT" in */.worktrees/*) echo "✗ Corre este script desde el repo principal, no desde el worktree." >&2; exit 2 ;; esac
WT="$ROOT/.worktrees/plan"
REMOTE="${PLAN_REMOTE:-origin}"
BRANCH="${PLAN_BRANCH:-main}"
FILE="plan.md"

die()  { echo "✗ $*" >&2; exit 1; }
info() { echo "→ $*"; }

fetch() { git -C "$ROOT" fetch -q "$REMOTE" "$BRANCH" || die "No pude hacer fetch de $REMOTE/$BRANCH (¿sin red?)."; }

ensure_wt() {
  fetch
  if [ ! -e "$WT/.git" ]; then
    git -C "$ROOT" worktree prune
    mkdir -p "$ROOT/.worktrees"
    git -C "$ROOT" worktree add -q --detach "$WT" "$REMOTE/$BRANCH" || die "No pude crear el worktree en $WT."
  fi
}

wt_dirty() { [ -n "$(git -C "$WT" status --porcelain)" ]; }
wt_ahead() { [ "$(git -C "$WT" rev-list --count "$REMOTE/$BRANCH..HEAD")" -gt 0 ]; }

# stdin → stdout: el archivo SIN la sección "### WS-<ws> ..." (para comprobar que lo demás no cambió)
strip_section() {
  awk -v ws="$1" '
    /^### WS-[0-9]+ / { insec = (index($0, "### WS-" ws " ") == 1) }
    /^## /            { insec = 0 }
    !insec { print }'
}
# stdin → stdout: SOLO la sección "### WS-<ws> ..."
only_section() {
  awk -v ws="$1" '
    /^### WS-[0-9]+ / { insec = (index($0, "### WS-" ws " ") == 1) }
    /^## /            { insec = 0 }
    insec { print }'
}

valid_ws() { case "${1:-}" in [0-5]) return 0 ;; *) return 1 ;; esac; }

cmd_begin() {
  ensure_wt
  if wt_dirty || wt_ahead; then
    echo "⚠ Hay una edición anterior sin publicar. Termínala con 'publish' o descártala con 'abort'." >&2
  else
    git -C "$WT" checkout -q --detach "$REMOTE/$BRANCH"
  fi
  echo "$WT/$FILE"
}

cmd_abort() {
  [ -e "$WT/.git" ] || { info "No hay edición en curso."; return 0; }
  fetch
  git -C "$WT" reset -q --hard
  git -C "$WT" checkout -q --detach "$REMOTE/$BRANCH"
  info "Edición descartada."
}

cmd_publish() {
  local ws="${1:-}" msg="${2:-}" a b other n
  valid_ws "$ws" || die "Uso: scripts/plan.sh publish <ws 0-5> \"<mensaje>\""
  [ -n "$msg" ]  || die "Falta el mensaje. Ej.: scripts/plan.sh publish 3 \"S1 en progreso\""
  [ -e "$WT/.git" ] || die "Primero corre: scripts/plan.sh begin"

  if wt_dirty; then
    other="$(git -C "$WT" status --porcelain | grep -v " $FILE\$" || true)"
    [ -z "$other" ] || die "En el worktree del plan solo se edita $FILE. Sobran:
$other"
    if [ "$ws" != "0" ]; then
      a="$(mktemp)"; b="$(mktemp)"
      git -C "$WT" show "HEAD:$FILE" | strip_section "$ws" > "$a"
      strip_section "$ws" < "$WT/$FILE" > "$b"
      if ! diff -q "$a" "$b" >/dev/null; then
        echo "✗ Tocaste plan.md FUERA de la sección WS-$ws. Solo puedes editar tu sección (plan.md §0.2)." >&2
        echo "  Si necesitas algo de otro workstream: anótalo en TU Bitácora como 'SOLICITUD → WS-N: …'." >&2
        echo "  Líneas fuera de tu sección que cambiaste:" >&2
        diff "$a" "$b" | head -20 >&2 || true
        rm -f "$a" "$b"; exit 1
      fi
      rm -f "$a" "$b"
    fi
    git -C "$WT" add "$FILE"
    git -C "$WT" commit -q -m "plan(ws-$ws): $msg"
  elif ! wt_ahead; then
    die "No hay cambios que publicar. Edita $WT/$FILE (no el plan.md de tu rama)."
  fi

  n=0
  until git -C "$WT" push -q "$REMOTE" "HEAD:$BRANCH" 2>/dev/null; do
    n=$((n + 1)); [ "$n" -le 5 ] || die "No pude publicar tras 5 intentos (¿sin red o sin permiso de push?). Reintenta: scripts/plan.sh publish $ws \"$msg\""
    git -C "$WT" fetch -q "$REMOTE" "$BRANCH" || true
    if ! git -C "$WT" rebase -q "$REMOTE/$BRANCH" >/dev/null 2>&1; then
      git -C "$WT" rebase --abort >/dev/null 2>&1 || true
      git -C "$WT" format-patch -1 --stdout > "$ROOT/.worktrees/plan-rechazado.patch"
      git -C "$WT" checkout -q --detach "$REMOTE/$BRANCH"
      die "Conflicto: alguien cambió las mismas líneas de plan.md. Tu cambio quedó guardado en .worktrees/plan-rechazado.patch. Repite: begin → editar → publish."
    fi
  done

  info "Publicado en $REMOTE/$BRANCH: plan(ws-$ws): $msg"
  if [ "$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)" = "$BRANCH" ]; then
    git -C "$ROOT" pull -q --rebase --autostash "$REMOTE" "$BRANCH" 2>/dev/null \
      || echo "⚠ Publicado, pero no pude actualizar tu '$BRANCH' local. Corre: git pull --rebase" >&2
  fi
}

cmd_show() {
  fetch
  if [ -n "${1:-}" ]; then
    valid_ws "$1" || die "Uso: scripts/plan.sh show [ws 0-5]"
    git -C "$ROOT" show "$REMOTE/$BRANCH:$FILE" | only_section "$1"
  else
    git -C "$ROOT" show "$REMOTE/$BRANCH:$FILE"
  fi
}

cmd_board() {
  fetch
  echo "== Fases =="
  git -C "$ROOT" show "$REMOTE/$BRANCH:$FILE" | grep -E '^\| \*\*[0-4]\*\* \|' | awk -F'|' '{gsub(/^ +| +$/,"",$2); gsub(/^ +| +$/,"",$3); gsub(/^ +| +$/,"",$5); print "  Fase " $2 "  " $5 "  " $3}'
  echo "== Workstreams =="
  git -C "$ROOT" show "$REMOTE/$BRANCH:$FILE" | grep -E '^(### WS-|> \*\*Estado|> \*\*Trabajando)' | sed -e 's/^### /\n/' -e 's/^> /    /'
}

case "${1:-}" in
  begin)   shift; cmd_begin "$@" ;;
  publish) shift; cmd_publish "$@" ;;
  abort)   shift; cmd_abort "$@" ;;
  show)    shift; cmd_show "$@" ;;
  board)   shift; cmd_board "$@" ;;
  *) sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
