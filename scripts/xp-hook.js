#!/usr/bin/env node
/**
 * xp-hook.js — Hook handler pour SessionStart, PostToolUse et Stop
 *
 * Appelé par Claude Code via hooks.json.
 * Reçoit l'event en JSON sur stdin, accorde de l'XP, met à jour le state.
 * Le pet s'affiche en continu via le statusLine (statusline.js).
 * Doit être RAPIDE (< 500ms) — pas de réseau, pas de calcul lourd.
 *
 * Usage:
 *   node xp-hook.js                       ← PostToolUse
 *   node xp-hook.js --event=stop          ← Stop
 *   node xp-hook.js --event=session-start ← SessionStart
 */

'use strict';

const { loadState, saveState, appendLog, addXp, isMaxLevel, level,
        XP_TABLE, XP_SESSION_END } = require('./core.js');

const argv           = process.argv;
const isStop         = argv.includes('--event=stop');
const isSessionStart = argv.includes('--event=session-start');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    run(raw);
  } catch {
    // Silencieux — un hook qui plante ne doit pas bloquer Claude Code
    process.exit(0);
  }
});

function run(raw) {
  let event = {};
  try { event = JSON.parse(raw || '{}'); } catch {}

  if (isSessionStart) {
    // Incrémente le compteur de sessions sans toucher à l'XP
    const state = loadState();
    state.totalSessions = (state.totalSessions || 0) + 1;
    state.lastSessionAt = Date.now();
    saveState(state);
    appendLog({ event: 'session_start' });
    return;
  }

  const state = loadState();

  if (isStop) {
    handleStop(state, event);
  } else {
    handleToolUse(state, event);
  }
}

function handleToolUse(state, event) {
  const toolName  = event.tool_name || '';
  const toolInput = event.tool_input || {};
  let xpAmount    = XP_TABLE[toolName] ?? 0;
  if (xpAmount === 0) return;

  // Bonus fichiers test
  if (['Write', 'Edit', 'MultiEdit'].includes(toolName)) {
    const file = toolInput.file_path || toolInput.path || '';
    if (/(\.(test|spec)\.[a-z]+$)|([\\/](test|spec)s?[\\/])|(__tests__)/.test(file)) {
      xpAmount += 30;
    }
  }

  // Bonus git commit avec "fix" ou "bug"
  if (toolName === 'Bash') {
    const cmd = (toolInput.command || '').toLowerCase();
    if (cmd.includes('git commit') && (cmd.includes('fix') || cmd.includes('bug'))) {
      xpAmount += 80;
    }
  }

  // Tracking fichiers uniques dans la session
  if (['Write', 'Edit', 'MultiEdit'].includes(toolName)) {
    const file = toolInput.file_path || toolInput.path || '';
    if (file) {
      const sessionFiles = state.sessionFiles || [];
      if (!sessionFiles.includes(file)) {
        state.sessionFiles = [...sessionFiles, file];
      }
    }
  }

  const { state: updated, leveled, newLevel } = addXp(state, xpAmount);

  if (leveled) {
    updated.lastLevelUpAt = Date.now();
  }

  appendLog({ event: 'tool_use', tool: toolName, xp: xpAmount, level: newLevel });
  saveState(updated);

  if (leveled) {
    printLevelUp(newLevel, isMaxLevel(updated.xp));
  }
}

function handleStop(state, event) {
  let xpAmount = XP_SESSION_END;

  // Bonus multi-fichiers
  const sessionFiles = state.sessionFiles || [];
  if (sessionFiles.length >= 4) xpAmount += 300; // tâche complexe multi-fichiers
  else if (sessionFiles.length >= 2) xpAmount += 100;
  state.sessionFiles = []; // reset

  const { state: updated, leveled, newLevel } = addXp(state, xpAmount);

  if (leveled) {
    updated.lastLevelUpAt = Date.now();
  }

  appendLog({ event: 'session_end', xp: xpAmount, level: newLevel });
  saveState(updated);

  if (leveled) {
    printLevelUp(newLevel, isMaxLevel(updated.xp));
  }
}

function printLevelUp(newLevel, isMax) {
  if (isMax) {
    process.stdout.write([
      '',
      '  ╔══════════════════════════════╗',
      '  ║  ✨  LEVEL 100 REACHED  ✨   ║',
      '  ║                              ║',
      '  ║  Buddy est prêt à renaître.  ║',
      '  ║  Lance /buddy rebirth        ║',
      '  ╚══════════════════════════════╝',
      '',
    ].join('\n'));
  } else {
    process.stdout.write(
      `\n  ★  Buddy  →  Lv.\x1b[1m${newLevel}\x1b[0m  ↑\n`
    );
  }
}
