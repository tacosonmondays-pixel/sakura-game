#!/usr/bin/env python3
"""The gear set looks' rows (catalog.GEAR_SETS): checks and the spec tables. No Blender needed.

    python3 tools/blender/items/gear_sets.py --check       # validate every row, probe the guard, check the spec is in sync
    python3 tools/blender/items/gear_sets.py --write-doc   # rewrite the per-set section of docs/specs/GEAR_SET_LOOKS.md

The per-set section of the spec sits between <!-- sets:start --> and <!-- sets:end --> and is generated from the rows,
so the rows stay the one source. --check fails (exit 1) when a row is invalid, when catalog.gear_design accepts a
bad row (an unknown option name or value, a missing required option, a bad colour), when a launch set is not
preview=True (the sets ship with the gear update's src/data/gearSets.js), or when the spec section is out of date.
"""
import copy
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DOC = os.path.join(ROOT, 'docs', 'specs', 'GEAR_SET_LOOKS.md')
sys.path.insert(0, HERE)
import catalog  # noqa: E402

LAUNCH = ('spirit', 'freezetag', 'geometry', 'popper', 'treasurer', 'powerbank')
SLOTS = ('charm', 'ribbon', 'shoes', 'hair', 'necklace')
SLOT_NAMES = dict(charm='Charm', ribbon='Ribbon', shoes='Shoes', hair='Hair Clip', necklace='Necklace')
STORY = ('base', 'piece', 'hero', 'lore')


def section():
    out = []
    for s in LAUNCH:
        r = catalog.GEAR_SETS[s]
        out.append(f"### {r['name']} (`{s}`, {r['role']})\n")
        out.append(f"- **Motif:** {r['motif']}.")
        pal = ', '.join(f"{k} `{r[k]}`" for k in ('body', 'accent', 'light', 'glass') if k in r)
        out.append(f"- **Palette:** {pal}; trim `{r['trim']}`.")
        out.append(f"- **Material:** {r['material']}.")
        out.append(f"- **Silhouette:** {r['silhouette']}")
        out.append('')
        out.append('| Slot | Piece | Base and options | Hero detail | Lore |')
        out.append('|---|---|---|---|---|')
        for sl in SLOTS:
            row = r['slots'][sl]
            opts = ', '.join(f'{k} {v}' for k, v in row.items() if k not in STORY)
            out.append(f"| {SLOT_NAMES[sl]} | **{row['piece']}** | `{row['base']}`{': ' + opts if opts else ''} | "
                       f"{row['hero']} | {row['lore']} |")
        out.append('')
    return '\n'.join(out)


def _doc_parts():
    text = open(DOC, encoding='utf-8').read()
    head, rest = text.split('<!-- sets:start -->', 1)
    body, tail = rest.split('<!-- sets:end -->', 1)
    return head, body, tail


def write_doc():
    head, _, tail = _doc_parts()
    with open(DOC, 'w', encoding='utf-8', newline='\n') as f:
        f.write(head + '<!-- sets:start -->\n' + section() + '<!-- sets:end -->' + tail)


def _refused(mutate, slot, gear_set='spirit'):
    """True when gear_design refuses the row after `mutate(rows)`."""
    saved = catalog.GEAR_SETS
    catalog.GEAR_SETS = copy.deepcopy(saved)
    try:
        mutate(catalog.GEAR_SETS)
        catalog.gear_design(slot, gear_set)
        return False
    except ValueError:
        return True
    finally:
        catalog.GEAR_SETS = saved


PROBES = [
    ('a typo in an option name (knto)', 'ribbon', lambda g: g['spirit']['slots']['ribbon'].update(knto='grille')),
    ('a typo in an option name (soel)', 'shoes', lambda g: g['spirit']['slots']['shoes'].update(soel='glow')),
    ("another base's option (fob on a bow)", 'ribbon', lambda g: g['spirit']['slots']['ribbon'].update(fob='pompom')),
    ('an unknown value (toe)', 'shoes', lambda g: g['spirit']['slots']['shoes'].update(toe='nonsense')),
    ('an unknown value (knot)', 'ribbon', lambda g: g['spirit']['slots']['ribbon'].update(knot='bogus')),
    ('a bad colour', 'charm', lambda g: g['spirit']['slots']['charm'].update(body='not-a-colour')),
    ('a bad trim', 'charm', lambda g: g['spirit'].update(trim='plastic')),
    ('a missing fob', 'charm', lambda g: g['spirit']['slots']['charm'].pop('fob')),
    ('a missing ornament', 'hair', lambda g: g['spirit']['slots']['hair'].pop('ornament')),
    ('a missing locket', 'necklace', lambda g: g['spirit']['slots']['necklace'].pop('locket')),
    ('a bad stripe role', 'ribbon', lambda g: g['spirit']['slots']['ribbon'].update(stripe='pink')),
]


def check():
    errors = []
    for s, r in catalog.GEAR_SETS.items():
        for sl in catalog.GEAR_SLOT_ART:
            try:
                catalog.gear_design(sl, s)
            except ValueError as e:
                errors.append(str(e))
    for s in LAUNCH:
        r = catalog.GEAR_SETS.get(s)
        if not r:
            errors.append(f'launch set {s} has no row')
            continue
        if r.get('preview') is not True:
            errors.append(f'{s}: keep preview=True until src/data/gearSets.js ships the set')
        for sl in SLOTS:
            row = r['slots'].get(sl, {})
            missing = [k for k in STORY if not row.get(k)]
            if missing:
                errors.append(f'{s}/{sl}: missing {missing}')
    for what, slot, mutate in PROBES:
        if not _refused(mutate, slot):
            errors.append(f'gear_design accepts {what}')
    if not _refused(lambda g: None, 'charm'):
        pass
    else:
        errors.append('gear_design refuses the untouched spirit charm row')
    _, body, _ = _doc_parts()
    if body.strip() != section().strip():
        errors.append('docs/specs/GEAR_SET_LOOKS.md: the per-set section is out of date (run --write-doc)')
    for e in errors:
        print('[gear_sets] ' + e)
    print('[gear_sets] %s: %d sets, %d probes' % ('FAIL' if errors else 'ok', len(catalog.GEAR_SETS), len(PROBES)))
    return 1 if errors else 0


if __name__ == '__main__':
    if '--write-doc' in sys.argv:
        write_doc()
        print('[gear_sets] wrote ' + DOC)
    sys.exit(check() if '--check' in sys.argv else 0)
