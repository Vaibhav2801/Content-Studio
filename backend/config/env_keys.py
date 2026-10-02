"""Helpers for loading ordered API-key rings from environment variables."""

from __future__ import annotations

import os
import re
from collections.abc import Mapping


def env_value_ring(
    primary_name: str,
    list_name: str,
    *,
    environ: Mapping[str, str] | None = None,
) -> tuple[str, ...]:
    """Return unique values from legacy, list, and numbered environment names.

    For example, ``GEMINI_API_KEY``, ``GEMINI_API_KEYS`` and numbered variables
    such as ``GEMINI_API_KEY_1`` can be used together. The legacy value is
    always attempted first, list values keep their declared order, and numbered
    values are ordered numerically.
    """

    source = os.environ if environ is None else environ
    values: list[str] = []

    def add(raw: str | None) -> None:
        for value in re.split(r"[,;\r\n]+", raw or ""):
            cleaned = value.strip()
            if cleaned and cleaned not in values:
                values.append(cleaned)

    add(source.get(primary_name))
    add(source.get(list_name))

    numbered: list[tuple[int, str]] = []
    pattern = re.compile(rf"^{re.escape(primary_name)}_(\d+)$")
    for name, raw_value in source.items():
        match = pattern.match(name)
        if match and raw_value.strip():
            numbered.append((int(match.group(1)), raw_value))
    for _, raw_value in sorted(numbered):
        add(raw_value)

    return tuple(values)
