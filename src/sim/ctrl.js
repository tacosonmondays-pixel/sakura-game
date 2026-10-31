// Who gives a girl's orders (co-op sharing, docs/specs/COOP_SHARING.md §3.1a). `t.owner` is whose loadout she is
// (her stats, her colour, one final tier per path); `t.ctrl` is set only while another player controls her (a lend or
// a leaver's girls handed out) and is absent otherwise, so ctrlOf(t) is t.owner in solo and in every co-op battle
// without sharing: those play bit for bit as before. Coins she earns for one player (sim._gainCashFor) and her
// player's ability bookkeeping (group casts, the econ cap, Auto) follow ctrlOf; her loadout, onePerPath, Tenka's lab
// absorb, the per-player shot caps (rings.js) and Tryout's squad counters stay with t.owner.
/** @param {{ owner?: number, ctrl?: number }} t @returns {number} the slot that commands her */
export const ctrlOf = (t) => t.ctrl ?? t.owner ?? 0;
