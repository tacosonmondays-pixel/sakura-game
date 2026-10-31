// Art v3 (Oct 2026): the roster portraits redrawn in Look B, the clean academy look with a dynamic camera (thin tinted
// lines, flat two-tone cel, high-key, a soft painted place behind her) that the seven academy girls' v2 scenes set.
// Each girl here has a new full (768x1024 master), card, bust and thumb, and her PORTRAIT_DATA face and FACE_ANCHORS
// card line measured on that master; her stands (-cut, -cut-s) are unchanged. The value is the first 8 hex digits of
// the sha-256 of her full, card, bust and thumb files in that order (tests/art/portraitsV3.test.js), so a file swapped
// without its line fails the test.
export const PORTRAIT_V3 = Object.freeze({
  akane: '20d62ace',
  aoi: 'fee901a4',
  chika: 'd6fec945',
  ena: 'd9782f44',
  fuu: 'fc3c54d6',
  hana: '6cbcaf5f',
  hikari: '17356897',
  hotaru: 'cb130f2a',
  kaede: '8a47ffb4',
  kage: '9aa26ac9',
  kanna: 'a0df2277',
  midori: 'f3bd9b3c',
  miko: '6626c4c1',
  momo: '5ea59141',
  nami: '2975189d',
  noa: 'a2739fc5',
  norika: '9b330e61',
  raika: 'c17b593b',
  rei: 'cdca00c2',
  ruri: '81e60c33',
  shiro: 'ce9dc48b',
  suzu: '90b8b5fe',
  umeko: '7df55d3f',
  yuki: 'b961c2a5',
});
