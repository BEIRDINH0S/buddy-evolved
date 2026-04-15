#!/usr/bin/env node
/**
 * watch.js — Buddy en temps réel dans un terminal séparé
 *
 * Lance ce script dans une fenêtre/pane à côté de Claude Code.
 * Il rafraîchit l'affichage à chaque changement de state (XP, level, rebirth).
 *
 * Usage :
 *   node watch.js
 *
 * Windows Terminal (split pane) :
 *   wt -w 0 sp -s 0.25 node "chemin\watch.js"
 *
 * tmux :
 *   tmux split-window -h "node chemin/watch.js"
 */

'use strict';

const fs   = require('fs');
const { loadState, renderInlineBlock, STATE_FILE } = require('./core.js');

const REFRESH_MS = 500; // intervalle de polling si fs.watch indisponible

// Alternate screen buffer : entre dans un écran propre, revient à la sortie
process.stdout.write('\x1b[?1049h'); // enter alternate screen
process.stdout.write('\x1b[?25l');   // masque le curseur

process.on('SIGINT',  cleanup);
process.on('SIGTERM', cleanup);
process.on('exit',    cleanup);

function cleanup() {
  process.stdout.write('\x1b[?25h');   // affiche le curseur
  process.stdout.write('\x1b[?1049l'); // exit alternate screen
  process.exit(0);
}

function draw() {
  const state = loadState();
  process.stdout.write('\x1b[H\x1b[2J'); // clear screen
  process.stdout.write(renderInlineBlock(state));
  process.stdout.write('\n  \x1b[2mCTRL+C pour quitter\x1b[0m\n');
}

// Premier rendu
draw();

// Watch le fichier state pour redessiner dès qu'il change
let watching = false;
try {
  fs.watch(STATE_FILE, () => draw());
  watching = true;
} catch {}

// Fallback polling si fs.watch ne fonctionne pas
if (!watching) {
  let lastMtime = 0;
  setInterval(() => {
    try {
      const mtime = fs.statSync(STATE_FILE).mtimeMs;
      if (mtime !== lastMtime) { lastMtime = mtime; draw(); }
    } catch {}
  }, REFRESH_MS);
}
