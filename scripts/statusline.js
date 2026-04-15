#!/usr/bin/env node
/**
 * statusline.js — Rendu Buddy pour la barre de statut Claude Code
 *
 * Claude Code appelle ce script toutes les ~300ms.
 * Il lit le state de Buddy et affiche 1-2 lignes sous la zone de saisie.
 *
 * Doit être TRÈS rapide (< 300ms total, idéalement < 50ms).
 * Pas de calcul lourd, juste lire le state et formatter.
 */

'use strict';

const { loadState, level, xpInLevel, isMaxLevel,
        getTier, RAINBOW, RESET } = require('./core.js');

// Timeout rapide sur stdin (Claude Code envoie du JSON, on n'en a pas besoin)
// On lit quand même pour ne pas bloquer le pipe
let raw = '';
const timer = setTimeout(() => render(), 50); // render au plus tard dans 50ms

process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { raw += c; });
process.stdin.on('end', () => { clearTimeout(timer); render(); });

function render() {
  const state   = loadState();
  const lvl     = level(state.xp);
  const tier    = getTier(state.rebirths);
  const xpLeft  = xpInLevel(state.xp);
  const maxed   = isMaxLevel(state.xp);

  // Barre XP (12 blocs)
  const pct  = maxed ? 12 : Math.floor((xpLeft / 100) * 12);
  const bar  = (maxed ? '\x1b[33m' : '\x1b[32m')
             + '█'.repeat(pct) + RESET + '\x1b[90m' + '░'.repeat(12 - pct) + RESET;

  // Étoiles (max 8 affichées, +N si plus)
  let starStr = '';
  if (state.rebirths > 0) {
    const sym     = tier ? tier.symbol : '*';
    const visible = Math.min(state.rebirths, 8);
    const extra   = state.rebirths > 8 ? `\x1b[90m+${state.rebirths - 8}\x1b[0m` : '';
    const stars   = Array.from({ length: visible }, (_, i) => {
      const c = tier?.color ?? RAINBOW[i % RAINBOW.length];
      return `${c}${sym}${RESET}`;
    }).join('');
    starStr = `  ${stars}${extra}`;
  }

  // Tier label
  const tierLabel = tier ? `  ${tier.color}${tier.name}${RESET}` : '';

  // Ligne principale
  const face = maxed ? '\x1b[33m(✨)\x1b[0m' : '(o.o)';
  const xpInfo = maxed
    ? `\x1b[33mREBIRTH /buddy rebirth\x1b[0m`
    : `[${bar}] \x1b[2m${xpLeft}/100\x1b[0m`;

  const line = `  ${face}  \x1b[1mBuddy\x1b[0m  Lv.\x1b[1m${lvl}\x1b[0m${tierLabel}  ${xpInfo}${starStr}`;

  process.stdout.write(line + '\n');
  process.exit(0);
}
