#!/usr/bin/env node
/**
 * display.js — Affiche Buddy
 * - Unix/WSL   : dessine dans le coin supérieur droit via /dev/tty
 * - Windows PS : affiche un bloc inline propre dans la conversation
 */

'use strict';

const { loadState, level, isMaxLevel,
        drawSidebar, canSidebar, renderInlineBlock } = require('./core.js');

const state = loadState();

if (canSidebar()) {
  // ── Unix / WSL ─────────────────────────────────────────────────────
  drawSidebar(state);
  const lvl = level(state.xp);
  process.stdout.write(
    `\n  \x1b[1mBuddy\x1b[0m affiché en haut à droite`
    + `  ·  Lv.\x1b[1m${lvl}\x1b[0m  ·  ${state.rebirths} rebirth(s)\n\n`
  );
} else {
  // ── Windows PowerShell ─────────────────────────────────────────────
  process.stdout.write(renderInlineBlock(state));

  if (!isMaxLevel(state.xp)) {
    process.stdout.write(
      `  \x1b[2mPour afficher Buddy en continu dans un terminal séparé :\x1b[0m\n`
      + `  \x1b[2mnode "%USERPROFILE%\\.claude\\plugins\\cache\\buddy-evolved\\buddy-evolved\\0.3.0\\scripts\\watch.js"\x1b[0m\n\n`
    );
  }
}
