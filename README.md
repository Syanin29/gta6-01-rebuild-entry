[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Syanin29/gta6-01-rebuild-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Syanin29/gta6-01-rebuild-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Solmar City — Low Tide Hustle

An original open-world crime game in the spirit of GTA 6, built with three.js for make.fun's "Make GTA 6" bounty ($1,666 in USDC, top 100 paid). Rio Solano owes Vera the fixer a debt he cannot pay; three jobs across a sunset island city — a package at the pier, a gold Comet GT at the casino, and a payday run with the law on his tail — will clear it or bury him.

## What's in the city

- **A whole island city**: grid avenues, ~90 buildings across 6 districts (Downtown, Old Town, Casino Strip, The Docks, Marina, Beachfront), a beach, the sea, a pier with a working lighthouse, boats, palms and streetlights — all under a fixed golden-hour sky.
- **On foot and by car**: walk, run, punch, shoot; steal any parked or moving car and drive it with arcade physics, handbrake drifts and skid marks.
- **Living streets**: 14 traffic cars cruising the grid and 42 pedestrians who stroll, flee gunfire and go down when hit.
- **The law**: a 0–5 star wanted system. Crimes the police see raise the heat; cruisers chase, ram and bust you. Break their line of sight to cool down.
- **A three-job story**: Low Tide Pickup ($1,200), Hot Wheels ($1,800) and Payday Run ($2,500), with beacons, objectives and a fixer who talks.
- **HUD + minimap**: health, armor, cash, wanted stars, weapon, clock, district, speed, and a live minimap with police and mission blips.
- **Polish**: synthesized WebAudio (engine, sirens, radio bassline, gunshots), muzzle flash and tracers, title/pause/wasted/busted screens, localStorage save.

## Play it

```bash
node serve.ts        # then open http://localhost:8123
```

WASD move/drive · mouse look (click to lock) · E enter car · Shift run · mouse fire · F punch · Space handbrake · M next job · N sound · Esc pause.

## Hand it in (the entry program)

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's `buildDossier`.

## Layout

- `game/index.html` — page shell, HUD styling, title/pause/over screens
- `game/src/` — one module per system: world, player, vehicles, pedestrians, missions, combat, hud, audio, camera, shots, main
- `game/vendor/three/` — three.js r160 (MIT), vendored
- `screenshots/` — 4 real renders of the game (chase cover first)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

<sub>Entered on [make.fun](https://make.fun/?ref=5xm183q1&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
