/**
 * core.js — Buddy Evolved shared logic
 * State management, XP system, ASCII rendering
 */

'use strict';

const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const crypto = require('crypto');

// ─── Paths ────────────────────────────────────────────────────────────────────

const DATA_DIR   = process.env.CLAUDE_PLUGIN_DATA
  || path.join(os.homedir(), '.claude', 'plugins', 'data', 'buddy-evolved');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const LOG_FILE   = path.join(DATA_DIR, 'log.jsonl');

// ─── XP Config ────────────────────────────────────────────────────────────────

const MAX_LEVEL = 100;

// XP nécessaire pour passer du level N au level N+1 (index 0 = level 1→2)
const LEVEL_THRESHOLDS = [];
for (let i = 0; i < 100; i++) {
  if      (i < 10) LEVEL_THRESHOLDS.push(200);
  else if (i < 25) LEVEL_THRESHOLDS.push(400);
  else if (i < 50) LEVEL_THRESHOLDS.push(800);
  else if (i < 75) LEVEL_THRESHOLDS.push(1500);
  else             LEVEL_THRESHOLDS.push(3000);
}

// CUMULATIVE_XP[n] = XP total pour atteindre le level n+1
const CUMULATIVE_XP = [0];
for (let i = 0; i < 100; i++) CUMULATIVE_XP.push(CUMULATIVE_XP[i] + LEVEL_THRESHOLDS[i]);

// XP granted by tool action (PostToolUse)
const XP_TABLE = {
  Write:     30,
  Edit:      30,
  MultiEdit: 40,
  Bash:      10,
  Agent:     25,
};
const XP_SESSION_END = 50;   // bonus à chaque Stop

// ─── Star Tiers ───────────────────────────────────────────────────────────────

const RESET = '\x1b[0m';

const STAR_TIERS = [
  { min: 1,  max: 4,        color: '\x1b[90m', symbol: '*',  name: 'Rookie'       }, // gris
  { min: 5,  max: 9,        color: '\x1b[33m', symbol: '★',  name: 'Vétéran'      }, // doré
  { min: 10, max: 14,       color: '\x1b[34m', symbol: '✦',  name: 'Élite'        }, // bleu
  { min: 15, max: 19,       color: '\x1b[35m', symbol: '✦',  name: 'Maître'       }, // violet
  { min: 20, max: 24,       color: '\x1b[31m', symbol: '★',  name: 'Légende'      }, // rouge
  { min: 25, max: Infinity, color: null,        symbol: '★',  name: 'Transcendant' }, // arc-en-ciel
];

const RAINBOW = ['\x1b[31m','\x1b[33m','\x1b[32m','\x1b[36m','\x1b[34m','\x1b[35m'];

function getTier(rebirths) {
  if (rebirths === 0) return null;
  return STAR_TIERS.find(t => rebirths >= t.min && rebirths <= t.max)
      || STAR_TIERS[STAR_TIERS.length - 1];
}

function colorStar(tier, index) {
  if (!tier) return ' ';
  const color = tier.color ?? RAINBOW[index % RAINBOW.length];
  return `${color}${tier.symbol}${RESET}`;
}

// ─── Pet ASCII Forms ──────────────────────────────────────────────────────────
// 4 espèces × 4 stades (level 1-24, 25-49, 50-74, 75+)
// Chaque ligne fait exactement 7 chars

