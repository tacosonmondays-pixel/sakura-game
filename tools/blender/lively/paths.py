"""Where the lively-figure tools read and write. Nothing big lives in the repo: the shipped GLBs they start from,
the Meshy library clip GLBs (about 30 MB each) and every intermediate sit in a work folder outside git.

    SAKURA_LIVELY_WORK     the work folder (default: <repo>/.lively-work, ignored by git), laid out as
                           noa/{src,build,flat,out,check}/ and girls/{src,flat,out,check}/
    SAKURA_MESHY_CLIPS     the Meshy library clip GLBs bought on Noa's rig R1 (default: <work>/meshy/)
    SAKURA_BLENDER_PYLIBS  optional extra site-packages for Blender's own Python (e.g. Pillow)
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
MESHY_TOOLS = os.path.join(REPO, 'tools', 'meshy')


def _dir(p):
    return p.replace('\\', '/').rstrip('/') + '/'


WORK = _dir(os.environ.get('SAKURA_LIVELY_WORK') or os.path.join(REPO, '.lively-work'))
NOA = WORK + 'noa/'
GIRLS = WORK + 'girls/'
MESHY_CLIPS = _dir(os.environ.get('SAKURA_MESHY_CLIPS') or WORK + 'meshy')
PYLIBS = os.environ.get('SAKURA_BLENDER_PYLIBS') or None
