// The soft-shoulder tone curve, shared by the battle's final pass (grade.js GradePass) and the effects that end their
// own shaders with it (starTrail.js). Import-free on purpose: the recruit overlay can take the curve without pulling in
// three's postprocessing code.
//
// The curve: every channel stays exactly as it is while the brightest one is below KNEE. Above it, the colour is
// scaled so its peak rolls off towards 1 instead of clipping (the hue is kept), and very hot values (peak ≥ 1) bleach
// towards white by up to WHITE_HOT, like film: the hot middle of a spark reads white-gold, never a flat clipped yellow.
//
// TONE_GLSL defines `vec3 vfxTone(vec3 c)`; toneMap() is the same maths in JS for the tests.

/** Below this nothing changes; above it, light rolls off to 1. */
export const KNEE = 0.82;
/** How far very hot values (≥ 3) bleach to white. */
export const WHITE_HOT = 0.55;

const f4 = (v) => v.toFixed(4);

/** GLSL: `vec3 vfxTone(vec3 c)` (paste before main()). */
export const TONE_GLSL = /* glsl */`
vec3 vfxTone(vec3 c) {
  // exact below the knee, a soft hue-keeping shoulder above, hot cores bleach
  float peak = max(c.r, max(c.g, c.b));
  if (peak > ${f4(KNEE)}) {
    float w = ${f4(1 - KNEE)};
    float np = ${f4(KNEE)} + w * (1.0 - exp(-(peak - ${f4(KNEE)}) / w));
    vec3 s = c * (np / peak);
    float hot = clamp((peak - 1.0) * 0.5, 0.0, 1.0) * ${f4(WHITE_HOT)};
    c = mix(s, vec3(np), hot);
  }
  return c;
}
`;

/**
 * The curve on one RGB colour (the same maths as TONE_GLSL).
 * @param {number[]} rgb
 * @returns {number[]} a new array
 */
export function toneMap(rgb) {
  let [r, g, b] = rgb;
  const peak = Math.max(r, g, b);
  if (peak > KNEE) {
    const w = 1 - KNEE;
    const np = KNEE + w * (1 - Math.exp(-(peak - KNEE) / w));
    const k = np / peak;
    const hot = Math.min(1, Math.max(0, (peak - 1) * 0.5)) * WHITE_HOT;
    r = r * k + (np - r * k) * hot;
    g = g * k + (np - g * k) * hot;
    b = b * k + (np - b * k) * hot;
  }
  return [r, g, b];
}
