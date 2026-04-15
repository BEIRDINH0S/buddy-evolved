#!/usr/bin/env node
/**
 * statusline.js — Rendu Buddy pour la barre de statut Claude Code
 *
 * Claude Code appelle ce script toutes les ~300ms et affiche son stdout
 * sous la zone de saisie (statusLine API).
 *
 * On détruit stdin immédiatement (on n'en a pas besoin) et on laisse
 * Node.js quitter naturellement après l'écriture — évite le flush
 * tronqué sur Windows avec process.exit().
 */

'use strict';

const { loadState, level, xpInLevel, isMaxLevel,
        getTier, RAINBOW, RESET } = require('./core.js');

// Ferme stdin tout de suite — on n'a pas besoin du JSON envoyé par Claude Code
process.stdin.destroy();

// ─── Render ───────────────────────────────────────────────────────────────────

const state   = loadState();
const lvl     = level(state.xp);
const tier    = getTier(state.rebirths);
const xpLeft  = xpInLevel(state.xp);
const maxed   = isMaxLevel(state.xp);

// Barre XP (12 blocs)
const pct = maxed ? 12 : Math.floor((xpLeft / 100) * 12);
const bar = (maxed ? '\x1b[33m' : '\x1b[32m')
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

// Visage + infos XP
const face   = maxed ? '\x1b[33m(✨)\x1b[0m' : '(o.o)';
const xpInfo = maxed
  ? `\x1b[33mREBIRTH → /buddy rebirth\x1b[0m`
  : `[${bar}] \x1b[2m${xpLeft}/100\x1b[0m`;

const line = `  ${face}  \x1b[1mBuddy\x1b[0m  Lv.\x1b[1m${lvl}\x1b[0m${tierLabel}  ${xpInfo}${starStr}`;

process.stdout.write(line + '\n');
// Pas de process.exit() — Node quitte naturellement une fois stdout flushed
