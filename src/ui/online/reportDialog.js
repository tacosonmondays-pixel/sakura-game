// Report a player: a reason (chips), an optional note, "Also block" (on by default). The server
// stores its own copy of the evidence (the reported message, the last DMs between you, their
// name) for the game's team — never this dialog's words as evidence.
import '../styles/social.css';
import { h, modal, toast } from '../components.js';
import { getBackend } from '../../online/backend.js';
import { errorText } from '../../online/errors.js';
import { REPORT_REASONS, REPORT_NOTE_MAX, bodyError } from '../../online/socialRules.js';
import { setBlocked } from './socialHub.js';

/**
 * @param {{ userId: string, name?: string, context?: 'dm'|'global'|'clan'|'profile'|'coop', messageId?: number|null, blocked?: boolean }} who
 * @returns {Promise<{ reported: boolean, blocked: boolean }>}
 */
export function openReportDialog({ userId, name = 'this player', context = 'profile', messageId = null, blocked = false }) {
  return new Promise((resolve) => {
    let reason = null;
    let done = { reported: false, blocked: false };
    const chips = h('div.sc-chips', { role: 'radiogroup' });
    const paint = () => chips.replaceChildren(...REPORT_REASONS.map((r) => h(`button.sc-chip${r.id === reason ? '.on' : ''}`, {
      type: 'button', role: 'radio', 'aria-checked': r.id === reason ? 'true' : 'false', 'data-testid': `report-${r.id}`,
      onclick: () => { reason = r.id; paint(); err.textContent = ''; },
    }, r.label)));
    const note = h('textarea.ol-input.sc-note', { maxlength: REPORT_NOTE_MAX, rows: 2, placeholder: 'What happened? (optional)', 'data-testid': 'report-note' });
    const also = h('input', { type: 'checkbox', checked: !blocked, disabled: blocked, 'data-testid': 'report-block' });
    const err = h('p.ol-error', { 'data-testid': 'report-error' });
    paint();
    const send = async (close) => {
      if (!reason) {
        err.textContent = 'Pick what happened first.';
        return;
      }
      const text = note.value.trim();
      const bad = text ? bodyError(text) : null;
      if (bad) {
        err.textContent = bad;
        return;
      }
      const backend = getBackend();
      try {
        await backend.report(userId, { reason, note: text, context, messageId });
        done.reported = true;
        if (also.checked && !blocked) {
          try {
            await backend.block(userId);
            setBlocked(userId, true);
            done.blocked = true;
          } catch (e) {
            toast(errorText(e), 'bad');
          }
        }
      } catch (e) {
        err.textContent = errorText(e);
        return;
      }
      close();
      toast('Thanks — the game\'s team will look at it.', 'good', 3000);
    };
    modal({
      title: `Report ${name}`,
      cls: 'sc-report',
      body: h('div.sc-report-body',
        h('p.muted', 'What happened? The game\'s team sees the messages between you, so you don\'t have to copy them.'),
        chips,
        note,
        h('label.sc-check', also, h('span', blocked ? `${name} is blocked.` : `Also block ${name}`)),
        err),
      actions: [
        { label: 'Cancel', kind: 'ghost', testid: 'report-cancel' },
        { label: 'Send report', kind: 'danger', testid: 'report-send', onClick: (close) => send(close) },
      ],
      onClose: () => resolve(done),
    });
  });
}
