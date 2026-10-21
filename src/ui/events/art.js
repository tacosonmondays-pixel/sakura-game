// Code-drawn event decor (no image files).

/** A string of paper lanterns (code-drawn SVG). */
export function lanternString(n = 7, width = 600) {
  const step = width / (n + 1);
  let out = `<svg viewBox="0 0 ${width} 70" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M0 8 Q ${width / 2} 40 ${width} 8" fill="none" stroke="#3a2a4a" stroke-width="2"/>`;
  for (let i = 1; i <= n; i++) {
    const x = step * i;
    const y = 8 + 32 * (1 - ((x - width / 2) / (width / 2)) ** 2) * 0.62;
    const c = i % 2 ? '#f28c28' : '#ffb347';
    out += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><line x1="0" y1="0" x2="0" y2="6" stroke="#3a2a4a" stroke-width="1.5"/>`
      + `<rect x="-5" y="5" width="10" height="3" rx="1" fill="#3a2a4a"/><ellipse cx="0" cy="17" rx="10" ry="11" fill="${c}"/>`
      + '<path d="M-6 9 Q-9 17 -6 25 M6 9 Q9 17 6 25 M0 6 V28" stroke="#c4561a" stroke-width="1" fill="none" opacity="0.6"/>'
      + '<ellipse cx="0" cy="17" rx="5" ry="6" fill="#fff4c2" opacity="0.55"/><rect x="-5" y="27" width="10" height="3" rx="1" fill="#3a2a4a"/></g>';
  }
  return `${out}</svg>`;
}
