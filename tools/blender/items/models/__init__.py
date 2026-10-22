"""Model registry: which family module builds which key.

A family module exposes build(row) -> dict(kind='flat'|'standing', roll=..., ...) and creates its
parts through parts.py (parts.ITEM collects them). `row` is one entry of dump_items.mjs.
"""
import importlib

SMALL_CUT = ('coins', 'gems', 'ticket_recruit', 'recruitPoints', 'token_bounty', 'token_boss', 'memento', 'moonpearl',
             'kindred_sr', 'evt_halloween_candy')

# Approved icons that are not game items: built only when named, into the scratch folder (never public/).
CALIBRATION = [dict(key='energy', kind='calibration', name='Energy (calibration only)', category='calibration',
                    rarity='rare', family='', tier='', display='', rainbow=False)]

TOOLS = ('dice_reroll', 'lock_pin', 'dice_prism', 'seed_rainbow', 'needle_star', 'club_band')
CURRENCY = ('coins', 'gems', 'recruitPoints', 'token_bounty', 'token_boss', 'memento', 'moonpearl')


def family(key):
    """Family group of a key (the --family names and the per-family sheets)."""
    if any(c['key'] == key for c in CALIBRATION):
        return 'calib'
    if key.startswith('book_'):
        return 'books'
    if key in CURRENCY or key.startswith('evt_'):
        return 'currency'
    if key.startswith('ticket_'):
        return 'tickets'
    if key.startswith('mat_'):
        return 'materials'
    if key.startswith('gearbox_'):
        return 'boxes'
    if key.startswith('crown_'):
        return 'crowns'
    if key == 'star_fragment' or key.startswith('kindred_'):
        return 'fragments'
    if key in TOOLS:
        return 'tools'
    if key.startswith('gear_'):
        return 'gear'
    return 'other'


def subfamily(key):
    """Materials split by family (mat_rime, mat_charm...), everything else = family()."""
    if key.startswith('mat_'):
        return 'mat_' + key.split('_')[1]
    return family(key)


def build(row):
    fam = family(row['key'])
    mod = importlib.import_module('models.' + fam)
    return mod.build(row)
