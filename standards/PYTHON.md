---
paths:
  - "**/*.py"
  - "pyproject.toml"
---

# Python

## PY-1. Build a list, dict or set with a comprehension, not with a loop that fills an outer variable; use a loop for side effects.

## PY-2. Annotate every module-level constant as `Final`, and give every module-level collection and every collection parameter a function only reads a read-only type, such as `tuple`, `frozenset`, `Sequence` or `Mapping`.

## PY-3. Write a class only for instance state together with the methods that change it, or for a record as a frozen dataclass.

## PY-4. Write a docstring only for what the name and the signature cannot say, never one that restates the parameters, the return value or their types.

## PY-5. Pass `sys.exit` only `0` or `2`, never a message: `sys.exit` with a message exits 1.

## PY-6. Run a Python program, its tests and its tools through `uv run`, add a dependency with `uv add`, and install nothing into the system interpreter.
