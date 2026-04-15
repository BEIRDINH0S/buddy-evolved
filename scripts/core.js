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

// ─── Sidebar (dessin direct sur le terminal) ──────────────────────────────────

const SIDEBAR_W = 24; // largeur totale du panneau

/**
 * Ouvre un file descriptor direct vers le terminal (sync).
 * Contourne stdout pipé. Fonctionne sur macOS, Linux, WSL et Windows natif.
 * Retourne un objet { write(str), end() } ou null si pas de TTY dispo.
 */
function openTTY() {
  const candidates = process.platform === 'win32'
    ? ['\\\\.\\CONOUT$', '/dev/tty', '/dev/stderr']
    : ['/dev/tty', '/dev/stderr'];
  for (const p of candidates) {
    try {
      const fd = fs.openSync(p, 'w');
      return {
        write: (str) => { try { fs.writeSync(fd, str); } catch {} },
        end:   ()    => { try { fs.closeSync(fd);       } catch {} },
      };
    } catch {}
  }
  return null;
}

/**
 * Retourne la largeur du terminal (avec fallbacks successifs).
 */
function termCols() {
  return process.stdout.columns
      || parseInt(process.env.COLUMNS || '')
      || parseInt(process.env.TERM_WIDTH || '')
      || 120;
}

/**
 * Construit les lignes du panneau latéral (24 chars de large).
 * Format compact : pet + barre XP + étoiles.
 */
function sidebarLines(state) {
  const { xp, rebirths } = state;
  const lvl  = level(xp);
  const tier = getTier(rebirths);
  const W    = SIDEBAR_W;

  // Barre XP compacte (10 blocs)
  const pct    = isMaxLevel(xp) ? 10 : Math.floor((xpInLevel(xp) / XP_PER_LEVEL) * 10);
  const bar    = (isMaxLevel(xp) ? '\x1b[33m' : '\x1b[32m')
               + '█'.repeat(pct) + RESET + '░'.repeat(10 - pct);

  // Étoiles (max 2 lignes de 8)
  const starLines = [];
  if (rebirths > 0) {
    const sym  = tier ? tier.symbol : '*';
    const col  = tier ? (tier.color ?? RAINBOW[0]) : '\x1b[90m';
    const star = `${col}${sym}${RESET}`;
    const row1 = Math.min(rebirths, 8);
    const row2 = Math.max(0, rebirths - 8);
    starLines.push(Array.from({ length: row1 }, (_, i) => {
      const c = tier?.color ?? RAINBOW[i % RAINBOW.length];
      return `${c}${sym}${RESET}`;
    }).join(' '));
    if (row2 > 0) {
      starLines.push(Array.from({ length: Math.min(row2, 8) }, (_, i) => {
        const c = tier?.color ?? RAINBOW[(row1 + i) % RAINBOW.length];
        return `${c}${sym}${RESET}`;
      }).join(' '));
    }
  }

  const tierName  = tier ? `${tier.color}${tier.name}${RESET}` : '';
  const lvlStr    = `Lv.\x1b[1m${lvl}\x1b[0m`;
  const rebStr    = rebirths > 0 ? ` ·${rebirths}✦` : '';

  const lines = [
    `╭${'─'.repeat(W - 2)}╮`,
    `│\x1b[1m  Buddy\x1b[0m${rebStr.padEnd(W - 9)}│`,
    `│${''.padEnd(W - 2)}│`,
    ...PET_LINES.map(l => `│${l.padEnd(W - 2)}│`),
    `│${''.padEnd(W - 2)}│`,
    `│  ${lvlStr}${tierName ? '  ' + tierName : ''}${''.padEnd(0)}│`,
    `│  [${bar}]${''.padEnd(0)}│`,
    `│${''.padEnd(W - 2)}│`,
    ...starLines.map(s => `│  ${s}${''.padEnd(0)}│`),
    ...(isMaxLevel(xp) ? [`│  \x1b[33m✨ /buddy rebirth\x1b[0m  │`] : []),
    `╰${'─'.repeat(W - 2)}╯`,
  ];

  return lines;
}

/**
 * Dessine le pet dans le coin supérieur droit du terminal.
 * Écrit directement sur /dev/tty (Unix) ou CONOUT$ (Windows)
 * pour ne pas polluer stdout pipé de Claude Code.
 */
function drawSidebar(state) {
  const cols = termCols();
  if (cols < SIDEBAR_W + 10) return; // terminal trop étroit

  const tty = openTTY();
  if (!tty) return;

  const startCol = cols - SIDEBAR_W + 1;
  const lines    = sidebarLines(state);

  let out = '';
  out += '\x1b[s';    // save cursor
  out += '\x1b[?7l';  // disable line wrap

  lines.forEach((line, i) => {
    out += `\x1b[${i + 1};${startCol}H`; // position absolue
    out += line;
  });

  out += '\x1b[?7h';  // re-enable line wrap
  out += '\x1b[u';    // restore cursor

  tty.write(out);
  tty.end();
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  DATA_DIR, STATE_FILE, LOG_FILE,
  XP_TABLE, XP_SESSION_END, MAX_LEVEL,
  loadState, saveState, appendLog,
  level, xpInLevel, isMaxLevel, addXp,
  getTier, render, drawSidebar,
};
