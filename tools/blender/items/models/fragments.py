"""Awakening fragments: Star Fragment and the Kindred Essence drops (one teardrop model, recoloured by
tier; colour and the tile carry the tier, so the old R / SR / SSR text labels are gone)."""
import math

import parts as P
import palette as C
from models import common as K

FACETS = dict(steps=(0.45, 0.86, 0.02), deep_at=0.0)


def star_crystal(R, at, paint, rot=0.0, points=5, inner=0.5, depth=0.32, rise=0.42, line=2.6):
    pts = P.star2(points, R, R * inner, a0=90)
    rid = []
    for i in range(points):
        a = math.radians(90 + 360 * i / points)
        rid.append((R * 0.55 * math.cos(a), R * 0.55 * math.sin(a), R * rise * 0.7))
    g = P.fan_gem(P.poly_round(pts, R * 0.05, 2), depth * R, rise * R, ridges=rid, name='starc')
    P.xf(g, rot=(0, rot, 0), loc=at)
    q = dict(paint)
    for k, v in FACETS.items():
        q.setdefault(k, v)
    return P.paint(g, q, line=line)


def star_fragment():
    pastel = C.paint('#ffd0ea', light='#fff0f8', shadow='#d9a2f5', ink='#5a2a8a', deep='#b98af2', iri=0.15)
    star_crystal(1.0, (0, 0, 0), pastel, rot=-8)
    spl = P.fan_gem([(-0.12, -0.2), (0.14, -0.16), (0.18, 0.2), (0.0, 0.3), (-0.16, 0.12)], 0.12, 0.12, name='splinter')
    P.xf(spl, rot=(0, -30, 0), loc=(0.88, 0.1, -0.72))
    P.paint(spl, dict(pastel, **FACETS), line=2.0)
    P.glint((-0.25, -0.5, 0.55), 12)
    return dict(kind='flat', roll=-6.0, turn=18.0, tip=18.0)


def teardrop(body, cap_p, gem_p=None, star=False, blossom_p=None):
    prof = [(0.0, -0.95)]
    for i in range(1, 12):
        a = -math.pi / 2 + math.pi * 0.62 * i / 11
        prof.append((0.62 * math.cos(a), -0.38 + 0.6 * math.sin(a)))
    prof += [(0.3, 0.5), (0.16, 0.66)]
    prof.append((0.0, 0.7))
    t = P.lathe(prof, segs=10, name='tear', smooth=False, a0=math.pi / 10)
    q = dict(body)
    for k, v in FACETS.items():
        q.setdefault(k, v)
    P.paint(t, q, line=2.6)
    K.blossom(0.24, 0.04, (0.0, -0.63, -0.3),blossom_p or C.paint('#ffffff', light='#ffffff', shadow='#e6eef8', ink=body['ink']),
              line=1.1, pearl=C.paint('#fff1c7', light='#ffffff', shadow='#f4cf7a', ink='#7d4705'), pearl_r=0.25)
    cap = P.lathe([(0.0, 0.5), (0.3, 0.52, 'S'), (0.32, 0.62), (0.26, 0.74), (0.0, 0.82)], segs=32, name='cap')
    P.paint(cap, cap_p, line=2.0)
    ring = P.torus(0.1, 0.035, 24, 8, 'loop')
    P.xf(ring, rot=(90, 0, 0), loc=(0, 0, 0.92))
    P.paint(ring, cap_p, line=1.6)
    if gem_p:
        g = P.cabochon(0.08, 0.05)
        P.xf(g, rot=(90, 0, 0), loc=(0, -0.3, 0.64))
        P.paint(g, gem_p, line=1.0)
    if star:
        P.glint((0.0, -0.7, -0.3), 14)
    P.glint((-0.3, -0.5, 0.2), 9)
    return dict(kind='flat', roll=-14.0, turn=14.0, tip=10.0)


def kindred_shard():
    gold = C.paint('#ffe08a', light='#fff4cc', shadow='#f0b84a', ink='#6e3b08', deep='#e09a2a', iri=0.3)
    pts = [(-0.3, -0.9), (0.25, -0.75), (0.42, 0.1), (0.12, 0.95), (-0.22, 0.55), (-0.42, -0.1)]
    g = P.fan_gem(pts, 0.3, 0.35, ridges=[(0.0, 0.3, 0.3), (0.0, -0.4, 0.3)], name='kshard')
    P.paint(g, dict(gold, **FACETS), line=2.6)
    spl = P.fan_gem([(-0.1, -0.18), (0.12, -0.15), (0.14, 0.2), (-0.12, 0.16)], 0.12, 0.1, name='splinter')
    P.xf(spl, rot=(0, -20, 0), loc=(0.62, 0.1, -0.55))
    P.paint(spl, dict(gold, **FACETS), line=2.0)
    P.glint((-0.1, -0.5, 0.6), 11)
    return dict(kind='flat', roll=-18.0, turn=18.0, tip=16.0)


def build(row):
    k = row['key']
    if k == 'star_fragment':
        return star_fragment()
    if k == 'kindred_r':
        return teardrop(C.paint('#9be7ff', light='#dbf7ff', shadow='#5cbfee', ink='#1b4f7a', deep='#3f9ed8'), C.SILVER)
    if k == 'kindred_sr':
        return teardrop(C.paint('#d7b4ff', light='#f1e4ff', shadow='#ab80f2', ink='#4a2a8a', deep='#8d5fe4'), C.SILVER,
                        gem_p=C.TIER_GEM['superRare'])
    if k == 'kindred_ssr':
        return teardrop(C.paint('#ffe08a', light='#fff6d0', shadow='#f2b54a', ink='#6e3b08', deep='#de9a2c', iri=0.25), C.GOLD_TRIM,
                        gem_p=C.TIER_GEM['legendary'], star=True)
    if k == 'kindred_shard_ssr':
        return kindred_shard()
    raise KeyError(k)
