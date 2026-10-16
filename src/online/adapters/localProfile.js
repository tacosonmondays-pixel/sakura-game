// The local adapter's PROFILE "server": the same rules as supabase/migrations/20261016000000_profile.sql over
// the local JSON document (state.profileCards), mixed into createLocalDb() next to localSocial.js. It reuses
// social's relation helpers (blocks, friends, clanmates, mutes) and its player card. Pure apart from the
// injected clock. `?profile=0` (or `?social=0`) simulates the live project before the owner pastes the file.
import { OnlineError } from '../errors.js';
import { bioError, validCard, BIO_MAX, PROFILE_VISIBILITY, PROFILE_VISIBILITY_DEFAULT, BIO_HIDE } from '../profileRules.js';

const H = 3600000;
const DAY = 24 * H;
const HASH_RE = /^[0-9a-z]{1,16}$/;

function freshCard(now) {
  return {
    bio: '', visibility: PROFILE_VISIBILITY_DEFAULT, card: { v: 1 }, hash: '', bioChangedAt: null, bioHidden: false, bioHiddenText: null,
    bioStrikes: 0, bioStrikeAt: null, bioLockedUntil: null, updatedAt: now, createdAt: now,
  };
}

/** 'YYYY-MM' of a time (SQL: to_char(created_at, 'YYYY-MM'), the server's UTC). */
export function sinceMonth(t) {
  const d = new Date(t || 0);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * @param {{ tx: Function, rate: Function, now: () => number, enabled: () => boolean,
 *   social: { playerCard: Function, relations: object } }} ctx
 */
export function createLocalProfile({ tx, rate, now, enabled, social }) {
  const fail = (c, msg) => {
    throw new OnlineError(c, msg, { definitive: true });
  };
  const gate = () => {
    if (!enabled()) fail('needs_update', 'Needs the latest server update.');
  };
  const R = social.relations;
  const cards = (s) => (s.profileCards ||= {});
  const bioOk = (b) => typeof b === 'string' && bioError(b) === null && [...b].length <= BIO_MAX;

  /** SQL profile_can_see. */
  function canSee(s, owner, viewer, visibility) {
    if (owner === viewer) return true;
    const x = R.S(s);
    if (R.isBlocked(x, owner, viewer)) return false;
    if (visibility === 'everyone') return true;
    if (visibility === 'friends_clan') return R.areFriends(x, owner, viewer) || R.clanmates(s, owner, viewer, 72);
    return false;
  }

  /** SQL profile_own_json. */
  function ownJson(s, me) {
    const c = cards(s)[me];
    const x = R.S(s);
    return {
      exists: !!c, bio: c?.bio || '', visibility: c?.visibility || PROFILE_VISIBILITY_DEFAULT, card: c ? c.card : null, hash: c?.hash || '',
      bioHidden: !!c?.bioHidden || R.ownerMuted(x, me) || !bioOk(c?.bio || ''),
      bioLockedUntil: c?.bioLockedUntil > now() ? c.bioLockedUntil : null, muted: R.muted(x, me), updatedAt: c?.updatedAt ?? null,
    };
  }

  /** SQL profile_evidence. */
  function evidenceOf(s, target) {
    const c = cards(s)[target];
    if (!c) return null;
    const card = c.card || {};
    return {
      bio: c.bio, bioChangedAt: c.bioChangedAt, bioHidden: c.bioHidden, visibility: c.visibility,
      fav: card.fav ?? null, ban: card.ban ?? null, frm: card.frm ?? null, ttl: card.ttl ?? null,
      units: Array.isArray(card.units) ? card.units.map((u) => u?.id ?? null) : [], pins: card.med?.pins ?? null,
    };
  }

  /** SQL profile_maybe_hide. */
  function maybeHide(s, target) {
    const c = cards(s)[target];
    if (!c || c.bio === '' || c.bioHidden) return;
    const x = R.S(s);
    const reporters = new Set(x.reports.filter((r) => r.targetId === target && r.status === 'open' && r.context === 'profile'
      && r.updatedAt >= (c.bioChangedAt ?? -Infinity) && (s.users[r.reporterId]?.createdAt || now()) <= now() - BIO_HIDE.minAccountHours * H).map((r) => r.reporterId));
    if (reporters.size < BIO_HIDE.reporters) return;
    const strikes = c.bioStrikeAt > now() - BIO_HIDE.strikeWindowDays * DAY ? c.bioStrikes + 1 : 1;
    Object.assign(c, { bioHidden: true, bioHiddenText: c.bio, bioStrikes: strikes, bioStrikeAt: now() });
    if (strikes >= BIO_HIDE.lockStrikes) c.bioLockedUntil = now() + BIO_HIDE.lockDays * DAY;
  }

  return {
    /** The deploy probe (SQL: profile_version()). */
    profileProbe() {
      return enabled() ? 'ready' : 'needs_update';
    },

    /** SQL: the reports_profile_evidence + reports_profile_hide triggers (called by localSocial.report). */
    afterReport(s, report, oldEvidence = null) {
      if (!enabled() || !report) return;
      const now0 = evidenceOf(s, report.targetId);
      const prev = oldEvidence?.profile ?? report.evidence?.profile;
      const old = prev && typeof prev === 'object' ? prev : null;
      if (now0 || old) {
        const seen = new Set();
        const earlier = [...(Array.isArray(old?.earlier) ? old.earlier : []), ...(old?.bio ? [{ bio: old.bio, at: old.bioChangedAt }] : [])]
          .filter((e) => e && e.bio && e.bio !== now0?.bio)
          .sort((a, b) => (b.at || 0) - (a.at || 0))
          .filter((e) => !seen.has(e.bio) && seen.add(e.bio))
          .slice(0, 3)
          .sort((a, b) => (a.at || 0) - (b.at || 0));
        report.evidence = { ...(report.evidence || {}), profile: { ...(now0 || old), earlier } };
      }
      if (report.context === 'profile' && report.status === 'open') maybeHide(s, report.targetId);
    },

    profileView(uid, userId) {
      gate();
      const card = social.playerCard(uid, userId);
      return tx((s) => {
        const c = cards(s)[userId];
        const x = R.S(s);
        let why = null;
        if (userId === uid) why = c ? null : 'none';
        else if (R.blockedByMe(x, uid, userId)) why = 'blocked_by_me';
        else if (!c) why = 'none';
        else if (!canSee(s, userId, uid, c.visibility)) why = 'private';
        const bioShown = userId === uid || (!c?.bioHidden && !R.ownerMuted(x, userId) && bioOk(c?.bio || ''));
        return {
          ...card,
          since: sinceMonth(s.users[userId]?.createdAt),
          profileWhy: why,
          profile: why === null ? { bio: bioShown ? c.bio : '', card: JSON.parse(JSON.stringify(c.card)) } : null,
          own: userId === uid ? ownJson(s, uid) : null,
        };
      }, { save: false });
    },

    myProfileCard(uid) {
      gate();
      return tx((s) => ownJson(s, uid), { save: false });
    },

    setProfileCard(uid, card, hash) {
      gate();
      return tx((s) => {
        const h = String(hash ?? '');
        if (!HASH_RE.test(h)) fail('invalid', 'bad card hash');
        if (!validCard(card) || JSON.stringify(card).length > 8192) fail('invalid', 'that profile card is not valid');
        rate(s, uid, 'profile');
        const c = (cards(s)[uid] ||= freshCard(now()));
        Object.assign(c, { card: JSON.parse(JSON.stringify(card)), hash: h, updatedAt: now() });
        return { hash: h };
      });
    },

    setProfileBio(uid, bio) {
      gate();
      return tx((s) => {
        const b = String(bio ?? '').trim();
        const c0 = cards(s)[uid];
        if (c0 && c0.bio === b) return ownJson(s, uid);
        if (b !== '') {
          const err = bioError(b);
          if (err) fail('invalid', err);
          if (R.muted(R.S(s), uid) || (c0 && c0.bioLockedUntil > now())) fail('forbidden', 'you can\'t change your bio right now');
        }
        rate(s, uid, 'bio');
        const c = (cards(s)[uid] ||= freshCard(now()));
        // the text reports hid stays hidden whenever it is set again (its change time stays too)
        const again = b !== '' && b === (c.bioHiddenText ?? null);
        Object.assign(c, { bio: b, bioChangedAt: again ? c.bioChangedAt : now(), bioHidden: again, updatedAt: now() });
        return ownJson(s, uid);
      });
    },

    setProfileVisibility(uid, value) {
      gate();
      return tx((s) => {
        if (!PROFILE_VISIBILITY.includes(value)) fail('invalid', 'unknown setting');
        rate(s, uid, 'settings');
        const c = (cards(s)[uid] ||= freshCard(now()));
        Object.assign(c, { visibility: value, updatedAt: now() });
        return true;
      });
    },
  };
}
