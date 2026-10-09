// Formation (owner: meta-b). Hero slot + 8 tower slots chosen from owned girls (tap to add/remove),
// "recommended for the next stage" counter check (recommendedFor) highlighting missing counters.
// Every change is saved to profile.formation immediately.
// Route: #/formation[?stage=<stageId>]
import '../styles/meta-b.css';
import { h, clear, screen, svgEl, button, unitCard, toast } from '../components.js';
import { store } from '../../core/store.js';
import { navigate } from '../router.js';
import { formatNumber } from '../../core/util.js';
import { BATTLE, CAPABILITIES, UNIT_RARITIES } from '../../data/types.js';
import { UNIT_MAP, hasCapability, unitsWithCapability } from '../../data/units.js';
import { STAGE_MAP, CAMPAIGN_IDS } from '../../data/stages.js';
import { getMap } from '../../data/maps.js';
import { ownedUnits, nextStage, recommendedFor } from '../../systems/unlocks.js';
import { unitPower } from '../../systems/progression.js';
import { capabilityIcon, uiIcon } from '../../art/icons.js';
import { portraitHTML } from '../../art/portraits.js';
import { stageThumbSVG } from '../../art/stageThumb.js';
import { unitMini, howToGet, put, emptyState } from './backpack.js';

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

function slotTile(unitId, onRemove, needCaps) {
  if (!unitId) return null;
  const u = UNIT_MAP[unitId];
  const st = store.profile.units[unitId];
  return h('button.mb-fslot.filled', { title: `Remove ${u.name}`, onclick: onRemove, 'data-unit': unitId, style: `border-bottom: 3px solid ${UNIT_RARITIES[u.rarity].color}` },
    svgEl(portraitHTML(u, 'card'), 'unit-card-art'),
    needCaps.length ? h('div.mb-fslot-caps', needCaps.map((c) => svgEl(capabilityIcon(c)))) : null,
    h('span.mb-fslot-x', '×'),
    h('div.mb-fslot-name', u.name, h('span', { style: 'opacity:.8;font-weight:700' }, ` Lv${st?.level || 1}`)));
}

