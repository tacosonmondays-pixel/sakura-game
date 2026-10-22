"""Gear boxes (gearbox_*): one rounded chest, lid a little open with cream cloth peeking out, two
straps, a gear emblem on the front. Standing pose: lid top lightest, front mid, right side darkest."""
import parts as P
import palette as C

BODY = dict(
    common=C.paint('#d9cdbd', light='#ece3d6', shadow='#b5a48f', ink='#4a3d30'),
    rare=C.paint('#7db6f3', light='#a6cdfa', shadow='#5589d8', ink='#0d336f'),
    superRare=C.paint('#b39afd', light='#cab7fd', shadow='#896be7', ink='#26136e'),
    mythic=C.paint('#fc6d95', light='#fda7bc', shadow='#d63e71', ink='#651233'),                    # (appr.)
    legendary=C.paint('#77dae4', light='#a5ebf0', shadow='#3fb0c4', ink='#013749'),
    rainbow=dict(C.PEARL, iri=0.55),
)
STRAP = dict(
    common=C.paint('#b88a5a', light='#d4a87a', shadow='#93663c', ink='#4a2e14', rim=0.3),
    rare=C.SILVER, superRare=C.SILVER, mythic=C.ROSE_GOLD, legendary=C.GOLD_TRIM, rainbow=C.IRI,
)
GEM = dict(common=None, rare=C.TIER_GEM['rare'], superRare=C.TIER_GEM['superRare'],
           mythic=C.paint('#fbb6cf', light='#fde3ee', shadow='#f07aa5', ink='#781948', spec=0.8, spec_at=0.985),
           legendary=C.TIER_GEM['legendary'], rainbow=dict(C.IRI, glow=0.4))
CLOTH = C.paint('#f9eedb', light='#fff9ee', shadow='#e6d0ac', ink='#7a5a3a', rim=0.0)

BW, BD, BH = 1.2, 1.04, 0.74
LW, LD, LH = 1.26, 1.1, 0.3


def _drape(w, z, sag, y, paint):
    """Cream cloth spilling over the front top edge: a soft band whose lower edge smiles."""
    n = 24
    top = [(-w / 2 + w * i / n, z + 0.05) for i in range(n + 1)]
    bot = []
    for i in range(n, -1, -1):
        x = -w / 2 + w * i / n
        u = (x / (w / 2))
        bot.append((x, z - sag * (1 - u * u) - 0.02 * (1 - abs(u))))
    o = P.slab(P.poly_round(top + bot, 0.03, 2), 0.05, 0.02, 2, 'drape')
    P.xf(o, loc=(0, y, 0))
    return P.paint(o, paint, line=1.5)


def build(row):
    tier = 'rainbow' if row.get('rainbow') else row['rarity']
    body_p, strap_p, gem_p = BODY[tier], STRAP[tier], GEM[tier]
    opened = tier != 'common'
    body = P.rbox(BW, BD, BH, r=0.1, seg=4, name='body')
    P.xf(body, loc=(0, 0, BH / 2))
    P.paint(body, body_p, line=2.6)
    lid = P.rbox(LW, LD, LH, r=0.11, seg=4, name='lid')
    P.xf(lid, loc=(0, -LD / 2 + 0.02, LH / 2))       # hinge at the lid's back bottom edge
    lid_parts = [lid]
    P.paint(lid, C.over(body_p, sheen=0.25, sheen_at=-0.46), line=2.6)
    for sx in (-0.34, 0.34):
        s = P.rbox(0.14, LD + 0.03, LH + 0.03, r=0.04, seg=3, name='lstrap')
        P.xf(s, loc=(sx, -LD / 2 + 0.02, LH / 2))
        lid_parts.append(P.paint(s, strap_p, line=1.8))
        s2 = P.rbox(0.14, BD + 0.03, BH - 0.02, r=0.04, seg=3, name='bstrap')
        P.xf(s2, loc=(sx, 0, BH / 2 - 0.01))
        P.paint(s2, strap_p, line=1.8)
    latch = P.rbox(0.17, 0.06, 0.13, r=0.025, seg=2, name='latch')
    P.xf(latch, loc=(0, -LD + 0.0, 0.07))
    lid_parts.append(P.paint(latch, strap_p, line=1.6))
    ang = -13 if opened else 0
    for o in lid_parts:
        P.xf(o, rot=(ang, 0, 0), loc=(0, BD / 2 - 0.02, BH - 0.01))
    if opened:
        cloth = P.rbox(BW - 0.1, BD - 0.08, 0.3, r=0.12, seg=4, name='cloth')
        P.xf(cloth, loc=(0, 0.0, BH + 0.0))
        P.paint(cloth, CLOTH, line=1.6)
        _drape(BW - 0.2, BH + 0.1, 0.1, -BD / 2 - 0.035, CLOTH)
    # gear emblem on the front
    ez = BH * 0.42
    g = P.slab(P.gear2(0.22, 8, 0.22), 0.045, 0.016, 2, 'emblem')
    P.xf(g, loc=(0, -BD / 2 - 0.012, ez))
    P.paint(g, strap_p, line=1.5, lift=0.03)
    if gem_p:
        cab = P.cabochon(0.09, 0.055)
        P.xf(cab, rot=(90, 0, 0), loc=(0, -BD / 2 - 0.035, ez))
        P.paint(cab, gem_p, line=1.1, lift=0.0)
    else:
        hub = P.slab(P.circle2(0.07, 24), 0.03, 0.01, 2, 'hub')
        P.xf(hub, loc=(0, -BD / 2 - 0.035, ez))
        P.paint(hub, C.over(strap_p, base=strap_p['shadow']), line=1.1, lift=0.02)
    if tier in ('superRare', 'mythic', 'legendary', 'rainbow'):
        P.glint((0.18, -BD / 2 - 0.1, BH + 0.3), 12)
    return dict(kind='standing', yaw=32.0, elev=22.0)
