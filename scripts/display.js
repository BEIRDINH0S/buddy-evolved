#!/usr/bin/env node
/**
 * display.js — Affiche Buddy inline + configure le statusLine si besoin
 *
 * Appelé par /buddy.
 * 1. Configure ~/.claude/settings.json (statusLine) → idempotent
 * 2. Affiche le bloc Buddy dans la conversation
 */

'use strict';

const { setup }              = require('./setup-statusline.js');
const { loadState, renderInlineBlock } = require('./core.js');

// Configure statusLine (idempotent, silencieux si déjà fait)
const configured = setup();

// Affiche le bloc Buddy dans la conversation
const state = loadState();
process.stdout.write(renderInlineBlock(state));

// Petit message si on vient de configurer le statusLine pour la 1ère fois
if (configured) {
  process.stdout.write(
    '\n  \x1b[32m✓\x1b[0m  Buddy est maintenant affiché sous la zone de saisie.\n'
    + '  \x1b[2m(Si la barre n\'apparaît pas, redémarre Claude Code)\x1b[0m\n\n'
  );
}
