// Combat: the pistol (hitscan with tracer + muzzle flash), the punch, and
// the crime reporting that feeds the wanted system. Damage lands on
// pedestrians and cars; every public crime can raise the stars.

import * as THREE from 'three';
import { COMBAT } from './config.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.flash = new THREE.PointLight(0xffc060, 0, 18);
    scene.add(this.flash);
    this.flashTimer = 0;
  }

  tracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.07 });
  }

  // fire the pistol from origin along dir; returns what was hit
  shoot(origin, dir, peds, cars, game) {
    this.flash.position.copy(origin);
    this.flash.intensity = 26;
    this.flashTimer = 0.05;
    let best = null;
    let bestDist = 90;
    const test = (pos, radius, kind, ref) => {
      const to = new THREE.Vector3().subVectors(pos, origin);
      const along = to.dot(dir);
      if (along < 0.5 || along > bestDist) return;
      const closest = new THREE.Vector3().copy(origin).addScaledVector(dir, along);
      if (closest.distanceTo(pos) < radius) {
        bestDist = along;
        best = { kind, ref, point: closest };
      }
    };
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      test(new THREE.Vector3(ped.pos.x, 1.1, ped.pos.z), 0.55, 'ped', ped);
    }
    for (const car of cars) {
      test(new THREE.Vector3(car.pos.x, 0.8, car.pos.z), 2.1, 'car', car);
    }
    const end = best ? best.point : new THREE.Vector3().copy(origin).addScaledVector(dir, 90);
    this.tracer(origin, end);
    if (best && best.kind === 'ped') {
      const killed = best.ref.hurt(COMBAT.pistolDamage, origin.x, origin.z);
      game.crime(killed ? 2 : 1, best.ref.pos);
    } else if (best && best.kind === 'car') {
      best.ref.health = Math.max(0, best.ref.health - 9);
      if (best.ref.driver === 'traffic') best.ref.speed = Math.min(18, best.ref.speed + 6);
      game.crime(1, best.ref.pos);
    } else {
      game.crime(1, origin);
    }
    for (const ped of peds) {
      if (ped.pos.distanceTo(origin) < 26) ped.scare(origin.x, origin.z);
    }
    return best;
  }

  // melee swing: hits the nearest ped in front within range
  punch(player, peds, game) {
    const f = { x: Math.sin(player.heading), z: Math.cos(player.heading) };
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      const dx = ped.pos.x - player.pos.x;
      const dz = ped.pos.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < COMBAT.punchRange && (dx * f.x + dz * f.z) / Math.max(0.01, d) > 0.4) {
        const killed = ped.hurt(COMBAT.punchDamage, player.pos.x, player.pos.z);
        game.crime(killed ? 2 : 1, ped.pos);
        return ped;
      }
    }
    return null;
  }

  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.07) * 0.9;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flash.intensity = 0;
    }
  }
}
