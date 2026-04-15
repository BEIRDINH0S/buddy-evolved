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
  const toolName = event.tool_name || '';
  const xpAmount = XP_TABLE[toolName] ?? 0;
  if (xpAmount === 0) return;

  const { state: updated, leveled, newLevel } = addXp(state, xpAmount);

  appendLog({ event: 'tool_use', tool: toolName, xp: xpAmount, level: newLevel });
  saveState(updated);

  if (leveled) {
    printLevelUp(newLevel, isMaxLevel(updated.xp));
  }
}

function handleStop(state, event) {
  const { state: updated, leveled, newLevel } = addXp(state, XP_SESSION_END);

  appendLog({ event: 'session_end', xp: XP_SESSION_END, level: newLevel });
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
