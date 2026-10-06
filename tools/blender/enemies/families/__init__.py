"""One module per enemy family. Each exposes build(ctx) which fills ctx['parts'],
ctx['bones'], ctx['anchors'], ctx['height'], ctx['clips'] and ctx['variants'] (hide table)."""
from importlib import import_module

FAMILIES = ['slime', 'goblin', 'orc', 'ghost', 'ghoul', 'oni', 'lizard', 'construct', 'beast', 'fae', 'plant', 'dragon']


def get(family):
    return import_module(f'families.{family}')
