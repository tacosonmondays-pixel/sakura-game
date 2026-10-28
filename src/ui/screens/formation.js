// Formation (owner: meta-b). Hero slot + 8 tower slots chosen from owned girls (tap to add/remove),
// "recommended for the next stage" counter check (recommendedFor) highlighting missing counters.
// Every change is saved to profile.formation immediately.
// Route: #/formation[?stage=<stageId>]
// UI M5d (notes/ui-m5/PLAN.md §5 M5d): every label 12 px or more; one fact per slot; "Hero" and "Students 8/8" over
// the slots, heroes deploying free said in the line under them. No 3D (E10 is the tail's).
// [ui-ink] V3 (docs/specs/UI_V2_MENUS.md §5 M3): the squad is a row of kit girl tiles (girlTile(); tap one to remove
// her, hold for her sheet), the stage's counter needs are kit rows (covered / on the bench / missing, the girls who
// help), the pick grid is girl tiles (a girl in the squad is the selected tile; one who covers a missing counter carries
// its icon). One yellow: Go to the stage.
import '../styles/meta-b.css';
import '../styles/hubs.css';
import '../styles/v2-roster.css';
import { h, clear, screen, svgEl, button, girlTile, toast } from '../components.js';
import { store } from '../../core/store.js';
import { navigate } from '../router.js';
import { formatNumber } from '../../core/util.js';
import { BATTLE, CAPABILITIES } from '../../data/types.js';
import { UNIT_MAP, hasCapability, unitsWithCapability } from '../../data/units.js';
import { STAGE_MAP, CAMPAIGN_IDS } from '../../data/stages.js';
import { getMap } from '../../data/maps.js';
import { ownedUnits, nextStage, recommendedFor } from '../../systems/unlocks.js';
import { unitPower } from '../../systems/progression.js';
import { capabilityIcon } from '../../art/icons.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { unitMini, howToGet, put, emptyState } from './backpack.js';
import { ico, secondaryBtn } from '../kit.js';
import { lg } from '../girlFrame.js';

const pickState = { kind: 'tower' };

function formationOf(profile) {
  const f = profile.formation || {};
  return {
    hero: f.hero && profile.units[f.hero] && UNIT_MAP[f.hero]?.kind === 'hero' ? f.hero : null,
    towers: (f.towers || []).filter((id, i, a) => profile.units[id] && UNIT_MAP[id]?.kind === 'tower' && a.indexOf(id) === i).slice(0, BATTLE.maxTowers),
  };
}

function members(f) {
  return [f.hero, ...f.towers].filter(Boolean);
}

/** Needs of the stage: who in the formation covers each capability, who is on the bench, who could. */
function needStatus(profile, f, stageId) {
  const rec = recommendedFor(profile, stageId);
  const team = members(f);
  return rec.needs.map((cap) => {
    const inTeam = team.filter((id) => hasCapability(UNIT_MAP[id], cap, { includePaths: true }));
    const bench = (rec.ownedCounters[cap] || []).filter((id) => !team.includes(id));
    const could = unitsWithCapability(cap).map((u) => u.id).filter((id) => !profile.units[id]);
    const status = inTeam.length ? 'ok' : bench.length ? 'bench' : 'missing';
    return { cap, inTeam, bench, could, status };
  });
}

/** A squad girl: her girl tile (name only: her level is in the pick grid and her sheet); a tap takes her out. */
function slotTile(unitId, onRemove) {
  if (!unitId) return null;
  const t = girlTile(unitId, { owned: true, onClick: onRemove, cls: 'mb-fslot.filled.fm-slot' });
  t.title = `Remove ${UNIT_MAP[unitId].name}`;
  t.setAttribute('aria-label', `${t.getAttribute('aria-label')}. Tap to remove her from the squad`);
  // (her P chip keeps the squad slot's test id)
  t.querySelector('[data-testid="card-pot"]')?.setAttribute('data-testid', 'fslot-pot');
  return t;
}

/** An empty squad place: a dashed tile; a tap shows the pick grid of that kind. */
function emptySlot(kind, onPick) {
  return h('button.mb-fslot.fm-empty', { type: 'button', 'aria-label': kind === 'hero' ? 'Pick a hero' : 'Pick a student', onclick: onPick }, lg('plus'));
}

