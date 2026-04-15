#!/usr/bin/env node
/**
 * display.js — Affiche Buddy dans le terminal
 * Appelé par la commande /buddy
 * - Dessine le panneau latéral en haut à droite (drawSidebar)
 * - Affiche aussi un résumé inline dans la conversation
 */

'use strict';

const { loadState, render, level, isMaxLevel, drawSidebar } = require('./core.js');

const state = loadState();

// 1. Dessine le pet dans le coin supérieur droit du terminal
drawSidebar(state);

// 2. Confirmation inline dans la conversation (minimaliste)
const lvl = level(state.xp);
process.stdout.write(
  `\n  \x1b[1mBuddy\x1b[0m est affiché en haut à droite  ·  Lv.\x1b[1m${lvl}\x1b[0m  ·  ${state.rebirths} rebirth(s)\n`
);
if (isMaxLevel(state.xp)) {
  process.stdout.write(
    `  \x1b[33m✨ REBIRTH AVAILABLE  →  /buddy rebirth\x1b[0m\n`
  );
}
process.stdout.write('\n');
