"""Tickets: Recruit Ticket (approved), the 10x stack and the gold SSR Select ticket. No text in the art."""
import parts as P
import palette as C
from models import common as K

TW, TH = 1.7, 1.0          # whole ticket
STUB = 0.5                 # stub width
T = 0.06                   # card thickness
NOTCH = 0.085

STUB_PINK = C.paint('#fd87b8', light='#feb3d2', shadow='#e95c98', ink='#572a54', sheen=0.3)          # (appr.)
BODY_WHITE = C.paint('#fcf5fb', light='#ffffff', shadow='#ead6ea', ink='#572a54', sheen=0.22, rim=0.2)  # (appr.)
LAV_BAR = C.paint('#a99cf2', light='#c8bff7', shadow='#8577e0', ink='#3a2a7a', rim=0.0)
PINK_BAR = C.paint('#f98fb8', light='#fbb6d0', shadow='#e86798', ink='#781948', rim=0.0)
GOLD_STAR = C.paint('#fcd34d', light='#fee99a', shadow='#e8a91e', ink='#7d4705')


def _card(stub_p, body_p, y=0.0, line=2.4, motif=True, bars=(LAV_BAR, PINK_BAR, LAV_BAR), star_p=GOLD_STAR):
    x0 = -TW / 2
    xs = x0 + STUB
    centers = [(xs, TH / 2), (xs, -TH / 2)]
    stub = P.rrect2(STUB, TH, (0.0, 0.08, 0.08, 0.0), 5, cx=x0 + STUB / 2)
    stub = P.notch_outline(P.resample(stub, 160), centers, NOTCH)
    body = P.rrect2(TW - STUB, TH, (0.08, 0.0, 0.0, 0.08), 5, cx=xs + (TW - STUB) / 2)
    body = P.notch_outline(P.resample(body, 220), centers, NOTCH)
    s = P.slab(stub, T, T * 0.4, 2, 'stub')
    P.xf(s, loc=(0, y, 0))
    P.paint(s, stub_p, line=line)
    b = P.slab(body, T, T * 0.4, 2, 'tbody')
    P.xf(b, loc=(0, y, 0))
    P.paint(b, body_p, line=line)
    front = y - T / 2
    # perforation dots on the body edge
    for i in range(7):
        z = -TH / 2 + NOTCH + 0.06 + i * (TH - 2 * NOTCH - 0.12) / 6
        d = P.disc(0.018, 0.01, 0.0, 1, 12, 'perf')
        P.xf(d, loc=(xs + 0.035, front - 0.004, z))
        P.paint(d, C.over(body_p, base=body_p['shadow'], light=body_p['shadow']), line=0.0)
    if motif:
        star = P.poly_round(P.star2(5, 0.15, 0.07), 0.025, 3)
        K.emboss(star, 0.02, (x0 + STUB / 2 - 0.02, front, -0.05), star_p, line=1.4)
        K.blossom(0.2, 0.02, (xs + 0.36, front, 0.02),C.paint('#fb9cc2', light='#fdc6dc', shadow='#ef72a5', ink='#781948'),
                  line=1.3, pearl=C.paint('#ffe37a', light='#fff3b8', shadow='#f2b83a', ink='#7d4705'), pearl_r=0.3)
        for i, bp in enumerate(bars):
            K.bar(0.36 - (0.06 if i == 1 else 0), 0.075, (xs + 0.86 - (0.03 if i == 1 else 0), front, 0.2 - i * 0.18), bp,
                  depth=0.012, line=0.9)
    return front


def recruit():
    _card(STUB_PINK, BODY_WHITE)
    P.glint((-TW / 2 + 0.08, -T, TH / 2 - 0.02), 12)
    return dict(kind='flat', roll=-20.0, turn=16.0, tip=14.0)


def _place(objs_before, loc, rot):
    for o in P.ITEM['parts'][objs_before:]:
        P.xf(o, rot=rot, loc=loc)


def recruit10():
    """A fanned stack of three recruit tickets (pink, violet, rose-gold stubs) held by a rose-gold band."""
    stubs = [(C.over(C.ROSE_GOLD, sheen=0.25), (0.2, 0.3, 0.32), (0, 14, 0)),
             (C.paint('#b49af7', light='#d0c0fb', shadow='#8f73e8', ink='#3a2a7a', sheen=0.3), (0.1, 0.15, 0.16), (0, 7, 0)),
             (STUB_PINK, (0.0, 0.0, 0.0), (0, 0, 0))]
    for stub_p, loc, rot in stubs:
        n0 = len(P.ITEM['parts'])
        _card(stub_p, BODY_WHITE, motif=(loc == (0.0, 0.0, 0.0)))
        _place(n0, loc, rot)
    band = P.rbox(0.16, 0.34, TH + 0.12, r=0.05, seg=3, name='band')
    P.xf(band, loc=(-TW / 2 + STUB + 0.2, 0.08, 0.0))
    P.paint(band, C.ROSE_GOLD, line=2.0)
    gem = P.cabochon(0.07, 0.05)
    P.xf(gem, rot=(90, 0, 0), loc=(-TW / 2 + STUB + 0.2, -0.11, 0.0))
    P.paint(gem, C.TIER_GEM['mythic'], line=1.0)
    P.glint((-TW / 2 + 0.1, -0.1, TH / 2 + 0.05), 11)
    return dict(kind='flat', roll=-18.0, turn=16.0, tip=14.0)


def ssr_select():
    """A gold-foil ticket (gold body, cream stub) with a big pink star crest and an iridescent edge stripe."""
    gold_body = C.over(C.GOLD, sheen=0.3, spec=0.0)
    cream = C.paint('#fff4d6', light='#fffbec', shadow='#efd9a6', ink='#7d4705', sheen=0.25)
    front = _card(cream, gold_body, motif=False)
    stripe = P.slab(P.rrect2(TW - STUB - 0.14, 0.07, 0.035, 4), 0.012, 0.005, 1, 'stripe')
    P.xf(stripe, loc=(-TW / 2 + STUB + (TW - STUB) / 2, front - 0.008, -TH / 2 + 0.11))
    P.paint(stripe, dict(C.IRI, iri=1.0), line=0.9)
    crest = P.poly_round(P.star2(5, 0.36, 0.17), 0.05, 3)
    o = P.slab(crest, 0.08, 0.035, 3, 'crest')
    P.xf(o, loc=(-TW / 2 + STUB + 0.55, front - 0.03, 0.04))
    P.paint(o, C.paint('#ff8fbf', light='#ffc2db', shadow='#e85b99', ink='#781948', spec=0.5, spec_at=0.99), line=1.8)
    K.blossom(0.11, 0.02, (-TW / 2 + STUB + 0.55, front - 0.07, 0.04), C.paint('#fff8fb', light='#ffffff', shadow='#f6d3e2', ink='#781948'), line=1.0)
    small = P.poly_round(P.star2(5, 0.13, 0.06), 0.02, 2)
    K.emboss(small, 0.02, (-TW / 2 + STUB / 2 - 0.02, front, -0.05), GOLD_STAR, line=1.3)
    P.glint((-TW / 2 + STUB + 0.55, -0.2, 0.42), 12)
    return dict(kind='flat', roll=-20.0, turn=16.0, tip=14.0)


def build(row):
    k = row['key']
    table = dict(ticket_recruit=recruit, ticket_recruit10=recruit10, ticket_ssr_select=ssr_select)
    return table[k]()
