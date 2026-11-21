// Solmar City — Low Tide Hustle: boot, game state and the main loop.
// Rio Solano, a nobody with a pistol and a debt, takes three jobs from Vera
// the fixer across a sunset island city: steal cars, run packages, outrun
// the law. This module wires the world, player, traffic, police, peds,
// missions, combat, HUD and audio into one playable open world.

import * as THREE from 'three';
import { CITY, COMBAT, POLICE, WANTED } from './config.js';
import { makeRng } from './random.js';
import { Input } from './input.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Vehicle, spawnTraffic, updateTraffic, spawnPolice, updatePolice, spawnParked } from './vehicles.js';
import { spawnPedestrians } from './pedestrians.js';
import { MissionChain } from './missions.js';
import { Combat } from './combat.js';
import { Hud } from './hud.js';
import { GameAudio } from './audio.js';
import { ChaseCamera } from './camera.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || 7);
const SHOT = params.get('shot');
const SAVE_KEY = 'solmar-city-save-v1';

class Game {
  constructor() {
    this.rng = makeRng(SEED);
    // preserveDrawingBuffer keeps the last frame readable for screenshots
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.getElementById('game-root').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1600);
    this.world = buildWorld(this.scene, this.rng);
    this.input = new Input(this.renderer.domElement);
    this.chaseCam = new ChaseCamera(this.camera);
    this.player = new Player(this.scene);
    this.combat = new Combat(this.scene);
    this.audio = new GameAudio();
    this.hud = new Hud(document.getElementById('hud-root'));

    this.traffic = spawnTraffic(this.scene, this.rng, 14);
    this.parked = spawnParked(this.scene, this.rng, 16);
    this.cops = [];
    this.peds = spawnPedestrians(this.scene, this.rng, 42);
    this.missions = new MissionChain(this.scene, this.world.landmarks);

    // the gold Comet GT for mission 2, parked at the casino
    const casino = this.world.landmarks.casino;
    this.comet = new Vehicle(this.scene, casino.front.x + 8, casino.front.z + 2, Math.PI / 2, 0xd8a020, 'sports');
    this.comet.isComet = true;
    this.parked.push(this.comet);

    this.pickups = this.makePickups();
    this.skids = this.makeSkidPool();

    this.screen = 'title';
    this.cash = 40;
    this.health = 100;
    this.armor = 0;
    this.ammo = COMBAT.startAmmo;
    this.wanted = 0;
    this.unseenTimer = 0;
    this.bust01 = 0;
    this.currentCar = null;
    this.clockMinutes = 19 * 60 + 24;
    this.autopilot = null;
    this.time = 0;
    this.ramCooldown = 0;

