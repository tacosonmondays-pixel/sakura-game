// Art v3 (Oct 2026, the owner's option C): the roster portraits redrawn in Look B, the clean academy look with a dynamic
// camera (thin tinted lines, flat two-tone cel, high-key) that the seven academy girls' v2 scenes set, each drawn from
// her previous portrait for likeness, with her signature prop, a richly detailed place of her own and no halo.
// Each girl here has a new full (768x1024 master), card, bust and thumb, and her PORTRAIT_DATA face and FACE_ANCHORS
// card line measured on that master; her stands (-cut, -cut-s) are unchanged. The value is the first 8 hex digits of
// the sha-256 of her full, card, bust and thumb files in that order (tests/art/portraitsV3.test.js), so a file swapped
// without its line fails the test.
export const PORTRAIT_V3 = Object.freeze({
  akane: '0097c02f',
  aoi: '3acf9992',
  chika: '102f9515',
  ena: '638ab8a4',
  fuu: 'd4f80a41',
  hana: 'd0188224',
  hikari: '84490632',
  hotaru: 'c222e786',
  kaede: 'e0a3c3e6',
  kage: '0ed701cf',
  kanna: 'ff4d6f99',
  midori: '0f9ea55c',
  miko: '9d976c9a',
  momo: 'e5d16bbc',
  nami: '608ea322',
  noa: '8f1204eb',
  norika: 'ceac2fe7',
  raika: 'fb307843',
  rei: 'a71a7b5d',
  ruri: '722bebaa',
  shiro: '18baac5c',
  suzu: '5e2b5877',
  umeko: '942c2f84',
  yuki: 'cdf7d2d5',
});
