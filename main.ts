// Solmar City — Low Tide Hustle, entry program for make.fun gta6-01.
//
// The game itself lives in game/ as plain static files a desktop browser
// loads offline (game/index.html plus its ES modules and a vendored
// three.js build). This program hands it in: it copies game/ and
// screenshots/ into the output directory and writes dossier.json with the
// kit's own buildDossier library, so the scorer can rebuild the same
// dossier byte for byte.
//
// Run it the way the grader does:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });

const shotsOut = join(outputDir, 'screenshots');
mkdirSync(shotsOut, { recursive: true });
const shotsIn = join(repoRoot, 'screenshots');
if (existsSync(shotsIn)) {
  cpSync(shotsIn, shotsOut, { recursive: true });
}

// The caps are the scorer's (reference/gate.json in the kit): at most four
// screenshots of 256 KiB, at most 993 game entries and 48 MiB of game
// files, no game path over 1000 bytes, and 160 KiB of source text in the
// dossier the judge reads.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`Solmar City handed in: dossier ${dossier.length} bytes -> ${outputDir}`);
