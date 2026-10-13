"""Palettes: instrument roles → (soundfont, bank, program, gain, pan, echo send).

Songs only name roles. `--palette toby` re-renders every song by swapping only the palette JSON.
A palette may `inherit` another; roles it does not define (or whose soundfont is missing) fall back to
the parent, with a warning in the render report.

Soundfont entries: {"path": "...", "fallback": "...", "fetch": "generaluser", "build": "make_chip_sf2.py"}
Paths may use ${SAKURA_PRIVATE_SF2} / ${CACHE} / ${TOOLS}; relative paths are relative to tools/audio/.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

from .fx import validate_fx, FxError
from .paths import TOOLS, CACHE, PALETTES, PRIVATE

ROLE_FIELDS = {'sf', 'bank', 'program', 'gain_db', 'pan', 'echo', 'transpose', 'vel_curve', 'kit_map', 'alias',
               'note', 'gm_preview', 'fx'}


class PaletteError(ValueError):
    pass


def _expand(path: str) -> Path:
    env = {'SAKURA_PRIVATE_SF2': str(PRIVATE), 'CACHE': str(CACHE), 'TOOLS': str(TOOLS)}
    s = re.sub(r'\$\{(\w+)\}', lambda m: os.environ.get(m.group(1)) or env.get(m.group(1), ''), path)
    p = Path(s)
    return p if p.is_absolute() else (TOOLS / p)


class Palette:
    def __init__(self, data: dict, parent: 'Palette | None' = None, source: Path | None = None):
        self.data = data
        self.id = data['id']
        self.parent = parent
        self.source = source
        self.warnings: list[str] = []
        self._fonts: dict[str, Path | None] = {}
        for k, role in (data.get('roles') or {}).items():
            unknown = set(role) - ROLE_FIELDS
            if unknown:
                raise PaletteError(f'palette {self.id}: role {k} has unknown fields {sorted(unknown)}')
            try:
                validate_fx(role.get('fx'), f'palette {self.id}: role {k}: ')
            except FxError as e:
                raise PaletteError(str(e)) from None

    # ---- soundfonts ------------------------------------------------------------------------------
    def soundfont(self, key: str) -> Path | None:
        """Resolved path of soundfont `key`, or None when neither it nor its fallback exists."""
        if key in self._fonts:
            return self._fonts[key]
        spec = (self.data.get('soundfonts') or {}).get(key)
        if spec is None:
            if self.parent:
                return self.parent.soundfont(key)
            raise PaletteError(f'palette {self.id}: unknown soundfont {key!r}')
        found = None
        p = _expand(spec['path'])
        if p.exists():
            found = p
        elif spec.get('fallback') and _expand(spec['fallback']).exists():
            found = _expand(spec['fallback'])
            self.warnings.append(f'soundfont {key}: {p} missing, using fallback {found.name}'
                                 + (f' (run: studio.py fetch)' if spec.get('fetch') else ''))
        else:
            self.warnings.append(f'soundfont {key}: {p} missing')
        self._fonts[key] = found
        return found

    def soundfont_label(self, key: str) -> str:
        p = self.soundfont(key)
        return p.name if p else 'missing'

    # ---- roles -----------------------------------------------------------------------------------
    def role_names(self) -> list:
        names = set((self.data.get('roles') or {}).keys())
        if self.parent:
            names |= set(self.parent.role_names())
        return sorted(names)

    def has_role(self, role: str) -> bool:
        return role in (self.data.get('roles') or {}) or (self.parent is not None and self.parent.has_role(role))

    def _find(self, role: str):
        """(palette that defines `role`, its raw dict) walking up the inheritance chain."""
        p = self
        while p is not None:
            roles = p.data.get('roles') or {}
            if role in roles:
                return p, dict(roles[role])
            p = p.parent
        raise PaletteError(f'unknown role {role!r} (palette {self.id}; known: {", ".join(self.role_names())})')

    def resolve(self, role: str, _depth=0) -> dict:
        """Role → concrete preset dict with 'sf_path' and 'palette' (which palette supplied it).

        Soundfont keys resolve from this palette upwards, so a child can swap a parent's soundfont
        (strict = cleared's roles on FluidR3). A role whose soundfont is missing falls back to the
        parent palette's definition of the same role (toby without the private fonts = cleared)."""
        if _depth > 8:
            raise PaletteError(f'alias loop at role {role}')
        owner, r = self._find(role)
        if 'alias' in r:
            base = self.resolve(r.pop('alias'), _depth + 1)
            base.update(r)
            base['role'] = role
            return base
        sf_path = self.soundfont(r['sf'])
        if sf_path is None:
            if owner.parent is not None and owner.parent.has_role(role):
                self.warnings.append(f'role {role}: soundfont {r["sf"]} missing, falling back to {owner.parent.id}')
                return owner.parent.resolve(role, _depth + 1)
            raise PaletteError(f'palette {self.id}: role {role} needs soundfont {r["sf"]}, which is missing')
        if owner is not self and self.data.get('roles') and not self.data.get('quiet_inherit'):
            self.warnings.append(f'role {role}: not mapped in {self.id}, using {owner.id}')
        r.setdefault('bank', 0)
        r.setdefault('gain_db', 0.0)
        r.setdefault('pan', 0.0)
        r.setdefault('echo', 0.0)
        r.setdefault('transpose', 0)
        r['sf_key'] = r['sf']
        r['sf_path'] = sf_path
        r['palette'] = owner.id
        r['role'] = role
        return r

    @property
    def render(self) -> dict:
        base = dict(self.parent.render) if self.parent else {}
        base.update(self.data.get('render') or {})
        base.setdefault('rate', 32000)
        base.setdefault('interp', 4)
        base.setdefault('polyphony', 256)
        base.setdefault('gain', 0.4)
        return base

    @property
    def mix(self) -> dict:
        base = json.loads(json.dumps(self.parent.mix)) if self.parent else {}
        for k, v in (self.data.get('mix') or {}).items():
            if isinstance(v, dict) and isinstance(base.get(k), dict):
                base[k] = {**base[k], **v}
            else:
                base[k] = v
        return base

    def unique_warnings(self) -> list:
        out = []
        for p in (self, self.parent) if self.parent else (self,):
            for w in p.warnings:
                if w not in out:
                    out.append(w)
        return out


def load_palette(name_or_path: str) -> Palette:
    p = Path(name_or_path)
    if not p.suffix:
        p = PALETTES / f'{name_or_path}.json'
    if not p.exists():
        raise PaletteError(f'palette not found: {p}')
    data = json.loads(p.read_text())
    parent = load_palette(data['inherit']) if data.get('inherit') else None
    return Palette(data, parent, p)
