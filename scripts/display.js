#!/usr/bin/env node
/**
 * display.js — Affiche Buddy dans le terminal
 * Appelé par la commande /buddy
 */

'use strict';

const { loadState, render, level, isMaxLevel } = require('./core.js');

const state = loadState();

const box = [
  '╔══════════════════════════════════╗',
  '║           B U D D Y              ║',
  '╚══════════════════════════════════╝',
].join('\n');

process.stdout.write('\n' + box + '\n');
process.stdout.write(render(state));

if (isMaxLevel(state.xp)) {
  process.stdout.write(
    '  Lance \x1b[33m/buddy rebirth\x1b[0m pour renaître avec une étoile.\n\n'
  );
}
