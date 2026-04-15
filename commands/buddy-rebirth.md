---
name: buddy rebirth
description: Rebirth de Buddy — reset le level, ajoute une étoile
---

Follow these steps exactly:

1. Run this command and show the output verbatim:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/rebirth.js"
   ```

2. Ask the user: **"Confirmer le Rebirth ? (oui / non)"**

3. If the user says yes or oui, run this command and show the output verbatim:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/rebirth.js" --confirm
   ```

4. If the user says no or non, reply: "Rebirth annulé. Buddy attend."

Do not add any other commentary.
