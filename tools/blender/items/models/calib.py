"""Calibration-only models: approved icons that are not game items (never written to public/)."""
import parts as P
import palette as C


def energy():
    frame = P.slab(P.rrect2(1.5, 1.5, 0.42, 8), 0.24, 0.1, 4, 'frame')
    P.paint(frame, C.paint('#fb8fb5', light='#fdb8d0', shadow='#e3608f', ink='#781948', sheen=0.3), line=2.6)
    inset = P.slab(P.rrect2(1.08, 1.08, 0.24, 8), 0.06, 0.02, 2, 'inset')
    P.xf(inset, loc=(0, -0.13, 0))
    P.paint(inset, C.paint('#fdf6f9', light='#ffffff', shadow='#efd9e3', ink='#781948', rim=0.0), line=1.6, lift=0.04)
    bolt = [(0.12, 0.78), (-0.42, -0.06), (-0.04, -0.06), (-0.2, -0.8), (0.42, 0.12), (0.04, 0.12)]
    bolt = P.poly_round(bolt, 0.035, 3)
    b = P.slab(bolt, 0.16, 0.05, 3, 'bolt')
    P.xf(b, loc=(0, -0.26, 0))
    P.paint(b, C.paint('#fcc23d', light='#fde08a', shadow='#e89a1c', ink='#7d4705'), line=2.4)
    P.glint((0.18, -0.4, 0.86), 13)
    return dict(kind='flat', roll=-10.0, turn=18.0, tip=16.0)


def build(row):
    if row['key'] == 'energy':
        return energy()
    raise KeyError(row['key'])
