// The story: Vera the fixer's three jobs for Rio, told through glowing
// beacons, HUD objectives and toast messages. Each mission is a small state
// machine the main loop ticks; finishing one pays cash and arms the next.

import * as THREE from 'three';
import { MISSIONS } from './config.js';

export class MissionChain {
  constructor(scene, landmarks) {
    this.landmarks = landmarks;
    this.index = 0; // next mission to run
    this.step = 0;
    this.active = false;
    this.timer = 0;
    this.dropsLeft = [];
    this.beacon = this.makeBeacon();
    scene.add(this.beacon);
    this.beacon.visible = false;
    this.target = null;
    this.objective = 'Find Vera\'s first job — press M when ready.';
  }

  makeBeacon() {
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 26, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
    );
    cyl.position.y = 13;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 2.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.25;
    g.add(cyl, ring);
    return g;
  }

  setTarget(x, z, objective) {
    this.target = { x, z };
    this.objective = objective;
    this.beacon.position.set(x, 0, z);
    this.beacon.visible = true;
  }

  start(game) {
    if (this.index >= MISSIONS.length) {
      game.toast('Story complete. Solmar City is yours — free roam.');
      return;
    }
    this.active = true;
    this.step = 0;
    const L = this.landmarks;
    if (this.index === 0) {
      this.setTarget(L.pier.x, L.pier.z, 'Low Tide Pickup: collect the package at the pier.');
      game.toast('Vera: "Package waits at the pier. Bring it to the Palm Court. Quietly."');
    } else if (this.index === 1) {
      this.setTarget(L.casino.front.x, L.casino.front.z, 'Hot Wheels: steal the gold Comet GT at the casino.');
      game.toast('Vera: "A gold Comet GT sits at the casino. Dockside Auto pays cash for it."');
    } else if (this.index === 2) {
      this.dropsLeft = [
        { x: -180, z: -180, label: 'the docks' },
        { x: 180, z: 60, label: 'the strip' },
        { x: 0, z: 180, label: 'the beach' },
      ];
      this.timer = 180;
      const d = this.dropsLeft[0];
      this.setTarget(d.x, d.z, `Payday Run: grab the cash at ${d.label}. (${this.dropsLeft.length} drops left)`);
      game.toast('Vera: "Three cash drops, three minutes. Every drop draws heat. Go."');
    }
  }

  // returns true when the player is inside the current beacon
  atTarget(game) {
    if (!this.target) return false;
    const p = game.playerPos();
    return Math.hypot(p.x - this.target.x, p.z - this.target.z) < 3.2;
  }

  complete(game, message) {
    const m = MISSIONS[this.index];
    game.addCash(m.pay);
    game.toast(`${message} +$${m.pay}`);
    game.audio.jingle();
    this.index += 1;
    this.active = false;
    this.beacon.visible = false;
    this.target = null;
    this.objective = this.index >= MISSIONS.length ? 'Story complete — free roam.' : 'Press M for Vera\'s next job.';
    game.save();
  }

  update(dt, game) {
    if (!this.active) return;
    const L = this.landmarks;
    if (this.index === 0) {
      if (this.step === 0 && this.atTarget(game)) {
        this.step = 1;
        game.raiseWanted(2);
        this.setTarget(L.motel.front.x, L.motel.front.z, 'Deliver the package to the Palm Court Motel.');
        game.toast('Package secured. The law noticed — lose them or outrun them.');
      } else if (this.step === 1 && this.atTarget(game)) {
        this.complete(game, 'Delivered. Vera pays.');
      }
    } else if (this.index === 1) {
      if (game.comet && game.comet.health <= 0) {
        // the Comet is wrecked: Vera has it towed back to the casino
        game.comet.health = 100;
        game.comet.speed = 0;
        game.comet.pos.set(L.casino.front.x + 8, 0, L.casino.front.z + 2);
        game.comet.sync();
        if (game.currentCar === game.comet) game.exitCar();
        this.step = 0;
        this.setTarget(L.casino.front.x, L.casino.front.z, 'Hot Wheels: steal the gold Comet GT at the casino.');
        game.toast('The Comet is wrecked. Vera had it towed back — try again, gently.');
        return;
      }
      if (this.step === 0 && game.currentCar && game.currentCar.isComet) {
        this.step = 1;
        game.raiseWanted(3);
        this.setTarget(L.chopShop.front.x, L.chopShop.front.z, 'Deliver the Comet GT to Dockside Auto.');
        game.toast('That is the car. Now get it to Dockside Auto in one piece.');
      } else if (this.step === 1 && this.atTarget(game) && game.currentCar && game.currentCar.isComet) {
        game.currentCar.isComet = false;
        this.complete(game, 'Chop shop paid. Clean work.');
      }
    } else if (this.index === 2) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.active = false;
        this.beacon.visible = false;
        this.target = null;
        this.objective = 'Payday Run failed — press M to retry.';
        game.toast('Too slow. The drops went cold.');
        return;
      }
      if (this.atTarget(game)) {
        this.dropsLeft.shift();
        game.raiseWanted(1);
        game.audio.chime();
        if (this.dropsLeft.length === 0) {
          this.complete(game, 'All three drops collected.');
        } else {
          const d = this.dropsLeft[0];
          this.setTarget(d.x, d.z, `Payday Run: cash at ${d.label}. (${this.dropsLeft.length} left, ${Math.ceil(this.timer)}s)`);
        }
      } else if (this.dropsLeft.length) {
        const d = this.dropsLeft[0];
        this.objective = `Payday Run: cash at ${d.label}. (${this.dropsLeft.length} left, ${Math.ceil(this.timer)}s)`;
      }
    }
  }
}
