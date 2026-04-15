# Buddy Evolved — Roadmap

## Vision
Un skill Claude Code qui remplace et améliore /buddy.
Un pet ASCII qui vit dans ton terminal, évolue selon ce que tu fais avec Claude Code,
et que tu rebirth pour accumuler des étoiles autour de lui.

---

## Core Loop

```
Ouvrir Claude Code
  → le pet est là, il affiche son état actuel
  → tu travailles normalement
  → tes actions avec Claude génèrent de l'XP passivement
  → le pet level up et évolue visuellement
  → au level max : option de Rebirth
  → Rebirth → +1 étoile autour du pet, level reset, forme gardée
  → recommencer
```

---

## 1. Le Pet

### Obtention
- **Entièrement random** au premier lancement
- Surprise — tu ne choisis pas ton espèce de départ

### Évolution
- La **forme** du pet change selon ce que tu fais avec Claude Code
- Évolution automatique à certains seuils de level
- Forme = reflet de ton usage dominant (debug, build, refacto, tests...)
- La forme est **permanente** — un Rebirth ne la reset pas

### Rendu ASCII
- Pet affiché dans le terminal à chaque ouverture de session
- Les étoiles s'affichent autour du pet
- Plus de rebirths = plus d'étoiles = visuellement plus imposant

---

## 2. Le Système d'XP

### Sources d'XP (actions Claude Code)
| Action | XP |
|---|---|
| Prompt qui génère du code accepté | +40 |
| Bug fixé via Claude | +80 |
| Test écrit avec Claude | +50 |
| Refacto acceptée | +60 |
| Skill utilisé pour la 1ère fois | +150 |
| Session longue (> 20 échanges) | +200 |
| Tâche complexe multi-fichiers résolue | +300 |
| Nouveau projet démarré | +500 |

### Courbe de progression
- Niveaux bas : rapides (euphorie de début)
- Niveaux hauts : exponentiellement plus longs (engagement long terme)
- Pas de "fin" — horizon toujours repoussé

---

## 3. Le Rebirth

### Déclenchement
- Disponible quand le pet atteint le **level max**
- Confirmation requise (moment volontaire et signifiant)

### Ce qui se passe
- **Level** → reset à 0
- **Forme du pet** → conservée
- **Étoiles** → +1 étoile autour du pet (permanent)
- **Achievements** → conservés
- **Historique** → conservé

### L'écran de Rebirth
```
┌──────────────────────────────────────┐
│                                      │
│   ✨ REBIRTH AVAILABLE               │
│                                      │
│   Buddy est prêt à renaître.         │
│                                      │
│   Durée : 247 jours                  │
│   Sessions : 1 203                   │
│   Level atteint : 100                │
│                                      │
│   Sa forme sera préservée.           │
│   Une étoile s'ajoutera autour.      │
│                                      │
│   > Confirmer le Rebirth             │
│   > Pas maintenant                   │
│                                      │
└──────────────────────────────────────┘
```

---

## 4. Les Étoiles

### Système
- **1 étoile par Rebirth** — elles s'accumulent, ne disparaissent jamais
- Les étoiles s'affichent **autour** du pet en ASCII
- Plus d'étoiles = couronnes concentriques autour du pet

### Rendu visuel selon le nombre d'étoiles
```
Rebirth 1      *  (^.^)  *
Rebirth 5    * * (^.^) * *
Rebirth 10  ** * (o.o) * **   ← 2e couronne
Rebirth 20  plusieurs couronnes autour du pet
```

### Couleur des étoiles (changement en bloc)
| Rebirths | Couleur | Tier |
|---|---|---|
| 1 – 4 | ⬜ Grises | Rookie |
| 5 – 9 | 🟡 Dorées | Vétéran |
| 10 – 14 | 🔵 Bleues | Élite |
| 15 – 19 | 🟣 Violettes | Maître |
| 20 – 24 | 🔴 Rouges | Légende |
| 25+ | 🌈 Arc-en-ciel | Transcendant |

### Milestone visuel à chaque palier de couleur
```
┌──────────────────────────────┐
│  ★ GOLDEN TIER REACHED ★     │
│                              │
│  Tes étoiles sont devenues   │
│  dorées. 5 rebirths.         │
│                              │
│  Buddy te regarde autrement. │
└──────────────────────────────┘
```

---

## 5. Stockage local

- Tout stocké dans `~/.claude/buddy/`
- Pas de cloud — local only
- **À implémenter plus tard**

### Fichiers
- `log.jsonl` → source de vérité, append-only, un événement par ligne
- `state.json` → cache recalculé depuis le log à chaque ouverture
- `state.sig` → HMAC du state (clé dérivée du machine fingerprint)

### Anti-cheat (3 couches)
1. **Event log append-only** — l'état est recalculé depuis le log, pas stocké directement. Fabriquer du faux XP = générer des centaines de lignes cohérentes.
2. **HMAC par ligne de log** — chaque événement est signé avec une clé dérivée du machine ID + username. Modifier une ligne = signature invalide.
3. **Plausibility checks** — à l'ouverture : XP/jour ≤ maximum plausible, timestamps chronologiques, pas de saut de level impossible.

### Comportement si corruption détectée
- Avertissement affiché
- État freezé (pas de gain d'XP) jusqu'à résolution
- Option de reset manuel explicite

---

## 6. Distribution

### Format
Plugin Claude Code — un repo GitHub public.

### Installation
```
/plugins add https://github.com/toi/buddy-evolved
```
C'est tout. Pas de npm, pas de script bash, pas de marketplace officielle.

### Structure du plugin
```
buddy-evolved/
  marketplace.json     ← métadonnées du plugin
  skills/
    buddy.md           ← commandes /buddy et /buddy rebirth
  hooks/
    xp-tracker.js      ← capture les actions Claude Code → génère XP
  scripts/
    buddy.js           ← logique core (storage, rendu ASCII, rebirth)
```

---

## Décisions actées

- [x] **Formes d'évolution** → à designer plus tard, quand les features fonctionnent (purement visuel)
- [x] **Level max** → 100
- [x] **Le pet ne parle pas** → 100% local, aucune inference, aucun appel LLM
- [x] **Commandes** → `/buddy` (afficher) et `/buddy rebirth` uniquement pour l'instant
- [x] **Animations ASCII** → 3 : idle, level up, rebirth
- [x] **Distribution** → plugin GitHub perso uniquement (`/plugins add URL`)
