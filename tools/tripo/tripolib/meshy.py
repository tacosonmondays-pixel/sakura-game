"""The Meshy pipeline's pure helpers, loaded by path (both tools have a package named `lib`)."""
import importlib.util
import os

_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'meshy', 'lib')


def _load(name):
    spec = importlib.util.spec_from_file_location(f'meshy_{name}', os.path.join(_DIR, f'{name}.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


pack = _load('pack')
posekit = _load('posekit')
