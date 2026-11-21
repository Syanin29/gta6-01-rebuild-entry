// The HUD: DOM bars and readouts over the canvas plus a 2D minimap that
// draws the road grid, the sea, the player, police and the mission beacon.
// All elements are created here so index.html stays a thin shell.

import { CITY, districtAt } from './config.js';

function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export class Hud {
  constructor(root) {
    this.root = root;
    const top = el('div', 'hud-top', root);
    const left = el('div', 'hud-left', top);
    this.healthBar = this.makeBar(left, 'HEALTH', '#e84f4f');
    this.armorBar = this.makeBar(left, 'ARMOR', '#7ab8e8');
    this.cashEl = el('div', 'hud-cash', left, '$40');
    const right = el('div', 'hud-right', top);
    this.starsEl = el('div', 'hud-stars', right, '');
    this.weaponEl = el('div', 'hud-weapon', right, 'PISTOL 24');
    this.clockEl = el('div', 'hud-clock', right, '19:24');
    this.districtEl = el('div', 'hud-district', right, 'Downtown');

    this.objectiveEl = el('div', 'hud-objective', root, '');
    this.toastEl = el('div', 'hud-toast', root, '');
    this.toastTimer = 0;
    this.promptEl = el('div', 'hud-prompt', root, '');
    this.crosshair = el('div', 'hud-crosshair', root, '+');
    this.crosshair.style.display = 'none';

    const mapWrap = el('div', 'hud-mapwrap', root);
    this.map = el('canvas', 'hud-map', mapWrap);
    this.map.width = 176;
    this.map.height = 176;
    this.mapCtx = this.map.getContext('2d');
    this.speedEl = el('div', 'hud-speed', mapWrap, '');
    this.bustWrap = el('div', 'hud-bust', root);
    this.bustWrap.style.display = 'none';
    el('div', 'hud-bust-label', this.bustWrap, 'BUSTED');
    this.bustBar = el('div', 'hud-bust-bar', this.bustWrap);
  }

  makeBar(parent, label, color) {
    const wrap = el('div', 'hud-barwrap', parent);
    el('span', 'hud-barlabel', wrap, label);
    const track = el('div', 'hud-bartrack', wrap);
    const fill = el('div', 'hud-barfill', track);
    fill.style.background = color;
    return fill;
  }

  toast(text, seconds = 4.5) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    this.toastTimer = seconds;
  }

  setPrompt(text) {
    this.promptEl.textContent = text || '';
    this.promptEl.style.display = text ? 'block' : 'none';
  }

  update(dt, s) {
    this.healthBar.style.width = `${Math.max(0, s.health)}%`;
    this.armorBar.style.width = `${Math.max(0, s.armor)}%`;
    this.cashEl.textContent = `$${s.cash.toLocaleString('en-US')}`;
    this.starsEl.textContent = s.wanted > 0 ? '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted) : '';
    this.weaponEl.textContent = s.inCar ? 'DRIVING' : `PISTOL ${s.ammo}`;
    const mins = Math.floor(s.clockMinutes);
    const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    this.clockEl.textContent = `${hh}:${mm}`;
    this.districtEl.textContent = districtAt(s.pos.x, s.pos.z);
    let objective = s.objective || '';
    if (s.target && objective) {
      const dist = Math.round(Math.hypot(s.pos.x - s.target.x, s.pos.z - s.target.z));
      objective += `  ·  ${dist}m`;
    }
    this.objectiveEl.textContent = objective;
    this.speedEl.textContent = s.inCar ? `${s.speedKmh} km/h` : '';
    this.crosshair.style.display = s.aiming ? 'block' : 'none';
    if (s.bust01 > 0) {
      this.bustWrap.style.display = 'block';
      this.bustBar.style.width = `${Math.round(s.bust01 * 100)}%`;
    } else {
      this.bustWrap.style.display = 'none';
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.style.opacity = '0';
    }
    this.drawMap(s);
  }

  drawMap(s) {
    const g = this.mapCtx;
    const W = this.map.width;
    const scale = W / (CITY.bounds * 2 + 60);
    const toMap = (x, z) => [W / 2 + x * scale, W / 2 + z * scale];
    g.fillStyle = '#243447';
    g.fillRect(0, 0, W, W);
    // sea at the south
    const [, seaY] = toMap(0, CITY.seaZ);
    g.fillStyle = '#1d5f74';
    g.fillRect(0, seaY, W, W - seaY);
    g.fillStyle = '#d9b380';
    const [, sandY] = toMap(0, CITY.beachZ);
    g.fillRect(0, sandY, W, Math.max(2, seaY - sandY));
    // roads
    g.strokeStyle = '#5a6270';
    g.lineWidth = Math.max(2, CITY.roadHalfWidth * 2 * scale);
    for (const r of CITY.roads) {
      const [x] = toMap(r, 0);
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, W);
      g.stroke();
      const [, y] = toMap(0, r);
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    // mission beacon
    if (s.target) {
      const [tx, ty] = toMap(s.target.x, s.target.z);
      g.fillStyle = '#ffd76a';
      g.beginPath();
      g.arc(tx, ty, 5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#ffd76a';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(tx, ty, 8 + Math.sin(performance.now() * 0.006) * 2, 0, Math.PI * 2);
      g.stroke();
    }
    // police
    g.fillStyle = '#ff4040';
    for (const cop of s.cops || []) {
      const [cx, cy] = toMap(cop.pos.x, cop.pos.z);
      g.fillRect(cx - 2.5, cy - 2.5, 5, 5);
    }
    // player arrow
    const [px, py] = toMap(s.pos.x, s.pos.z);
    g.save();
    g.translate(px, py);
    g.rotate(Math.atan2(Math.sin(s.heading), Math.cos(s.heading)) + Math.PI);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(4, 5);
    g.lineTo(-4, 5);
    g.closePath();
    g.fill();
    g.restore();
    g.fillStyle = '#ffffff';
    g.font = 'bold 10px sans-serif';
    g.fillText('N', W - 14, 13);
  }
}
