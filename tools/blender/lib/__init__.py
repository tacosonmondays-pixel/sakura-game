"""Sakura Sentinels chibi pipeline (Blender 4.2 as the `bpy` python module).

Everything is built from low-poly *cages* that get a Subdivision Surface, the way the
jaeysart "sitting chibi" tutorial does it: an 8/26-vertex head cage becomes a perfectly
round head, a few-dozen-vertex body cage becomes a soft body, hair is a handful of broad
tapered tube cages with creased tips, and the face is not geometry at all but a painted
texture mapped onto the front of the head.

Coordinate system while building: Blender's (Z up, the character faces -Y, +X is the
character's left side). The glTF exporter converts to Y-up with the face towards +Z, which
is what the renderer expects (CONTRACTS §7).
"""