const PET_FORMS = [
  // Espèce 0 — Classic
  [
    ['  .-.  ', ' (o.o) ', '  )|(  ', ' (_|_) '],
    ['  .-.  ', ' (^.^) ', '  )o(  ', ' (_|_) '],
    [' _.-._  '.slice(0,7), '(^. .^)', ' /)|(\\ ', ' (_|_) '],
    [' ~.-._  '.slice(0,7), '(>. .<)', ' /)|(\\ ', '/(_|_)\\'],
  ],
  // Espèce 1 — Blob
  [
    [' (~~~) ', ' (o.o) ', '  ) (  ', ' (___) '],
    [' (~~~) ', ' (^.^) ', '  ) (  ', ' (___) '],
    [' (~*~) ', ' (^o^) ', '  \\ /  ', ' (___) '],
    [' (*~*) ', ' (@o@) ', '  \\O/  ', ' (___) '],
  ],
  // Espèce 2 — Spike
  [
    [' /\\_/\\ ', ' (o.o) ', '  <|>  ', ' |\\_/| '],
    [' /\\*/\\ ', ' (^.^) ', '  <|>  ', ' |\\_/| '],
    [' /*\\*/ ', ' (^-^) ', ' /<|>\\ ', ' |/*\\| '],
    [' /***\\ ', ' (@-@) ', ' /<*>\\ ', ' |/+\\| '],
  ],
  // Espèce 3 — Angel
  [
    ['  ~~~  ', ' (o.o) ', '  \\|/  ', '  /|\\  '],
    ['  ~*~  ', ' (^.^) ', '  \\|/  ', '  /|\\  '],
    ['  ~*~  ', ' (^v^) ', ' ~\\|/~ ', '  /|\\  '],
    [' ~***~ ', ' (^v^) ', ' ~\\*/~ ', ' ~/|\\~ '],
  ],
];

const PET_WIDTH = 7; // largeur d'une ligne du pet

function getPetLines(state) {
  const species = (state.seed || 0) % 4;
  const lvl     = level(state.xp);
  const stage   = lvl < 25 ? 0 : lvl < 50 ? 1 : lvl < 75 ? 2 : 3;
  return PET_FORMS[species][stage];
}

// ─── State ────────────────────────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function defaultState() {
  return {
    xp:            0,
    rebirths:      0,
    totalXpEver:   0,
    totalSessions: 0,
    seed:          Math.floor(Math.random() * 1_000_000),
    createdAt:     Date.now(),
    lastSessionAt: null,
  };
}

function loadState() {
  ensureDataDir();
  if (!fs.existsSync(STATE_FILE)) {
    const s = defaultState();
    saveState(s);
    return s;
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function appendLog(entry) {
  ensureDataDir();
  const signed = signEntry({ ts: Date.now(), ...entry });
  fs.appendFileSync(LOG_FILE, JSON.stringify(signed) + '\n');
}

// ─── XP / Level ───────────────────────────────────────────────────────────────

function level(xp) {
  // Cherche le level tel que CUMULATIVE_XP[level] <= xp < CUMULATIVE_XP[level+1]
  let lvl = 0;
  for (let i = 1; i <= MAX_LEVEL; i++) {
    if (xp >= CUMULATIVE_XP[i]) lvl = i;
    else break;
  }
  return Math.min(lvl + 1, MAX_LEVEL); // level 1-based
}

function xpInLevel(xp) {
  const lvl = level(xp);
  if (lvl >= MAX_LEVEL) return LEVEL_THRESHOLDS[MAX_LEVEL - 1];
  // CUMULATIVE_XP[lvl-1] = XP total pour atteindre le level lvl
  return xp - CUMULATIVE_XP[lvl - 1];
}

function xpForLevel(xp) {
  const lvl = level(xp);
  if (lvl >= MAX_LEVEL) return LEVEL_THRESHOLDS[MAX_LEVEL - 1];
  return LEVEL_THRESHOLDS[lvl - 1];
}

function isMaxLevel(xp) {
  return level(xp) >= MAX_LEVEL;
}

// Ajoute de l'XP au state, retourne { state, leveled, newLevel, prevLevel }
function addXp(state, amount) {
  const prevLevel = level(state.xp);
  state.xp          += amount;
  state.totalXpEver += amount;
  const newLevel = level(state.xp);
  return { state, leveled: newLevel > prevLevel, newLevel, prevLevel };
}

// ─── Anti-cheat ───────────────────────────────────────────────────────────────

function getMachineKey() {
  const fingerprint = `${os.hostname()}-${os.userInfo().username}`;
  return crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 32);
}

function signEntry(entry) {
  const key = getMachineKey();
  const sig = crypto.createHmac('sha256', key)
    .update(JSON.stringify(entry))
    .digest('hex')
    .slice(0, 16);
  return { ...entry, sig };
}

function checkPlausibility(state) {
  if (!state.createdAt) return true;
  const daysSince   = (Date.now() - state.createdAt) / 86_400_000;
  const maxXpPerDay = 8000;
  return state.totalXpEver <= Math.max(daysSince * maxXpPerDay, 10000);
}

// ─── Star rendering ───────────────────────────────────────────────────────────

/**
 * Construit une ligne de N étoiles colorées, centrée sur PET_WIDTH + 2 (marges)
 */
function starRow(count, tier, indexOffset = 0) {
  if (count <= 0) return '';
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push(colorStar(tier, indexOffset + i));
  }
  const content = stars.join(' ');
  return content;
}

