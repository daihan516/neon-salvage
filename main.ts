// Neon Salvage — make.fun best-game-01 entry program (Node, standard library
// only). The game itself is the static game/ folder beside this file: plain
// HTML + ES modules a desktop browser loads fully offline, no libraries, no
// network requests. This program hands it in: it copies game/ and
// screenshots/ into the output directory and writes dossier.json there — the
// summary the AI judge reads — using the vendored make.fun library.
//
// Run it:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (MAKEFUN_OUTPUT_DIR stands in for the grader's /output.)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps mirror the scorer's own gates: at most 4 screenshots of at most
// 256 KiB each, at most 993 files / 48 MiB under game/, no game/ path longer
// than 1000 bytes; text_max_bytes shapes the dossier text budget.
const ENTRY_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, ENTRY_CAPS),
);
