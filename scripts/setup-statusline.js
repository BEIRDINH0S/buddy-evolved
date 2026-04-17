#!/usr/bin/env node
/**
 * setup-statusline.js — Configure Claude Code statusLine pour Buddy
 *
 * Écrit la config dans :
 *   - ~/.claude/settings.json  (global)
 *   - <cwd>/.claude/settings.json  (projet courant)
 *
 * Sur Windows, Claude Code lance les commandes statusLine via Git Bash,
 * donc on utilise le format de chemin Unix (/c/Users/...).
 *
 * Idempotent — ne ré-écrit que si la config est absente ou différente.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ─── Chemin Unix (Git Bash) ───────────────────────────────────────────────────

function toGitBashPath(p) {
  // C:\Users\... → /c/Users/...
  return p
    .replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`)
    .replace(/\\/g, '/');
}

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT
  || path.resolve(__dirname, '..');

const SCRIPT_UNIX = toGitBashPath(path.join(PLUGIN_ROOT, 'scripts', 'statusline.js'));
const CMD = `node "${SCRIPT_UNIX}"`;

const STATUS_LINE_CONFIG = {
  type:            'command',
  command:         CMD,
  refreshInterval: 1,
};

// ─── Fichiers à mettre à jour ─────────────────────────────────────────────────

function settingsFiles() {
  const files = new Set();
  files.add(path.join(os.homedir(), '.claude', 'settings.json'));

  // Projet courant (là où l'utilisateur lance claude)
  const proj = path.join(process.cwd(), '.claude', 'settings.json');
  files.add(proj);

  return [...files];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function load(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function write(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ─── Setup ────────────────────────────────────────────────────────────────────

function setup() {
  let changed = false;
  for (const file of settingsFiles()) {
    const s = load(file);
    if (s.statusLine?.command === CMD) continue;
    s.statusLine = STATUS_LINE_CONFIG;
    write(file, s);
    changed = true;
  }
  return changed;
}

if (require.main === module) {
  const changed = setup();
  if (changed) {
    process.stdout.write(
      '  \x1b[32m✓\x1b[0m  statusLine configuré → Buddy apparaîtra sous la zone de saisie\n'
      + '  \x1b[2m(Redémarre Claude Code si la barre n\'apparaît pas)\x1b[0m\n'
    );
  } else {
    process.stdout.write('  \x1b[2m(statusLine déjà configuré)\x1b[0m\n');
  }
}

module.exports = { setup };
