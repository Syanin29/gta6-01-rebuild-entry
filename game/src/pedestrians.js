// Pedestrians: strollers who walk the sidewalk grid, scatter when trouble
// starts, and go down when hit. They are the city's life — and its witnesses:
// hurting one in front of a cop raises the wanted level.

import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { makeCharacter } from './player.js';
import { pick, range } from './random.js';

const SKINS = [0xc98d64, 0x8a5a3b, 0xe8b98a, 0x6b4423];
const HAIRS = [0x241a12, 0x4a3220, 0x8a8a8a, 0xd8c088, 0x101010];

export class Pedestrian {
  constructor(scene, rng) {
    const c = makeCharacter({
      shirt: pick(rng, PALETTE.clothes),
      pants: pick(rng, [0x2c3550, 0x3a3a3a, 0x6b5a44, 0x22303a]),
      skin: pick(rng, SKINS),
      hair: pick(rng, HAIRS),
    });
    this.body = c;
    this.mesh = c.group;
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.walkPhase = range(rng, 0, 6);
    this.speed = range(rng, 1.1, 1.9);
    this.health = 40;
    this.state = 'walk'; // walk | flee | down
    this.fleeTimer = 0;
    this.downTimer = 0;
    this.target = null;
    this.newTarget(rng);
    this.pos.set(this.target.x + range(rng, -20, 20), 0, this.target.z + range(rng, -20, 20));
    scene.add(this.mesh);
    this.sync();
  }

  newTarget(rng) {
    // a random sidewalk corner: a road line offset to the pavement
    const rx = pick(rng, CITY.roads) + (rng() < 0.5 ? 8.6 : -8.6);
    const rz = pick(rng, CITY.roads) + (rng() < 0.5 ? 8.6 : -8.6);
    this.target = { x: rx, z: rz };
  }

  sync() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
  }

  scare(fromX, fromZ) {
    if (this.state === 'down') return;
    this.state = 'flee';
    this.fleeTimer = 3.5;
    this.fleeFrom = { x: fromX, z: fromZ };
  }

  hurt(amount, fromX, fromZ) {
    if (this.state === 'down') return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.state = 'down';
      this.downTimer = 14;
      this.mesh.rotation.x = -Math.PI / 2;
      this.mesh.position.y = 0.25;
      return true;
    }
    this.scare(fromX, fromZ);
    return false;
  }

  update(dt, world, rng, playerPos) {
    if (this.state === 'down') {
      this.downTimer -= dt;
      if (this.downTimer <= 0) {
        // a fresh stroller replaces the fallen one elsewhere
        this.health = 40;
        this.state = 'walk';
        this.mesh.rotation.x = 0;
        this.mesh.position.y = 0;
        this.newTarget(rng);
        this.pos.set(this.target.x, 0, this.target.z);
      }
      return;
    }
    let tx;
    let tz;
    let speed = this.speed;
    if (this.state === 'flee') {
      this.fleeTimer -= dt;
      const dx = this.pos.x - this.fleeFrom.x;
      const dz = this.pos.z - this.fleeFrom.z;
      const d = Math.max(1, Math.hypot(dx, dz));
      tx = this.pos.x + (dx / d) * 18;
      tz = this.pos.z + (dz / d) * 18;
      speed = 5.2;
      if (this.fleeTimer <= 0) this.state = 'walk';
    } else {
      tx = this.target.x;
      tz = this.target.z;
      if (Math.hypot(tx - this.pos.x, tz - this.pos.z) < 2.5) this.newTarget(rng);
    }
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const dist = Math.max(0.001, Math.hypot(dx, dz));
    this.pos.x += (dx / dist) * speed * dt;
    this.pos.z += (dz / dist) * speed * dt;
    const want = Math.atan2(dx, dz);
    let diff = want - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += diff * Math.min(1, 6 * dt);
    world.collide(this.pos, 0.4);
    this.walkPhase += dt * (this.state === 'flee' ? 12 : 7);
    const swing = Math.sin(this.walkPhase) * 0.55;
    this.body.legL.rotation.x = swing;
    this.body.legR.rotation.x = -swing;
    this.body.armL.rotation.x = -swing * 0.7;
    this.body.armR.rotation.x = swing * 0.7;
    this.sync();
    // keep the crowd near the action: teleport far-away peds closer
    if (playerPos && Math.hypot(playerPos.x - this.pos.x, playerPos.z - this.pos.z) > 170) {
      const ang = range(rng, 0, Math.PI * 2);
      this.pos.set(playerPos.x + Math.sin(ang) * 90, 0, playerPos.z + Math.cos(ang) * 90);
      world.collide(this.pos, 0.4);
      this.newTarget(rng);
    }
  }
}

export function spawnPedestrians(scene, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) peds.push(new Pedestrian(scene, rng));
  return peds;
}
