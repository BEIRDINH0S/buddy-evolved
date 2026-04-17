#!/usr/bin/env node
/**
 * rebirth.js — Logique de Rebirth
 *
 * Usage:
 *   node rebirth.js           ← affiche l'écran de confirmation
 *   node rebirth.js --confirm ← exécute le rebirth
 */

'use strict';

const { loadState, saveState, appendLog, render,
        level, isMaxLevel, getTier, MAX_LEVEL, RESET } = require('./core.js');

const CONFIRM = process.argv.includes('--confirm');
const state   = loadState();

if (!isMaxLevel(state.xp)) {
  // Pas encore level 100
  const lvl = level(state.xp);
  process.stdout.write([
    '',
    '  Buddy n\'est pas encore prêt.',
    `  Level actuel : \x1b[1m${lvl}\x1b[0m / ${MAX_LEVEL}`,
    '',
  ].join('\n'));
  process.exit(0);
}

if (!CONFIRM) {
  showConfirmationScreen(state);
} else {
  doRebirth(state);
}

// ─── Écran de confirmation ─────────────────────────────────────────────────────

function showConfirmationScreen(state) {
  const nextRebirths = state.rebirths + 1;
  const nextTier     = getTier(nextRebirths);
  const tierMsg      = nextTier
    ? `  Tes étoiles passeront en \x1b[1m${nextTier.color || '\x1b[0m'}${nextTier.name}\x1b[0m.`
    : '';

  const days = state.createdAt
    ? Math.floor((Date.now() - state.createdAt) / 86_400_000)
    : '?';

  const lines = [
    '',
    '  ╔════════════════════════════════════╗',
    '  ║      ✨  REBIRTH AVAILABLE  ✨     ║',
    '  ╠════════════════════════════════════╣',
   `  ║  Sessions  : ${String(state.totalSessions).padEnd(21)}║`,
   `  ║  Jours     : ${String(days).padEnd(21)}║`,
   `  ║  XP total  : ${String(state.totalXpEver).padEnd(21)}║`,
   `  ║  Rebirths  : ${String(state.rebirths).padEnd(21)}║`,
    '  ╠════════════════════════════════════╣',
    '  ║  Sa forme sera préservée.          ║',
   `  ║  +1 étoile s\'ajoutera autour.      ║`,
    '  ╚════════════════════════════════════╝',
    '',
  ];

  if (tierMsg) lines.push(tierMsg, '');

  lines.push(
    '  Pour confirmer :',
    '  \x1b[33m/buddy rebirth confirm\x1b[0m',
    '',
  );

  process.stdout.write(lines.join('\n'));
}

// ─── Exécution du Rebirth ──────────────────────────────────────────────────────

function doRebirth(state) {
  const prevRebirths = state.rebirths;
  const prevXp       = state.xp;

  // Reset
  state.xp       = 0;
  state.rebirths = prevRebirths + 1;

  appendLog({
    event:         'rebirth',
    rebirthNumber: state.rebirths,
    xpAtRebirth:   prevXp,
  });

  saveState(state);

  const prevTier = getTier(prevRebirths);
  const newTier  = getTier(state.rebirths);

  const lines = [
    '',
    '  ╔════════════════════════════════════╗',
   `  ║   ✨  REBIRTH #${String(state.rebirths).padEnd(20)}║`,
    '  ╠════════════════════════════════════╣',
    '  ║  Buddy renaît.                     ║',
    '  ║  Sa forme est préservée.           ║',
    '  ║  Une étoile s\'est ajoutée.        ║',
    '  ╚════════════════════════════════════╝',
  ];

  // Milestone tier
  if (newTier && (!prevTier || newTier.name !== prevTier.name)) {
    lines.push(
      '',
      `  ╔══════════════════════════════════╗`,
      `  ║  ${newTier.color}★ ${newTier.name.toUpperCase()} TIER REACHED${RESET}           ║`,
      `  ║  Tes étoiles brillent autrement. ║`,
      `  ╚══════════════════════════════════╝`,
    );
  }

  lines.push('', render(state));

  process.stdout.write(lines.join('\n'));
}
