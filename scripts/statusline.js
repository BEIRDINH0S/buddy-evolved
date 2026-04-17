#!/usr/bin/env node
/**
 * statusline.js — Rendu Buddy pour la barre de statut Claude Code (Option C)
 *
 * Format :  ◈ BUDDY  LV.3  LÉGENDE  ▰▰▰▰▰▰▱▱▱▱▱▱  50 xp  ✦×20
 */

'use strict';

const { loadState, level, xpInLevel, isMaxLevel,
        getTier, RAINBOW, RESET } = require('./core.js');

process.stdin.destroy(); // ferme stdin, Node quitte naturellement après stdout

const state  = loadState();
const lvl    = level(state.xp);
const tier   = getTier(state.rebirths);
const xpLeft = xpInLevel(state.xp);
const maxed  = isMaxLevel(state.xp);

// Barre XP avec blocs ▰ / ▱ (12 blocs)
const pct    = maxed ? 12 : Math.floor((xpLeft / 100) * 12);
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
  : `  ${xpBar}  \x1b[2m${xpLeft} xp\x1b[0m`;

const line = `  ◈ \x1b[1mBUDDY\x1b[0m  LV.\x1b[1m${lvl}\x1b[0m${tierLabel}${xpInfo}${starCount}`;

process.stdout.write(line + '\n');
