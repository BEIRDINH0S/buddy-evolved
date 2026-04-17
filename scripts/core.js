/**
 * core.js — Buddy Evolved shared logic
 * State management, XP system, ASCII rendering
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ─── Paths ────────────────────────────────────────────────────────────────────

const DATA_DIR   = process.env.CLAUDE_PLUGIN_DATA
  || path.join(os.homedir(), '.claude', 'plugins', 'data', 'buddy-evolved');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const LOG_FILE   = path.join(DATA_DIR, 'log.jsonl');

// ─── XP Config ────────────────────────────────────────────────────────────────

const XP_PER_LEVEL = 100;   // linear: 100 XP par level
const MAX_LEVEL    = 100;

// XP granted by tool action (PostToolUse)
const XP_TABLE = {
  Write:      20,
  Edit:       20,
  MultiEdit:  25,
  Bash:        5,
  Agent:      15,  // spawning a subagent = work done
};
const XP_SESSION_END = 30;   // bonus à chaque Stop

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

// ─── Pet ASCII forms ──────────────────────────────────────────────────────────
// Forme de base, sera étendue plus tard avec le système d'évolution visuelle

const PET_LINES = [
  '  .-.  ',
  ' (o.o) ',
  '  )|(  ',
  ' (_|_) ',
];

const PET_WIDTH = 7; // largeur d'une ligne du pet

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
  fs.appendFileSync(LOG_FILE, JSON.stringify({ ts: Date.now(), ...entry }) + '\n');
}

// ─── XP / Level ───────────────────────────────────────────────────────────────

function level(xp) {
  return Math.min(Math.floor(xp / XP_PER_LEVEL), MAX_LEVEL);
}

function xpInLevel(xp) {
  const lvl = level(xp);
  if (lvl >= MAX_LEVEL) return XP_PER_LEVEL;
  return xp - lvl * XP_PER_LEVEL;
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
  // padding pour centrer autour du pet
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
  const lvl  = level(xp);
  const tier = getTier(rebirths);
  const { topRows, botRows } = buildStarLayout(rebirths, tier);

  const INDENT = '  ';
  const lines  = [];

  // Étoiles du dessus
  for (const row of topRows) lines.push(INDENT + row);
  if (topRows.length) lines.push('');

  // Pet
  for (const pl of PET_LINES) lines.push(INDENT + pl);

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
    const filled = Math.floor((xpInLevel(xp) / XP_PER_LEVEL) * 20);
    const bar    = '\x1b[32m' + '█'.repeat(filled) + RESET + '░'.repeat(20 - filled);
    lines.push(`${INDENT}XP  [${bar}]  ${xpInLevel(xp)}/${XP_PER_LEVEL}`);
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
  const lvl  = level(xp);
  const tier = getTier(rebirths);
  const sym  = (tier && tier.symbol) || '★';

  const RING_MAX = 22;
  const filled   = Math.min(rebirths, RING_MAX);
  const extra    = rebirths > RING_MAX ? rebirths - RING_MAX : 0;

  // Retourne une étoile colorée (2 chars visuels) ou 2 espaces si vide
  function S(pos) {
    if (pos >= filled) return '  ';
    const c = (tier && tier.color) || RAINBOW[pos % RAINBOW.length];
    return `${c}${sym}${RESET} `;
  }

  // Inner width = 14 chars (2 sp + 7 pet + 5 sp).
  // Top/bot : 5 étoiles = 10 chars, centré dans 14 → 2 chars de marge chaque côté.
  // Le tout est précédé de INDENT (2) + side star (2) pour les lignes latérales,
  // et de INDENT (2) + 4 espaces pour les lignes top/bot.
  // Étoile 1 char (sans espace) pour les rangées top/bottom
  function T(pos) {
    if (pos >= filled) return ' ';
    const c = (tier && tier.color) || RAINBOW[pos % RAINBOW.length];
    return `${c}${sym}${RESET}`;
  }

  // Layout (17 chars visuels par rangée latérale) :
  //   side row : INDENT(2) + S(2) + inner(11) + S(2) = 17
  //   pet  row : INDENT(2) + S(2) + 2sp + PET(7) + 2sp + S(2) = 17  ← centré
  //   top/bot  : INDENT(2) + 3sp + T(1+sp)×5 + 3sp = 17              ← centré

  const lines = [''];

  lines.push(`${INDENT}   ${T(0)} ${T(1)} ${T(2)} ${T(3)} ${T(4)}   `);
  lines.push(`${INDENT}${S(21)}           ${S(5)}`);
  lines.push(`${INDENT}${S(20)}  ${PET_LINES[0]}  ${S(6)}`);
  lines.push(`${INDENT}${S(19)}  ${PET_LINES[1]}  ${S(7)}`);
  lines.push(`${INDENT}${S(18)}  ${PET_LINES[2]}  ${S(8)}`);
  lines.push(`${INDENT}${S(17)}  ${PET_LINES[3]}  ${S(9)}`);
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
    const pct = Math.floor((xpInLevel(xp) / XP_PER_LEVEL) * 20);
    const bar = '\x1b[32m' + '█'.repeat(pct) + RESET + '░'.repeat(20 - pct);
    lines.push(`${INDENT}[${bar}]  ${xpInLevel(xp)}/${XP_PER_LEVEL} xp`);
  }

  lines.push('');
  return lines.join('\n');
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  DATA_DIR, STATE_FILE, LOG_FILE,
  XP_TABLE, XP_SESSION_END, MAX_LEVEL,
  loadState, saveState, appendLog,
  level, xpInLevel, isMaxLevel, addXp,
  getTier, render, renderInlineBlock,
  RAINBOW, RESET,
};