    this.bindScreens();
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    this.showTitle();
  }

  // ---- pickups + skid marks ---------------------------------------------------
  makePickups() {
    const L = this.world.landmarks;
    const defs = [
      { kind: 'health', x: L.hospital.front.x, z: L.hospital.front.z, color: 0xe84f4f },
      { kind: 'health', x: L.motel.front.x, z: L.motel.front.z, color: 0xe84f4f },
      { kind: 'armor', x: L.policeStation.front.x, z: L.policeStation.front.z, color: 0x7ab8e8 },
      { kind: 'armor', x: L.chopShop.front.x, z: L.chopShop.front.z, color: 0x7ab8e8 },
      { kind: 'ammo', x: L.casino.front.x, z: L.casino.front.z, color: 0xffd76a },
      { kind: 'ammo', x: -60, z: 180, color: 0xffd76a },
    ];
    return defs.map((d) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.9, 0.9),
        new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.85 }),
      );
      mesh.position.set(d.x, 1, d.z);
      this.scene.add(mesh);
      return { ...d, mesh, timer: 0 };
    });
  }

  makeSkidPool() {
    const pool = [];
    const geo = new THREE.PlaneGeometry(0.32, 1.6);
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x101012, transparent: true, opacity: 0 }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.16;
      m.visible = false;
      this.scene.add(m);
      pool.push({ mesh: m, life: 0 });
    }
    return { pool, next: 0 };
  }

  dropSkid(x, z, heading) {
    const s = this.skids.pool[this.skids.next];
    this.skids.next = (this.skids.next + 1) % this.skids.pool.length;
    s.mesh.position.set(x, 0.16, z);
    s.mesh.rotation.z = -heading;
    s.mesh.visible = true;
    s.life = 4;
    s.mesh.material.opacity = 0.55;
  }

  // ---- screens ------------------------------------------------------------------
  bindScreens() {
    const $ = (id) => document.getElementById(id);
    $('btn-new').addEventListener('click', () => this.startGame(true));
    $('btn-continue').addEventListener('click', () => this.startGame(false));
    $('btn-resume').addEventListener('click', () => this.setScreen('play'));
    $('btn-save-title').addEventListener('click', () => {
      this.save();
      this.showTitle();
    });
    $('btn-respawn').addEventListener('click', () => this.respawn());
    this.screens = { title: $('screen-title'), pause: $('screen-pause'), over: $('screen-over') };
    this.overTitle = $('over-title');
    this.overText = $('over-text');
    if (!localStorage.getItem(SAVE_KEY)) $('btn-continue').style.display = 'none';
  }

  setScreen(name) {
    this.screen = name;
    for (const [key, elx] of Object.entries(this.screens)) {
      elx.style.display = key === name ? 'flex' : 'none';
    }
    document.getElementById('hud-root').style.display = name === 'play' ? 'block' : 'none';
  }

  showTitle() {
    this.setScreen('title');
  }

  startGame(fresh) {
    this.audio.ensure();
    if (fresh) {
      this.cash = 40;
      this.health = 100;
      this.armor = 0;
      this.ammo = COMBAT.startAmmo;
      this.wanted = 0;
      this.missions.index = 0;
      this.missions.active = false;
      this.teleport(-140, 40, 0.8);
    } else {
      this.load();
    }
    this.setScreen('play');
    this.hud.toast('Solmar City. Vera has work — press M for the first job.');
  }

  respawn() {
    const at = this.overReason === 'busted' ? this.world.landmarks.policeStation.front : this.world.landmarks.motel.front;
    this.health = 100;
    this.wanted = 0;
    this.bust01 = 0;
    this.cash = Math.max(0, this.cash - (this.overReason === 'busted' ? 150 : 100));
    if (this.currentCar) this.exitCar();
    this.teleport(at.x, at.z, 0);
    this.setScreen('play');
    this.hud.toast(this.overReason === 'busted' ? 'Released. The fine hurt.' : 'You wake up at the Palm Court.');
  }

  gameOver(reason) {
    this.overReason = reason;
    this.audio.wasted();
    this.audio.setEngine(false);
    this.audio.setSiren(false);
    this.audio.setRadio(false);
    this.overTitle.textContent = reason === 'busted' ? 'BUSTED' : 'WASTED';
    this.overText.textContent =
      reason === 'busted' ? 'Solmar PD books you and takes a $150 fine.' : 'The city wins this round. $100 in medical bills.';
    this.setScreen('over');
  }

  // ---- state helpers --------------------------------------------------------------
  playerPos() {
    return this.currentCar ? this.currentCar.pos : this.player.pos;
  }

  addCash(n) {
    this.cash += n;
  }

  toast(text) {
    this.hud.toast(text);
  }

  raiseWanted(n) {
    this.wanted = Math.min(WANTED.max, this.wanted + n);
    this.unseenTimer = 0;
  }

  crime(severity, atPos) {
    // a crime only counts when the law can see it, or when it is loud
    let seen = severity >= 2;
    if (!seen && atPos) {
      for (const cop of this.cops) {
        if (cop.pos.distanceTo(atPos) < WANTED.sightRange) {
          seen = true;
          break;
        }
      }
    }
    if (seen || this.wanted > 0) this.raiseWanted(severity);
  }

  teleport(x, z, heading = 0) {
    this.player.pos.set(x, 0, z);
    this.player.heading = heading;
    this.player.sync();
    this.chaseCam.snapBehind(this.player.pos, heading, 7);
  }

  allCars() {
    return [...this.traffic, ...this.parked, ...this.cops];
  }

  nearestCar(maxDist) {
    const p = this.player.pos;
    let best = null;
    let bd = maxDist;
    for (const car of [...this.parked, ...this.traffic]) {
      const d = car.pos.distanceTo(p);
      if (d < bd) {
        bd = d;
        best = car;
      }
    }
    return best;
  }

  putInCar(car) {
    if (!car) return;
    if (car.driver === 'traffic') {
      car.driver = null;
      this.traffic = this.traffic.filter((c) => c !== car);
      this.parked.push(car);
      this.crime(1, car.pos);
    } else if (car.driver === null && !car.isComet) {
      this.crime(1, car.pos);
    }
    this.currentCar = car;
    car.driver = 'player';
    this.player.mesh.visible = false;
    this.chaseCam.snapBehind(car.pos, car.heading, 10);
    this.audio.setRadio(true);
  }

  exitCar() {
    const car = this.currentCar;
    if (!car) return;
    car.driver = null;
    car.speed = 0;
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    this.player.pos.set(car.pos.x + side.x * 2.2, 0, car.pos.z + side.z * 2.2);
    this.world.collide(this.player.pos, 0.45);
    this.player.heading = car.heading;
    this.player.mesh.visible = true;
    this.player.sync();
    this.currentCar = null;
    this.audio.setRadio(false);
    this.audio.setEngine(false);
  }

  forceCops(n, dist) {
    while (this.cops.length < n) {
      const cop = spawnPolice(this.scene, this.playerPos(), this.rng);
      const f = this.currentCar ? this.currentCar.forward() : { x: 0, z: 1 };
      cop.pos.set(this.playerPos().x - f.x * dist, 0, this.playerPos().z - f.z * dist);
      cop.heading = this.currentCar ? this.currentCar.heading : 0;
      cop.speed = 20;
      this.cops.push(cop);
    }
  }

  save() {
    const data = {
      cash: this.cash,
      health: this.health,
      armor: this.armor,
      ammo: this.ammo,
      mission: this.missions.index,
      x: this.playerPos().x,
      z: this.playerPos().z,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      /* storage unavailable in some embeds: saving is best-effort */
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      this.cash = d.cash ?? 40;
      this.health = d.health ?? 100;
      this.armor = d.armor ?? 0;
      this.ammo = d.ammo ?? COMBAT.startAmmo;
      this.missions.index = d.mission ?? 0;
      this.teleport(d.x ?? -140, d.z ?? 40, 0.8);
    } catch (e) {
      /* corrupt save: start clean */
    }
  }

  // ---- per-frame --------------------------------------------------------------------
  step(dt) {
    this.time += dt;
    this.world.tick(this.time);
    if (this.screen !== 'play') {
      // title backdrop: slow drift over the city
      if (this.screen === 'title') {
        this.chaseCam.yaw += dt * 0.03;
        this.chaseCam.update(dt, new THREE.Vector3(-40, 4, 60), 46, null, this.world.colliders);
      }
      this.input.endFrame();
      return;
    }

    this.clockMinutes += dt * 0.5;
    const input = this.input;

    if (input.hit('Escape')) {
      this.setScreen('pause');
      input.endFrame();
      return;
    }
    if (input.hit('KeyM') && !this.missions.active) this.missions.start(this);
    if (input.hit('KeyN')) {
      this.audio.muted = !this.audio.muted;
      this.hud.toast(this.audio.muted ? 'Sound off.' : 'Sound on.');
    }

    // enter / exit car
    if (input.hit('KeyE')) {
      if (this.currentCar) this.exitCar();
      else {
        const car = this.nearestCar(3.4);
        if (car) this.putInCar(car);
      }
    }

    if (this.currentCar) {
      const car = this.currentCar;
      let throttle = 0;
      let steer = 0;
      let handbrake = false;
      if (this.autopilot) {
        throttle = this.autopilot.throttle;
        steer = this.autopilot.steer;
      } else {
        const { f, s } = input.moveAxes();
        throttle = f;
        steer = s;
        handbrake = input.down('Space');
      }
      car.drive(dt, throttle, steer, handbrake, this.world);
      this.player.pos.copy(car.pos);
      if (handbrake && Math.abs(car.speed) > 9) {
        const f = car.forward();
        this.dropSkid(car.pos.x - f.x * 1.3 - Math.cos(car.heading) * 0.8, car.pos.z - f.z * 1.3 + Math.sin(car.heading) * 0.8, car.heading);
        this.dropSkid(car.pos.x - f.x * 1.3 + Math.cos(car.heading) * 0.8, car.pos.z - f.z * 1.3 - Math.sin(car.heading) * 0.8, car.heading);
      }
      this.audio.setEngine(true, Math.abs(car.speed) / 46);
      this.chaseCam.update(dt, car.pos, 10.5, input, this.world.colliders, Math.abs(car.speed) / 46);
      // running someone over is a crime
      for (const ped of this.peds) {
        if (ped.state !== 'down' && ped.pos.distanceTo(car.pos) < 2.1 && Math.abs(car.speed) > 4) {
          const killed = ped.hurt(60, car.pos.x, car.pos.z);
          this.crime(killed ? 2 : 1, ped.pos);
          car.speed *= 0.8;
          this.audio.crash();
        }
      }
    } else {
      this.player.aiming = input.shootHeld;
      this.player.update(dt, input, this.chaseCam.yaw, this.world);
      this.audio.setEngine(false);
      this.chaseCam.update(dt, this.player.pos, 7, input, this.world.colliders);
      if (input.shootPressed) {
        if (this.ammo > 0) {
          this.ammo -= 1;
          const dir = new THREE.Vector3();
          this.camera.getWorldDirection(dir);
          this.combat.shoot(this.player.gunPos(), dir, this.peds, this.allCars(), this);
          this.audio.shot();
        } else {
          this.hud.toast('Out of ammo. Find a gold pickup.');
        }
      }
      if (input.hit('KeyF')) {
        this.player.punch();
        if (this.combat.punch(this.player, this.peds, this)) this.audio.punch();
      }
    }

    // traffic + peds
    for (const car of this.traffic) updateTraffic(car, dt, this.world, this.allCars(), this.rng);
    for (const ped of this.peds) ped.update(dt, this.world, this.rng, this.playerPos());

    // police: match count to wanted, chase, ram, bust
    const wantCops = this.wanted === 0 ? 0 : Math.min(6, this.wanted + 1);
    while (this.cops.length < wantCops) this.cops.push(spawnPolice(this.scene, this.playerPos(), this.rng));
    while (this.cops.length > wantCops) {
      const cop = this.cops.pop();
      this.scene.remove(cop.mesh);
    }
    let nearestCop = Infinity;
    for (const cop of this.cops) {
      const d = updatePolice(cop, dt, this.playerPos(), this.world);
      nearestCop = Math.min(nearestCop, d);
      if (this.currentCar && d < 3.6 && this.ramCooldown <= 0) {
        this.currentCar.speed *= POLICE.ramSlow;
        this.currentCar.health = Math.max(0, this.currentCar.health - 6);
        this.ramCooldown = 0.7;
        this.audio.crash();
      }
    }
    this.ramCooldown -= dt;
    this.audio.setSiren(this.wanted > 0 && nearestCop < 90);

    const playerSpeed = this.currentCar ? Math.abs(this.currentCar.speed) : 0;
    if (this.wanted > 0 && nearestCop < POLICE.bustRadius && playerSpeed < 2.2) {
      this.bust01 = Math.min(1, this.bust01 + dt / POLICE.bustTime);
      if (this.bust01 >= 1) {
        this.gameOver('busted');
        input.endFrame();
        return;
      }
    } else {
      this.bust01 = Math.max(0, this.bust01 - dt * 0.7);
    }

    // wanted decay when unseen
    if (this.wanted > 0) {
      if (nearestCop > WANTED.sightRange) {
        this.unseenTimer += dt;
        if (this.unseenTimer > WANTED.decayDelay) {
          this.wanted -= 1;
          this.unseenTimer = 0;
          if (this.wanted === 0) this.hud.toast('You lost them. Heat is off.');
        }
      } else {
        this.unseenTimer = 0;
      }
    }

    // cop gunfire at high wanted hurts
    if (this.wanted >= 3 && nearestCop < 26 && this.rng() < dt * 0.5) {
      this.damage(6);
    }

    // pickups
    for (const p of this.pickups) {
      p.mesh.rotation.y += dt * 1.6;
      p.mesh.position.y = 1 + Math.sin(this.time * 2.4 + p.x) * 0.18;
      if (p.timer > 0) {
        p.timer -= dt;
        p.mesh.visible = p.timer <= 0;
        continue;
      }
      if (this.playerPos().distanceTo(p.mesh.position) < 2.4) {
        if (p.kind === 'health') this.health = 100;
        if (p.kind === 'armor') this.armor = 100;
        if (p.kind === 'ammo') this.ammo += COMBAT.ammoPerPickup;
        p.timer = 30;
        p.mesh.visible = false;
        this.audio.chime();
        this.hud.toast(p.kind === 'health' ? 'Patched up.' : p.kind === 'armor' ? 'Armor on.' : 'Ammo restocked.');
      }
    }

    // skid fade
    for (const s of this.skids.pool) {
      if (s.life > 0) {
        s.life -= dt;
        s.mesh.material.opacity = Math.max(0, s.life / 4) * 0.55;
        if (s.life <= 0) s.mesh.visible = false;
      }
    }

    this.missions.update(dt, this);
    this.combat.update(dt);

    // health regen after a quiet spell (never from zero: wasted check first)
    if (this.health <= 0) {
      this.gameOver('wasted');
      input.endFrame();
      return;
    }
    if (this.wanted === 0 && this.health < 100) this.health = Math.min(100, this.health + dt * 2.5);

    // interaction prompt
    if (!this.currentCar) {
      const car = this.nearestCar(3.4);
      this.hud.setPrompt(car ? (car.isComet ? 'E — steal the Comet GT' : 'E — enter car') : '');
    } else {
      this.hud.setPrompt('E — exit car');
    }

    const pos = this.playerPos();
    this.hud.update(dt, {
      health: this.health,
      armor: this.armor,
      cash: this.cash,
      wanted: this.wanted,
      ammo: this.ammo,
      inCar: !!this.currentCar,
      speedKmh: this.currentCar ? this.currentCar.speedKmh() : 0,
      clockMinutes: this.clockMinutes,
      pos,
      heading: this.currentCar ? this.currentCar.heading : this.player.heading,
      objective: this.missions.objective,
      target: this.missions.target,
      cops: this.cops,
      bust01: this.bust01,
      aiming: this.player.aiming && !this.currentCar,
    });
    input.endFrame();
  }

  damage(n) {
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, n * 0.7);
      this.armor -= absorbed;
      n -= absorbed;
    }
    this.health -= n;
  }

  renderOnce() {
    this.renderer.render(this.scene, this.camera);
  }

  // screenshot mode: keep presenting the staged frame so a headless
  // capture sees it (a single synchronous render is never composited)
  runFrozen() {
    const loop = () => {
      requestAnimationFrame(loop);
      this.renderOnce();
    };
    loop();
  }

  run() {
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      this.step(dt);
      this.renderOnce();
    };
    this.clock = new THREE.Clock();
    loop();
  }
}

const game = new Game();
window.__game = {
  game,
  state: () => ({
    screen: game.screen,
    cash: game.cash,
    health: game.health,
    wanted: game.wanted,
    ammo: game.ammo,
    mission: game.missions.index,
    missionActive: game.missions.active,
    objective: game.missions.objective,
    inCar: !!game.currentCar,
    pos: { x: game.playerPos().x, z: game.playerPos().z },
    cops: game.cops.length,
  }),
  teleport: (x, z, h) => game.teleport(x, z, h || 0),
  setWanted: (n) => {
    game.wanted = n;
  },
  startMission: () => game.missions.start(game),
  enterNearestCar: () => game.putInCar(game.nearestCar(60)),
};

if (SHOT) {
  // staging steps the sim synchronously; then keep presenting that frame
  stageShot(SHOT, game);
  game.runFrozen();
} else {
  game.run();
}
