// Presentation only. The already-resolved payout is the sole scoring authority.
// Everything uses the existing reel CanvasTexture, including clipped pixel FX.
const COLS = 5, ROWS = 3;
const COLORS = Object.freeze({ faroe: '#6df4a2', erin: '#cf9aff', kaz: '#ffe567' });
const GOLD = '#fff29b', PINK = '#ff62c9', INK = '#39205f', VIOLET = '#6255ee';
const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => 1 - (1 - clamp(n)) ** 3;
const center = index => ({ x: index % COLS + .5, y: Math.floor(index / COLS) + .5 });

function random(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function createSlotWinAnimation(settledGrid, outcome, startedAt, reduced = false) {
  if (!outcome?.payouts?.length) return null;
  // All-star masks are presented once, with one label for all actual recipients.
  const groupsById = new Map();
  for (const win of outcome.payouts) {
    let group = groupsById.get(win.patternId);
    if (!group) {
      group = { id: win.patternId, cells: [...win.cells], points: win.points, owners: [] };
      groupsById.set(win.patternId, group);
    }
    if (!group.owners.includes(win.owner)) group.owners.push(win.owner);
  }
  const groups = [...groupsById.values()];
  const jackpot = groups.some(g => g.points >= 50000);
  const usedLabels = new Set();
  for (const [i, group] of groups.entries()) {
    const pts = group.cells.map(center);
    group.center = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
    const distance = cell => Math.hypot(center(cell).x - group.center.x, center(cell).y - group.center.y);
    const ordered = [...group.cells].sort((a, b) => distance(a) - distance(b) || a - b);
    group.anchor = ordered.find(cell => !usedLabels.has(cell)) ?? -1;
    if (group.anchor >= 0) usedLabels.add(group.anchor);
    group.wave = new Map(ordered.map((cell, order) => [cell, order * Math.min(42, 230 / Math.max(1, ordered.length - 1))]));
    group.delay = Math.min(i * 65, 195);
    group.cellSet = new Set(group.cells);
  }
  const hold = reduced ? 540 : jackpot ? 1390 : 1110;
  const duration = reduced ? 820 : hold + 1180;
  const cells = [...new Set(outcome.clearedCells)].map(index => {
    const memberships = groups.filter(group => group.cellSet.has(index));
    const owners = [...new Set(memberships.flatMap(group => group.owners))];
    const palette = [...owners.map(owner => COLORS[owner] || GOLD), GOLD, PINK, '#ffffff'];
    const delay = Math.min(...memberships.map(group => group.delay + group.wave.get(index)));
    const rng = random(0x52475749 + index * 197);
    const particles = Array.from({ length: jackpot ? 32 : 20 }, (_, i) => ({
      angle: i / (jackpot ? 32 : 20) * Math.PI * 2 + (rng() - .5) * .45,
      speed: .21 + rng() * .35, size: .035 + rng() * .046,
      spin: (rng() - .5) * 5, color: palette[i % palette.length],
    }));
    return { index, symbol: settledGrid[index], memberships, palette, delay, particles };
  });
  return { startedAt, duration, hold, reduced, jackpot, groups, cells };
}

export function slotWinElapsed(animation, time) {
  return Math.max(0, time - animation.startedAt);
}
export function isSlotWinFinished(animation, time) {
  return slotWinElapsed(animation, time) >= animation.duration;
}

function diamond(ctx, x, y, r) {
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill();
}

// Paint only the union of winning cells. Per-cell clipping keeps unrelated
// berries and the grid perfectly still, even when multiple masks intersect.
export function paintSlotWin(ctx, animation, time, drawSymbol) {
  const t = slotWinElapsed(animation, time);
  if (t >= animation.duration) return;
  const w = ctx.canvas.width / COLS, h = ctx.canvas.height / ROWS, u = Math.min(w, h);
  const reduced = animation.reduced;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const cell of animation.cells) {
    const col = cell.index % COLS, row = Math.floor(cell.index / COLS);
    const x = col * w, y = row * h, cx = x + w / 2, cy = y + h / 2;
    const appear = reduced ? 1 : ease((t - cell.delay) / 260);
    const burst = clamp((t - animation.hold - (reduced ? 0 : cell.delay * .65)) / (reduced ? 220 : 570));
    const linger = 1 - ease(burst);
    const pulse = reduced ? 0 : Math.sin(t / 240 + cell.index * .34);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    // Colored backing, then gold border + inset pattern-specific bands.
    ctx.globalAlpha = appear * linger * (.52 + .045 * pulse);
    ctx.fillStyle = VIOLET; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    ctx.globalAlpha = appear * linger * .23;
    ctx.fillStyle = cell.palette[0]; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    // Small diagonal pixel tiles echo the cabinet's patterned trim.
    ctx.globalAlpha = appear * linger * .20;
    ctx.fillStyle = GOLD;
    const step = Math.max(6, Math.round(u*.072));
    for (let j=0; j<4; j++) {
      ctx.fillRect(x+u*.12+j*step,y+u*.12+j*step,step,step);
      ctx.fillRect(x+w-u*.12-(j+1)*step,y+h-u*.12-(j+1)*step,step,step);
    }
    for (const [lane, group] of cell.memberships.entries()) {
      const progress = reduced ? 1 : ease((t - group.delay - group.wave.get(cell.index)) / 220);
      if (!progress) continue;
      const inset = u * (.035 + lane * .028), line = Math.max(2, u * .025);
      const colors = group.owners.map(owner => COLORS[owner] || GOLD);
      ctx.globalAlpha = progress * linger * .95;
      ctx.lineWidth = line;
      ctx.strokeStyle = INK;
      ctx.lineWidth = line + u*.035;
      ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
      ctx.lineWidth = line;
      ctx.strokeStyle = colors[0];
      ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
      // Bright tracing segments follow the exact mask, including diagonal cells.
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = Math.max(2, u * .023);
      if (!reduced) {
        ctx.setLineDash([u * .22, u * .16]);
        ctx.lineDashOffset = -t * .12 - lane * 11;
      }
      ctx.strokeRect(x + inset + line, y + inset + line, w - (inset + line) * 2, h - (inset + line) * 2);
      ctx.setLineDash([]);
      // Solid, owner-colored links mark adjacency without drawing across a non-winning cell.
      ctx.globalAlpha = progress * linger * .9;
      const links = [[col > 0 && group.cellSet.has(cell.index - 1), x, cy - u*.035, inset+line, u*.07],
        [col < COLS-1 && group.cellSet.has(cell.index + 1), x+w-inset-line, cy-u*.035, inset+line, u*.07],
        [row > 0 && group.cellSet.has(cell.index-COLS), cx-u*.035, y, u*.07, inset+line],
        [row < ROWS-1 && group.cellSet.has(cell.index+COLS), cx-u*.035, y+h-inset-line, u*.07, inset+line]];
      ctx.fillStyle = colors[0];
      for (const [visible, ...rect] of links) if (visible) ctx.fillRect(...rect);
      // Every recipient has a visible band, including a shared wildcard.
      const stripe = (w - 2 * inset) / colors.length;
      for (const [i, color] of colors.entries()) {
        ctx.fillStyle = color;
        ctx.fillRect(x + inset + stripe*i, y + inset, stripe, Math.max(3, u*.025));
      }
    }
    ctx.globalAlpha = 1;
    if (burst < 1) {
      const anticipation = reduced ? 0 : Math.sin(Math.PI * clamp((t - animation.hold + 220) / 220)) * .12;
      drawSymbol(col, row, cell.symbol, 0, 0, {
        scale: reduced ? 1 : (1 + appear * (.065 + .035 * pulse) + anticipation) * (1 - ease(burst) * .85),
        alpha: 1 - (reduced ? burst : ease(burst)),
        rotation: reduced ? 0 : burst * .35 * (cell.index % 2 ? 1 : -1),
      });
    }
    // Small rotating square confetti in the win palette; no sparkle glyphs or strobe.
    if (!reduced && burst < .2) {
      ctx.globalAlpha = appear * linger * .85;
      for (let i = 0; i < 5; i++) {
        const angle = t * .0018 + i * Math.PI * 2 / 5 + cell.index;
        const gx = cx + Math.cos(angle)*u*.41, gy = cy + Math.sin(angle)*u*.41;
        const radius = u*(.036 + .019*(1+Math.sin(angle*2)));
        ctx.fillStyle = INK; ctx.fillRect(gx-radius-u*.012,gy-radius-u*.012,2*radius+u*.024,2*radius+u*.024);
        ctx.fillStyle = i % 2 ? GOLD : '#ffffff'; ctx.fillRect(gx-radius,gy-radius,2*radius,2*radius);
      }
    }
    // One burst per physical cell, even if it paid several owners.
    if (!reduced && burst > 0 && burst < 1) {
      const travel = ease(burst);
      ctx.globalAlpha = (1-burst) ** .55;
      ctx.strokeStyle = GOLD; ctx.lineWidth = u*.045*(1-burst)+1;
      const radius = u*(.12 + travel*.48);
      ctx.beginPath();ctx.moveTo(cx,cy-radius);ctx.lineTo(cx+radius,cy);ctx.lineTo(cx,cy+radius);ctx.lineTo(cx-radius,cy);ctx.closePath();ctx.stroke();
      if (burst < .45) {
        ctx.globalAlpha = Math.sin(Math.PI*clamp(burst/.45))*.86;
        ctx.fillStyle = PINK;diamond(ctx,cx,cy,u*.26*(1-burst));
        ctx.fillStyle = GOLD;diamond(ctx,cx,cy,u*.17*(1-burst));
        ctx.fillStyle = '#ffffff';diamond(ctx,cx,cy,u*.09*(1-burst));
      }
      ctx.globalAlpha = (1-burst)**.55;
      for (const particle of cell.particles) {
        const px = cx + Math.cos(particle.angle) * particle.speed * u * travel;
        const py = cy + Math.sin(particle.angle) * particle.speed * u * travel + burst*burst*u*.09;
        const size = Math.max(1, Math.round(particle.size*u*(1-burst*.65)));
        ctx.save();ctx.translate(Math.round(px),Math.round(py));ctx.rotate(particle.spin*burst);
        ctx.fillStyle=INK;ctx.fillRect(-size/2-1,-size/2-1,size+2,size+2);
        ctx.fillStyle=particle.color;ctx.fillRect(-size/2,-size/2,size,size);ctx.restore();
      }
    }
    ctx.restore();
  }
  // One legible award per actual mask, anchored in a unique winning cell.
  // The ordinary accessible result/HUD still lists each player's real total.
  for (const group of animation.groups) {
    if (group.anchor < 0) continue;
    const start = reduced ? 0 : animation.hold + 190;
    const end = animation.duration;
    const p = clamp((t - start) / (end - start));
    if (t < start || p >= 1) continue;
    const col = group.anchor % COLS, row = Math.floor(group.anchor / COLS);
    const x = col*w, y = row*h, cx = x+w/2, cy = y+h*(reduced ? (group.owners.length > 1 ? .75 : .84) : .66-.28*ease(p));
    const label = '+' + group.points.toLocaleString('en-US');
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    ctx.globalAlpha = reduced ? (1-clamp((t-animation.hold)/280)) : ease(p*7)*(1-clamp((p-.7)/.3));
    ctx.font = `900 ${Math.round(u*.218)}px Arial, sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    ctx.lineWidth=u*.044;ctx.strokeStyle=INK;ctx.fillStyle=GOLD;
    ctx.strokeText(label,cx,cy,w*.91);ctx.fillText(label,cx,cy,w*.91);
    if (group.owners.length > 1) {
      ctx.font=`900 ${Math.round(u*.10)}px Arial, sans-serif`;
      ctx.lineWidth=u*.027;ctx.strokeText('EACH',cx,cy+u*.15);ctx.fillText('EACH',cx,cy+u*.15);
    }
    ctx.restore();
  }
  ctx.restore();
}
