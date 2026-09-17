---
name: deuda
description: Registra deuda técnica en Deuda_Tecnica.md. Úsala cada vez que tomes un atajo a propósito (valor hardcodeado, error sin manejar, test que falta, stub o mock que se queda, workaround, límite conocido, tema de seguridad) o cuando vayas a escribir un TODO, FIXME o HACK en el código. También para marcar una deuda como pagada o listar las abiertas.
argument-hint: "<ws 0-5> <alta|media|baja> <qué atajo tomaste>"
allowed-tools: Bash(scripts/deuda.sh:*), Read, Edit
---

# /deuda — que ningún atajo se quede en la cabeza de alguien

Argumentos: `$ARGUMENTS`

Reglas completas: `plan.md` §0.7. Los *no-objetivos* de `plan.md` §2 **no** son deuda: son alcance.

## Registrar

```bash
scripts/deuda.sh add <ws> <alta|media|baja> "<título corto>" "<dónde: archivo y función>" "<por qué se dejó>" "<riesgo>" "<cómo se paga>"
```

- Devuelve el ID (`DT-<ws>-NN`) y escribe la entrada en **la sección de tu workstream**.
- Severidad: **alta** 🔴 = puede romper el demo, perder datos o es de seguridad · **media** 🟡 = limita o molesta · **baja** 🟢 = limpieza.
- En el código, marca el lugar con ese ID: `// TODO(DT-3-02): …` o `# TODO(DT-4-01): …`. **Cero TODOs sin ID.**
- Haz commit de `Deuda_Tecnica.md` **en el mismo commit** que el código que crea la deuda, en tu rama. (No usa `/plan-update`: llega a `main` con tu `/ws-merge`.)
- Si es 🔴: además avisa a WS-0 ya, y déjalo en tu Bitácora con `/plan-update`.

Sé honesto y concreto: "por qué se dejó" casi siempre es tiempo, y "cómo se paga" debe poder entenderlo alguien que no estuvo hoy.

## Pagar, listar, revisar

```bash
scripts/deuda.sh pay DT-3-02            # la marca ✅ Pagada con el commit actual; nunca se borra la entrada
scripts/deuda.sh list                   # abiertas  (list red = solo 🔴 · list all = todas)
scripts/deuda.sh orphans                # TODO/FIXME/HACK sin ID: debe salir vacío antes de integrar
```