export function render(root, params = {}) {
  const profile = store.profile;
  const stageId = (params.stage && STAGE_MAP[params.stage] ? params.stage : null) || nextStage(profile) || CAMPAIGN_IDS[CAMPAIGN_IDS.length - 1];
  const stage = STAGE_MAP[stageId];
  const { el, body } = screen('Formation');
  el.classList.add('mb-screen');
  root.appendChild(el);

  let f = formationOf(profile);
  let savedTimer = 0;
  // Landscape and up (meta-b.css): the squad strip spans the top, recommendations sit beside the picker.
  const squad = h('section.mb-card.mb-formation-squad');
  const recBox = h('section.mb-card.mb-formation-rec');
  const picker = h('section.mb-card.mb-formation-pick');
  body.appendChild(h('div.mb-formation', squad, recBox, picker));

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

  function renderSquad(needs, flashId) {
    clear(squad);
    const needCapsOf = (id) => needs.filter((n) => n.inTeam.includes(id)).map((n) => n.cap);
    const heroTile = f.hero ? slotTile(f.hero, () => toggle(f.hero), needCapsOf(f.hero)) : h('button.mb-fslot', { onclick: () => { pickState.kind = 'hero'; renderPicker(needs); picker.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, '+');
    const towerTiles = Array.from({ length: BATTLE.maxTowers }, (_, i) => {
      const id = f.towers[i];
      return id ? slotTile(id, () => toggle(id), needCapsOf(id)) : h('button.mb-fslot', { onclick: () => { pickState.kind = 'tower'; renderPicker(needs); picker.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, '+');
    });
    if (flashId) for (const t of [heroTile, ...towerTiles]) if (t?.dataset?.unit === flashId) t.classList.add('flash');
    const deploy = members(f).reduce((a, id) => a + (UNIT_MAP[id].base.cost || 0), 0);
    put(squad,
      h('h3.mb-card-title', 'Squad'),
      h('div.mb-squad',
        h('div.mb-hero-slot', h('div.mb-slot-label', 'Hero'), heroTile),
        h('div', h('div.mb-slot-label', `Students ${f.towers.length} / ${BATTLE.maxTowers}`), h('div.mb-tower-slots', towerTiles))),
      h('div.mb-squad-foot',
        h('div.muted', `Tap a girl to remove her · total deploy cost ${formatNumber(deploy)}`),
        h('span.mb-saved', svgEl(uiIcon('check')), 'Saved')),
      h('div.mb-actions',
        button('Clear', { kind: 'ghost', small: true, disabled: !members(f).length, onClick: () => { f = { hero: null, towers: [] }; save(); } }),
        button('Add counters', {
          kind: 'primary', small: true, icon: 'sparkle', testid: 'auto-counters',
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
        button(`Go to ${stageId}`, { kind: 'yellow', icon: 'play', onClick: () => navigate('stage', { id: stageId }) })));
  }

  function renderRec(needs) {
    clear(recBox);
    const map = stage ? getMap(stage.mapId) : null;
    put(recBox,
      h('h3.mb-card-title', 'Recommended'),
      h('div.mb-rec-head',
        map ? h('div.mb-rec-thumb', { html: stageThumbSVG(map, { width: 184, height: 115 }) }) : null,
        h('div',
          h('div.muted', stage?.kind === 'campaign' ? `Next stage · ${stageId}` : stageId),
          h('div.mb-rec-name', stage?.name || stageId),
          h('div.muted', stage?.desc || ''))),
    );
    if (!needs.length) {
      recBox.appendChild(h('p.muted', 'No special counters needed — bring your strongest girls.'));
      return;
    }
    recBox.appendChild(h('div.mb-rec-list', needs.map((n) => {
      const c = CAPABILITIES[n.cap];
      let status;
      let units;
      if (n.status === 'ok') {
        status = `Covered by ${n.inTeam.map((id) => UNIT_MAP[id].name).join(', ')}`;
        units = n.inTeam.slice(0, 3).map((id) => unitMini(id, { size: 32 }));
      } else if (n.status === 'bench') {
        status = 'Owned but not in the squad — tap to add';
        units = n.bench.slice(0, 3).map((id) => h('button.mb-rec-add', { title: `Add ${UNIT_MAP[id].name}`, onclick: () => toggle(id) }, unitMini(id, { size: 34 })));
      } else {
        const who = n.could[0] ? UNIT_MAP[n.could[0]] : null;
        status = who ? `Missing — ${who.name}: ${howToGet(who).short}` : 'Missing';
        units = n.could.slice(0, 2).map((id) => h('button.mb-rec-add', { title: UNIT_MAP[id].name, onclick: () => navigate('student', { id }) }, unitMini(id, { size: 34 })));
      }
      return h(`div.mb-rec.${n.status}`,
        svgEl(capabilityIcon(n.cap), 'mb-rec-icon'),
        h('div', h('div.mb-rec-cap', c?.name || n.cap), h('div.mb-rec-status', status)),
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
      h('div.mb-section-head',
        h('div.mb-seg',
          [['tower', 'Students'], ['hero', 'Heroes']].map(([k, label]) => h(`button.mb-seg-btn${pickState.kind === k ? '.on' : ''}`, { onclick: () => { pickState.kind = k; renderPicker(needs); } }, label))),
        h('span.muted', missingCaps.length ? 'Glowing girls cover a counter this stage still needs.' : 'Tap a girl to add or remove her.')),
      list.length
        ? h('div.mb-pick-grid', list.map((u) => {
          const st = profile.units[u.id];
          const covers = missingCaps.filter((c) => hasCapability(u, c, { includePaths: true }));
          const card = unitCard(u.id, { variant: 'tall', level: st.level, awaken: st.awaken, owned: true, onClick: () => toggle(u.id) });
          card.style.setProperty('--rarity', UNIT_RARITIES[u.rarity].color);
          return h(`div.mb-pick${team.includes(u.id) ? '.in' : ''}${covers.length ? '.mb-pick-glow' : ''}`,
            card,
            team.includes(u.id) ? h('span.mb-pick-check', svgEl(uiIcon('check'))) : null,
            covers.length ? h('div.mb-pick-need', covers.map((c) => svgEl(capabilityIcon(c)))) : null,
            h('span.mb-pick-cost', formatNumber(u.base.cost)));
        }))
        : emptyState(pickState.kind === 'hero' ? 'No other heroes yet' : 'No students yet', 'Recruit girls or clear stages to unlock free recruits.', button('Recruit', { kind: 'yellow', icon: 'gacha', onClick: () => navigate('recruit') })));
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

