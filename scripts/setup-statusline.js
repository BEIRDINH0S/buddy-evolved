#!/usr/bin/env node
/**
 * setup-statusline.js — Configure Claude Code statusLine pour Buddy
 *
 * Modifie ~/.claude/settings.json pour pointer vers statusline.js.
 * Idempotent : ne ré-écrit que si la config est absente ou différente.
 * Peut être appelé en require() ou directement via node.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const SETTINGS_FILE = path.join(os.homedir(), '.claude', 'settings.json');

// CLAUDE_PLUGIN_ROOT est défini quand on tourne dans un contexte plugin.
// Sinon on dérive depuis __dirname (scripts/ → racine du plugin).
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT
  || path.resolve(__dirname, '..');

// Chemin absolu vers statusline.js — sera écrit dans settings.json.
// On normalise les backslashes pour la portabilité.
const STATUSLINE_SCRIPT = path.join(PLUGIN_ROOT, 'scripts', 'statusline.js');

function buildCommand() {
  // Sur Windows les espaces dans le chemin nécessitent des guillemets.
  const quoted = STATUSLINE_SCRIPT.includes(' ')
    ? `"${STATUSLINE_SCRIPT}"`
    : STATUSLINE_SCRIPT;
  return `node ${quoted}`;
}

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function setup() {
  const cmd      = buildCommand();
  const settings = loadSettings();

  // Déjà configuré correctement → rien à faire
  if (settings.statusLine?.command === cmd) return false;

  settings.statusLine = { type: 'command', command: cmd };

  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  return true;
}

// Point d'entrée : affiche un message quand lancé directement,
// silencieux quand require()d depuis display.js.
if (require.main === module) {
  const changed = setup();
  if (changed) {
    process.stdout.write(
      '  \x1b[32m✓\x1b[0m  statusLine configuré → Buddy apparaîtra sous la zone de saisie\n'
      + '  \x1b[2m(Redémarre Claude Code si la barre n\'apparaît pas immédiatement)\x1b[0m\n'
    );
  } else {
    process.stdout.write('  \x1b[2m(statusLine déjà configuré — rien à faire)\x1b[0m\n');
  }
}

module.exports = { setup };
