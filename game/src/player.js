// Rio Solano on foot: a box-built character with swinging limbs, camera-
// relative WASD movement, run, punch and the pistol aim pose. The main loop
// owns health/ammo; this module owns the body and its motion.

import * as THREE from 'three';
import { PLAYER } from './config.js';

function limb(w, h, d, color, px, py, pz) {
  const pivot = new THREE.Group();
  pivot.position.set(px, py, pz);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.y = -h / 2;
  m.castShadow = true;
  pivot.add(m);
  return pivot;
}

export function makeCharacter({ shirt, pants, skin, hair }) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), new THREE.MeshLambertMaterial({ color: shirt }));
  torso.position.y = 1.18;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.34), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.78;
  head.castShadow = true;
  g.add(head);
  const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.38), new THREE.MeshLambertMaterial({ color: hair }));
  hairMesh.position.y = 1.99;
  g.add(hairMesh);
  const armL = limb(0.16, 0.62, 0.16, shirt, -0.42, 1.48, 0);
  const armR = limb(0.16, 0.62, 0.16, shirt, 0.42, 1.48, 0);
  const legL = limb(0.2, 0.82, 0.2, pants, -0.16, 0.84, 0);
  const legR = limb(0.2, 0.82, 0.2, pants, 0.16, 0.84, 0);
  g.add(armL, armR, legL, legR);
  return { group: g, armL, armR, legL, legR, torso, head };
}

export class Player {
  constructor(scene) {
    const c = makeCharacter({ shirt: 0xd84f4f, pants: 0x2c3550, skin: 0xc98d64, hair: 0x241a12 });
    this.body = c;
    this.mesh = c.group;
    this.pos = new THREE.Vector3(-140, 0, 40);
    this.vel = new THREE.Vector3();
    this.heading = 0; // radians, 0 = facing -Z... we use atan2 convention below
    this.walkPhase = 0;
    this.punchTimer = 0;
    this.aiming = false;
    this.dead = false;
    scene.add(this.mesh);
    this.sync();
  }

  sync() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
  }

  // move on foot for dt seconds; camYaw is the camera's facing
  update(dt, input, camYaw, world) {
    if (this.dead) return;
    const { f, s } = input.moveAxes();
    const running = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    // camera forward on the ground plane
    const fx = -sin;
    const fz = -cos;
    const rx = cos;
    const rz = -sin;
    let mx = fx * f + rx * s;
    let mz = fz * f + rz * s;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      this.pos.x += mx * speed * dt;
      this.pos.z += mz * speed * dt;
      const target = Math.atan2(mx, mz);
      let d = target - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += d * Math.min(1, PLAYER.turnRate * dt);
      this.walkPhase += dt * (running ? 11 : 7.5);
    }
    if (this.aiming) {
      // face where the camera faces while aiming
      this.heading = Math.atan2(fx, fz);
    }
    world.collide(this.pos, PLAYER.radius);
    this.animate(dt, len > 0.01, running);
    this.sync();
  }

  animate(dt, moving, running) {
    const swing = moving ? Math.sin(this.walkPhase) * (running ? 0.85 : 0.55) : 0;
    this.mesh.position.y = moving ? Math.abs(Math.sin(this.walkPhase)) * (running ? 0.09 : 0.05) : 0;
    this.body.legL.rotation.x = swing;
    this.body.legR.rotation.x = -swing;
    if (this.punchTimer > 0) {
      this.punchTimer -= dt;
      const t = Math.max(0, this.punchTimer / 0.28);
      this.body.armR.rotation.x = -1.5 * Math.sin((1 - t) * Math.PI);
    } else if (this.aiming) {
      this.body.armR.rotation.x = -1.45;
      this.body.armL.rotation.x = -1.2;
    } else {
      this.body.armL.rotation.x = -swing * 0.8;
      this.body.armR.rotation.x = swing * 0.8;
    }
  }

  punch() {
    this.punchTimer = 0.28;
  }

  // world position of the gun hand, for tracers and muzzle flash
  gunPos() {
    const v = new THREE.Vector3(0.42, 1.45, 0.3);
    v.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    return v.add(this.pos);
  }
}