/**
 * Distribue `rebirths` étoiles en blocs de max MAX_PER_ROW par ligne
 * Retourne { topRows, botRows } — tableaux de lignes de texte
 */
function buildStarLayout(rebirths, tier) {
  if (rebirths === 0) return { topRows: [], botRows: [] };

  const MAX_PER_ROW = 9;
  const half = Math.ceil(rebirths / 2);
  const topCount = half;
  const botCount = rebirths - half;

  function toRows(total, offset) {
    const rows = [];
    let remaining = total;
    let idx = offset;
    while (remaining > 0) {
      const n = Math.min(remaining, MAX_PER_ROW);
      rows.push(starRow(n, tier, idx));
      remaining -= n;
      idx += n;
    }
    return rows;
  }

  return {
    topRows: toRows(topCount, 0).reverse(), // plus proche du pet = dernière ligne
    botRows: toRows(botCount, topCount),
  };
}

// ─── Full render ──────────────────────────────────────────────────────────────

function render(state) {
  const { xp, rebirths } = state;
  const lvl      = level(xp);
  const tier     = getTier(rebirths);
  const petLines = getPetLines(state);
  const { topRows, botRows } = buildStarLayout(rebirths, tier);

  const INDENT = '  ';
  const lines  = [];

  // Étoiles du dessus
  for (const row of topRows) lines.push(INDENT + row);
  if (topRows.length) lines.push('');

  // Pet
  for (const pl of petLines) lines.push(INDENT + pl);

  // Étoiles du dessous
  if (botRows.length) lines.push('');
  for (const row of botRows) lines.push(INDENT + row);

  lines.push('');

  // Status bar
  const tierLabel = tier ? `  ${tier.color}${tier.name}${RESET}` : '';
  lines.push(`${INDENT}\x1b[1mBuddy\x1b[0m  ·  Lv.\x1b[1m${lvl}\x1b[0m${tierLabel}`);
  lines.push(`${INDENT}Rebirths: \x1b[1m${rebirths}\x1b[0m`);
  lines.push('');

  if (isMaxLevel(xp)) {
    lines.push(`${INDENT}\x1b[33m✨ REBIRTH AVAILABLE  →  /buddy rebirth\x1b[0m`);
  } else {
    const xpNow   = xpInLevel(xp);
    const xpNeeded = xpForLevel(xp);
    const filled  = Math.floor((xpNow / xpNeeded) * 20);
    const bar     = '\x1b[32m' + '█'.repeat(filled) + RESET + '░'.repeat(20 - filled);
    lines.push(`${INDENT}XP  [${bar}]  ${xpNow}/${xpNeeded}`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Rendu inline pour /buddy — Option B : pet entouré d'un anneau d'étoiles.
 *
 * L'anneau a 22 positions (clockwise depuis le haut-gauche) :
 *   top  L→R  : 0-4   (5 pos)
 *   right T→B : 5-10  (6 pos)
 *   bot  R→L  : 11-15 (5 pos, affichés L→R comme 15,14,13,12,11)
 *   left B→T  : 16-21 (6 pos, affichés T→B comme 21,20,19,18,17,16)
 *
 * Affichage par row :
 *   top    :  S(0)  S(1)  S(2)  S(3)  S(4)
 *   row 1  :  S(21)                   S(5)
 *   pet[0] :  S(20)  .-.              S(6)
 *   pet[1] :  S(19) (o.o)             S(7)
 *   pet[2] :  S(18)  )|(              S(8)
 *   pet[3] :  S(17) (_|_)             S(9)
 *   row 6  :  S(16)                   S(10)
 *   bot    :  S(15) S(14) S(13) S(12) S(11)
 */
function renderInlineBlock(state) {
  const INDENT = '  ';
  const { xp, rebirths } = state;
  const lvl      = level(xp);
  const tier     = getTier(rebirths);
  const petLines = getPetLines(state);
  const sym      = (tier && tier.symbol) || '★';

  const RING_MAX = 22;
  const filled   = Math.min(rebirths, RING_MAX);
  const extra    = rebirths > RING_MAX ? rebirths - RING_MAX : 0;

  // Retourne une étoile colorée (2 chars visuels) ou 2 espaces si vide
  function S(pos) {
    if (pos >= filled) return '  ';
    const c = (tier && tier.color) || RAINBOW[pos % RAINBOW.length];
    return `${c}${sym}${RESET} `;
  }

  // Étoile 1 char (sans espace) pour les rangées top/bottom
  function T(pos) {
    if (pos >= filled) return ' ';
    const c = (tier && tier.color) || RAINBOW[pos % RAINBOW.length];
    return `${c}${sym}${RESET}`;
  }

  const lines = [''];

  lines.push(`${INDENT}   ${T(0)} ${T(1)} ${T(2)} ${T(3)} ${T(4)}   `);
  lines.push(`${INDENT}${S(21)}           ${S(5)}`);
  lines.push(`${INDENT}${S(20)}  ${petLines[0]}  ${S(6)}`);
  lines.push(`${INDENT}${S(19)}  ${petLines[1]}  ${S(7)}`);
  lines.push(`${INDENT}${S(18)}  ${petLines[2]}  ${S(8)}`);
  lines.push(`${INDENT}${S(17)}  ${petLines[3]}  ${S(9)}`);
  lines.push(`${INDENT}${S(16)}           ${S(10)}`);
  lines.push(`${INDENT}   ${T(15)} ${T(14)} ${T(13)} ${T(12)} ${T(11)}   `);

  if (extra > 0) {
    lines.push(`${INDENT}      \x1b[90m+${extra} étoiles\x1b[0m`);
  }

  lines.push('');

  const tierStr = tier ? ` · ${tier.color}${tier.name}${RESET}` : '';
  lines.push(`${INDENT}\x1b[1mBuddy\x1b[0m  ·  Lv.\x1b[1m${lvl}\x1b[0m${tierStr}`);

  if (isMaxLevel(xp)) {
    lines.push(`${INDENT}\x1b[33m✨ REBIRTH AVAILABLE  →  /buddy rebirth\x1b[0m`);
  } else {
    const xpNow    = xpInLevel(xp);
    const xpNeeded = xpForLevel(xp);
    const pct      = Math.floor((xpNow / xpNeeded) * 20);
    const bar      = '\x1b[32m' + '█'.repeat(pct) + RESET + '░'.repeat(20 - pct);
    lines.push(`${INDENT}[${bar}]  ${xpNow}/${xpNeeded} xp`);
  }

  lines.push('');
  return lines.join('\n');
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  DATA_DIR, STATE_FILE, LOG_FILE,
  XP_TABLE, XP_SESSION_END, MAX_LEVEL,
  LEVEL_THRESHOLDS, CUMULATIVE_XP,
  loadState, saveState, appendLog,
  level, xpInLevel, xpForLevel, isMaxLevel, addXp,
  getTier, getPetLines, render, renderInlineBlock,
  getMachineKey, signEntry, checkPlausibility,
  RAINBOW, RESET,
};