export function render(root, params = {}) {
  const profile = store.profile;
  const stageId = (params.stage && STAGE_MAP[params.stage] ? params.stage : null) || nextStage(profile) || CAMPAIGN_IDS[CAMPAIGN_IDS.length - 1];
  const stage = STAGE_MAP[stageId];
  const { el, body } = screen('Formation');
  el.classList.add('mb-screen', 'mb-formation-screen', 'fm-screen');
  root.appendChild(el);

  let f = formationOf(profile);
  let savedTimer = 0;
  // Landscape and up (meta-b.css): the squad strip spans the top, recommendations sit beside the picker.
  const squad = h('section.mb-card.mb-formation-squad.fm-squad');
  const recBox = h('section.mb-card.mb-formation-rec.fm-rec');
  const picker = h('section.mb-card.mb-formation-pick.fm-pick');
  body.appendChild(h('div.mb-formation.fm', squad, recBox, picker));

  const save = (flashId) => {
    profile.formation = { hero: f.hero, towers: f.towers.slice() };
    store.commit('formation');
    renderAll(flashId);
    const s = squad.querySelector('.mb-saved');
    if (s) {
      s.classList.add('on');
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => s.classList.remove('on'), 1400);
    }
  };

  const toggle = (id) => {
    const u = UNIT_MAP[id];
    if (u.kind === 'hero') {
      f.hero = f.hero === id ? null : id;
    } else if (f.towers.includes(id)) {
      f.towers = f.towers.filter((t) => t !== id);
    } else if (f.towers.length >= BATTLE.maxTowers) {
      toast(`The squad is full (${BATTLE.maxTowers} girls). Tap a girl in the squad to remove her first.`, 'bad');
      return;
    } else f.towers.push(id);
    save(id);
  };
  const pickKind = (kind, needs) => () => { pickState.kind = kind; renderPicker(needs); picker.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  function renderSquad(needs, flashId) {
    clear(squad);
    const heroTile = f.hero ? slotTile(f.hero, () => toggle(f.hero)) : emptySlot('hero', pickKind('hero', needs));
    const towerTiles = Array.from({ length: BATTLE.maxTowers }, (_, i) => {
      const id = f.towers[i];
      return id ? slotTile(id, () => toggle(id)) : emptySlot('tower', pickKind('tower', needs));
    });
    if (flashId) for (const t of [heroTile, ...towerTiles]) if (t?.dataset?.unit === flashId) t.classList.add('flash');
    // heroes deploy for free: the total counts the students only
    const deploy = members(f).filter((id) => UNIT_MAP[id].kind !== 'hero').reduce((a, id) => a + (UNIT_MAP[id].base.cost || 0), 0);
    put(squad,
      h('div.fm-head',
        h('h3.mb-card-title', 'Squad'),
        h('span.fm-gap'),
        h('div.mb-actions.fm-acts',
          secondaryBtn('Clear', { testid: 'squad-clear', disabled: !members(f).length, onClick: () => { f = { hero: null, towers: [] }; save(); } }),
          secondaryBtn('Add counters', {
            icon: 'sparkle', testid: 'auto-counters',
            disabled: !needs.some((n) => n.status === 'bench'),
            onClick: () => {
              let added = 0;
              for (const n of needs) {
                if (n.status !== 'bench') continue;
                const id = n.bench[0];
                if (UNIT_MAP[id].kind === 'hero') { if (!f.hero) { f.hero = id; added++; } continue; }
                if (f.towers.length < BATTLE.maxTowers && !f.towers.includes(id)) { f.towers.push(id); added++; }
              }
              if (!added) toast('No free slot for the missing counters — remove someone first.', 'bad');
              save();
            },
          }),
          button(`Go to ${stageId}`, { kind: 'yellow', icon: 'play', testid: 'squad-go', onClick: () => navigate('stage', { id: stageId }) }))),
      h('div.mb-squad.fm-row',
        h('div.mb-hero-slot.fm-hero', h('div.mb-slot-label.lbl', 'Hero'), heroTile),
        h('div.fm-towers', h('div.mb-slot-label.lbl', 'Students ', h('span.num', `${f.towers.length}/${BATTLE.maxTowers}`)), h('div.mb-tower-slots.fm-slots', towerTiles))),
      h('div.mb-squad-foot.fm-foot',
        h('p.fm-line', `Tap a girl to remove her · hold for her info · deploy cost ${formatNumber(deploy)} (heroes are free)`),
        h('span.mb-saved', ico('check'), 'Saved')));
  }

  function renderRec(needs) {
    clear(recBox);
    const map = stage ? getMap(stage.mapId) : null;
    put(recBox,
      h('h3.mb-card-title', 'Recommended'),
      h('div.mb-rec-head.fm-rec-head',
        map ? h('div.mb-rec-thumb.fm-thumb', { html: stageThumbSVG(map, { width: 184, height: 115 }) }) : null,
        h('div.fm-rec-txt',
          h('span.lbl', stage?.kind === 'campaign' ? `Next stage · ${stageId}` : stageId),
          h('div.mb-rec-name', stage?.name || stageId),
          stage?.desc ? h('p.fm-desc', stage.desc) : null)),
    );
    if (!needs.length) {
      recBox.appendChild(h('p.fm-line', 'No special counters needed — bring your strongest girls.'));
      return;
    }
    recBox.appendChild(h('div.mb-rec-list.fm-needs', needs.map((n) => {
      const c = CAPABILITIES[n.cap];
      let status;
      let units;
      if (n.status === 'ok') {
        status = `Covered by ${n.inTeam.map((id) => UNIT_MAP[id].name).join(', ')}`;
        units = n.inTeam.slice(0, 3).map((id) => unitMini(id, { size: 32 }));
      } else if (n.status === 'bench') {
        status = 'In your academy, not in the squad: tap to add';
        units = n.bench.slice(0, 3).map((id) => h('button.mb-rec-add', { type: 'button', title: `Add ${UNIT_MAP[id].name}`, 'aria-label': `Add ${UNIT_MAP[id].name}`, onclick: () => toggle(id) }, unitMini(id, { size: 34 })));
      } else {
        const who = n.could[0] ? UNIT_MAP[n.could[0]] : null;
        status = who ? `Missing — ${who.name}: ${howToGet(who).short}` : 'Missing';
        units = n.could.slice(0, 2).map((id) => h('button.mb-rec-add', { type: 'button', title: UNIT_MAP[id].name, 'aria-label': `${UNIT_MAP[id].name}: her page`, onclick: () => navigate('student', { id }) }, unitMini(id, { size: 34 })));
      }
      return h(`div.mb-rec.fm-need.${n.status}`,
        svgEl(capabilityIcon(n.cap), 'mb-rec-icon'),
        h('div.fm-need-txt', h('div.mb-rec-cap', c?.name || n.cap), h('div.mb-rec-status', status)),
        h('div.mb-rec-units', units));
    })));
  }

  function renderPicker(needs) {
    clear(picker);
    const owned = ownedUnits(profile).map((id) => UNIT_MAP[id]).filter((u) => u.kind === pickState.kind);
    const missingCaps = needs.filter((n) => n.status !== 'ok').map((n) => n.cap);
    const team = members(f);
    const list = owned.sort((a, b) => Number(team.includes(b.id)) - Number(team.includes(a.id)) || unitPower(profile, b.id) - unitPower(profile, a.id));
    put(picker,
      h('h3.mb-card-title', 'Pick girls'),
      h('div.mb-section-head.fm-pick-head',
        h('div.fm-seg', { role: 'group', 'aria-label': 'Pick from' },
          [['tower', 'Students'], ['hero', 'Heroes']].map(([k, label]) => h(`button.ui-opt.fm-opt${pickState.kind === k ? '.on' : ''}`, {
            type: 'button', 'aria-pressed': pickState.kind === k ? 'true' : 'false', 'data-testid': `pick-kind-${k}`,
            onclick: () => { pickState.kind = k; renderPicker(needs); },
          }, label))),
        h('span.fm-hint', missingCaps.length ? 'A counter icon marks a girl the stage still needs.' : 'Tap a girl to add or remove her · hold for her info.')),
      list.length
        ? h('div.mb-pick-grid.fm-grid', list.map((u) => {
          const st = profile.units[u.id];
          const covers = missingCaps.filter((c) => hasCapability(u, c, { includePaths: true }));
          const tile = girlTile(u.id, { owned: true, level: st.level, selected: team.includes(u.id), onClick: () => toggle(u.id) });
          // a girl who covers a counter the stage still needs: its icon on an ink chip above her caption
          if (covers.length) tile.append(h('span.fm-cover', { title: `Covers ${covers.map((c) => CAPABILITIES[c]?.name || c).join(', ')}` }, covers.map((c) => svgEl(capabilityIcon(c), 'fm-cover-ic'))));
          return h(`div.mb-pick${team.includes(u.id) ? '.in' : ''}${covers.length ? '.fm-covers' : ''}`, tile);
        }))
        : emptyState(pickState.kind === 'hero' ? 'No other heroes yet' : 'No students yet', 'Recruit girls or clear stages to unlock free recruits.', secondaryBtn('Recruit', { icon: 'gacha', onClick: () => navigate('recruit') })));
  }

  function renderAll(flashId) {
    const needs = needStatus(profile, f, stageId);
    renderSquad(needs, flashId);
    renderRec(needs);
    renderPicker(needs);
  }

  // Persist the sanitized formation (drops unowned/duplicate ids) without spamming commits.
  const before = JSON.stringify(profile.formation || {});
  if (JSON.stringify({ hero: f.hero, towers: f.towers }) !== before) {
    profile.formation = { hero: f.hero, towers: f.towers.slice() };
    store.commit('formation');
  }
  renderAll();
  return () => clearTimeout(savedTimer);
}
