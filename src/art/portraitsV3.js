// Art v3 (Oct 2026, the owner's option C): the roster portraits redrawn in Look B, the clean academy look with a dynamic
// camera (thin tinted lines, flat two-tone cel, high-key) that the seven academy girls' v2 scenes set, each drawn from
// her previous portrait for likeness, with her signature prop, a richly detailed place of her own and no halo.
// Each girl here has a new full (768x1024 master), card, bust and thumb, and her PORTRAIT_DATA face and FACE_ANCHORS
// card line measured on that master; her stands (-cut, -cut-s) are unchanged. The value is the first 8 hex digits of
// the sha-256 of her full, card, bust and thumb files in that order (tests/art/portraitsV3.test.js), so a file swapped
// without its line fails the test.
export const PORTRAIT_V3 = Object.freeze({
  akane: '6d867135',
  aoi: '3f2accfb',
  chika: '18f94667',
  ena: 'ceb8ffe3',
  fuu: 'd83145bc',
  hana: '78e08583',
  hikari: '4929e6c6',
  hotaru: 'b6df3ab1',
  kaede: '0063735a',
  kage: '90f0763f',
  kanna: '17b7bc51',
  midori: 'd1477a6c',
  miko: '7e3c09af',
  momo: 'c0914e16',
  nami: '9465d19f',
  noa: '7f09fbe6',
  norika: 'f1650647',
  raika: '0949e321',
  rei: '74367922',
  ruri: '77911617',
  shiro: '02b46ec1',
  suzu: '97c05d70',
  umeko: '37e7ce28',
  yuki: '811369a7',
});
