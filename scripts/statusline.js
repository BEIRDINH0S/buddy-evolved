#!/usr/bin/env node
/**
 * statusline.js — Rendu Buddy pour la barre de statut Claude Code (Option C)
 *
 * Format :  ◈ BUDDY  LV.3  LÉGENDE  (^.^)  ▰▰▰▰▰▰▱▱▱▱▱▱  50/200 xp  ✦×20
 */

'use strict';

const { loadState, level, xpInLevel, xpForLevel, isMaxLevel,
        getTier, getPetLines, RAINBOW, RESET } = require('./core.js');

process.stdin.destroy(); // ferme stdin, Node quitte naturellement après stdout

const state  = loadState();
const lvl    = level(state.xp);
const tier   = getTier(state.rebirths);
const xpNow  = xpInLevel(state.xp);
const xpMax  = xpForLevel(state.xp);
const maxed  = isMaxLevel(state.xp);

// ─── Idle animation ───────────────────────────────────────────────────────────

const BLINK_INTERVAL = 4000; // ms entre les clignotements
const frame = Math.floor(Date.now() / BLINK_INTERVAL) % 2;

// Extrait la "face" depuis la ligne 1 du pet (les 5 chars centraux sur 7)
function extractFace(line) {
  // line est de la forme ' (o.o) ' (7 chars) → prend chars 1-5
  return line.slice(1, 6);
}

function animateFace(baseFace, frame) {
  if (frame === 0) return baseFace;
  // Remplace les yeux 'o' par '-' pour cligner
  return baseFace.replace(/o/g, '-');
}

let face;
if (state.lastLevelUpAt && (Date.now() - state.lastLevelUpAt < 5000)) {
  // Level up récent → visage excité
  face = '(^.^)';
} else {
  const petLines = getPetLines(state);
  const baseFace = extractFace(petLines[1]);
  face = animateFace(baseFace, frame);
}

// ─── Barre XP avec blocs ▰ / ▱ (12 blocs) ────────────────────────────────────

const pct    = maxed ? 12 : Math.floor((xpNow / xpMax) * 12);
const xpBar  = (maxed ? '\x1b[33m' : '\x1b[32m')
             + '▰'.repeat(pct) + RESET
             + '\x1b[90m' + '▱'.repeat(12 - pct) + RESET;

// Tier
const tierLabel = tier ? `  ${tier.color}${tier.name.toUpperCase()}${RESET}` : '';

// Étoiles : ✦×N coloré
const starCount = state.rebirths > 0
  ? `  ${tier?.color ?? RAINBOW[0]}${tier?.symbol ?? '★'}×${state.rebirths}${RESET}`
  : '';

// Infos XP
const xpInfo = maxed
  ? `  \x1b[33mREBIRTH → /buddy rebirth\x1b[0m`
  : `  ${xpBar}  \x1b[2m${xpNow}/${xpMax} xp\x1b[0m`;

const line = `  ◈ \x1b[1mBUDDY\x1b[0m  LV.\x1b[1m${lvl}\x1b[0m${tierLabel}  ${face}${xpInfo}${starCount}`;

process.stdout.write(line + '\n');
