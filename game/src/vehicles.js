// Cars: the box-built vehicle model, arcade driving physics, grid traffic
// and police pursuit. One Vehicle class drives everything; the player takes
// over whichever car he steals.

import * as THREE from 'three';
import { CAR, CITY, PALETTE, POLICE, TRAFFIC } from './config.js';
import { pick, range } from './random.js';

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141416 });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc4d8 });

export function makeCarMesh(color, kind = 'sedan') {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const sports = kind === 'sports';
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, sports ? 4.4 : 4.1), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.5, sports ? 1.9 : 2.1), glassMat);
  cabin.position.set(0, 1.02, sports ? 0.35 : -0.1);
  cabin.castShadow = true;
  g.add(cabin);
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.3, 0.3), new THREE.MeshLambertMaterial({ color: 0x2a2a2e }));
  bumperF.position.set(0, 0.42, 2.12);
  g.add(bumperF);
  const bumperB = bumperF.clone();
  bumperB.position.z = -2.12;
  g.add(bumperB);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const sx of [-0.62, 0.62]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), lightMat);
    hl.position.set(sx, 0.62, 2.28);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), new THREE.MeshBasicMaterial({ color: 0xc03030 }));
    tl.position.set(sx, 0.62, -2.28);
    g.add(tl);
  }
  const wheels = [];
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  let lightBar = null;
  if (kind === 'police') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.3, 4.14), new THREE.MeshLambertMaterial({ color: 0x16283f }));
    stripe.position.y = 0.58;
    g.add(stripe);
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
    red.position.x = -0.4;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x3060ff }));
    blue.position.x = 0.4;
    lightBar.add(red, blue);
    lightBar.position.set(0, 1.42, -0.1);
    g.add(lightBar);
  }
  if (sports) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.5), bodyMat);
    spoiler.position.set(0, 1.05, -2.0);
    g.add(spoiler);
  }
  return { group: g, wheels, lightBar };
}

export class Vehicle {
  constructor(scene, x, z, heading, color, kind = 'sedan') {
    const made = makeCarMesh(color, kind);
    this.mesh = made.group;
    this.wheels = made.wheels;
    this.lightBar = made.lightBar;
    this.kind = kind;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.health = 100;
    this.driver = null; // 'player' | 'traffic' | 'police' | null (parked)
    this.trafficDir = null;
    this.stuckTimer = 0;
    scene.add(this.mesh);
    this.sync();
  }

  sync() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    for (const w of this.wheels) w.rotation.x += this.speed * 0.03;
    if (this.lightBar) {
      const t = performance.now() * 0.008;
      this.lightBar.children[0].visible = Math.sin(t) > 0;
      this.lightBar.children[1].visible = Math.sin(t) <= 0;
    }
  }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  // shared arcade step: throttle -1..1, steerInput -1..1, handbrake bool
  drive(dt, throttle, steerInput, handbrake, world) {
    const topSpeed = this.kind === 'police' ? POLICE.topSpeed : CAR.topSpeed;
    if (throttle > 0) this.speed += CAR.accel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= CAR.brake * dt;
      else this.speed = Math.max(-CAR.reverseMax, this.speed + CAR.accel * throttle * dt);
    }
    this.speed -= this.speed * CAR.drag * dt;
    if (handbrake) this.speed -= this.speed * 1.6 * dt;
    this.speed = Math.max(-CAR.reverseMax, Math.min(topSpeed, this.speed));

    const steerTarget = steerInput * CAR.steerMax;
    this.steer += (steerTarget - this.steer) * Math.min(1, 8 * dt);
    const grip = handbrake ? CAR.driftGrip : CAR.grip;
    const turn = this.steer * Math.min(1, Math.abs(this.speed) / 6) * (this.speed >= 0 ? 1 : -1);
    this.heading += turn * dt * (grip / CAR.grip) * 1.9;

    const f = this.forward();
    const before = this.pos.clone();
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    world.collide(this.pos, CAR.radius);
    // hitting a wall bleeds speed
    const moved = Math.hypot(this.pos.x - before.x, this.pos.z - before.z);
    const wanted = Math.abs(this.speed) * dt;
    if (wanted > 0.01 && moved < wanted * 0.45) {
      this.speed *= 0.55;
      this.health = Math.max(0, this.health - 4);
    }
    this.sync();
  }

  speedKmh() {
    return Math.round(Math.abs(this.speed) * 3.6);
  }
}

// ---- traffic -----------------------------------------------------------------
// Cars cruise the road grid on the right-hand lane and pick a random turn at
// each intersection. They brake for whatever is directly ahead.

export function spawnTraffic(scene, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const road = pick(rng, CITY.roads);
    const along = range(rng, -190, 190);
    const dirSign = rng() < 0.5 ? 1 : -1;
    let x;
    let z;
    let heading;
    if (vertical) {
      x = road + TRAFFIC.laneOffset * dirSign;
      z = along;
      heading = dirSign > 0 ? 0 : Math.PI;
    } else {
      x = along;
      z = road - TRAFFIC.laneOffset * dirSign;
      heading = dirSign > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    const car = new Vehicle(scene, x, z, heading, pick(rng, PALETTE.cars), rng() < 0.12 ? 'sports' : 'sedan');
    car.driver = 'traffic';
    car.trafficDir = { vertical, dirSign, road };
    car.speed = TRAFFIC.cruiseSpeed * range(rng, 0.8, 1.1);
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(car, dt, world, allCars, rng) {
  const d = car.trafficDir;
  if (!d) return;
  const f = car.forward();
  // brake for a car or the player just ahead
  let throttle = 1;
  for (const other of allCars) {
    if (other === car) continue;
    const dx = other.pos.x - car.pos.x;
    const dz = other.pos.z - car.pos.z;
    const ahead = dx * f.x + dz * f.z;
    const side = Math.abs(-dx * f.z + dz * f.x);
    if (ahead > 0 && ahead < 9 && side < 2.2) throttle = ahead < 5 ? -0.6 : 0;
  }
  // steer toward the lane centre of the current road
  let steer = 0;
  if (d.vertical) {
    const laneX = d.road + TRAFFIC.laneOffset * d.dirSign;
    steer = THREE.MathUtils.clamp((laneX - car.pos.x) * 0.12 * d.dirSign, -1, 1);
    // at an intersection, maybe turn
    for (const cross of CITY.roads) {
      if (Math.abs(car.pos.z - cross) < 2 && rng() < 0.012) {
        d.vertical = false;
        d.road = cross;
        d.dirSign = rng() < 0.5 ? 1 : -1;
        car.heading = d.dirSign > 0 ? Math.PI / 2 : -Math.PI / 2;
        break;
      }
    }
    if (Math.abs(car.pos.z) > CITY.bounds - 6) {
      d.dirSign *= -1;
      car.heading += Math.PI;
    }
  } else {
    const laneZ = d.road - TRAFFIC.laneOffset * d.dirSign;
    steer = THREE.MathUtils.clamp((car.pos.z - laneZ) * 0.12 * d.dirSign, -1, 1);
    for (const cross of CITY.roads) {
      if (Math.abs(car.pos.x - cross) < 2 && rng() < 0.012) {
        d.vertical = true;
        d.road = cross;
        d.dirSign = rng() < 0.5 ? 1 : -1;
        car.heading = d.dirSign > 0 ? 0 : Math.PI;
        break;
      }
    }
    if (Math.abs(car.pos.x) > CITY.bounds - 6) {
      d.dirSign *= -1;
      car.heading += Math.PI;
    }
  }
  car.drive(dt, throttle * 0.55, steer, false, world);
  if (car.speed < TRAFFIC.cruiseSpeed * 0.6 && throttle > 0) car.speed += 6 * dt;
}

// ---- police --------------------------------------------------------------------

export function spawnPolice(scene, playerPos, rng) {
  const ang = range(rng, 0, Math.PI * 2);
  const x = playerPos.x + Math.sin(ang) * POLICE.spawnDistance;
  const z = playerPos.z + Math.cos(ang) * POLICE.spawnDistance;
  const car = new Vehicle(scene, x, z, ang + Math.PI, 0xf0f0f0, 'police');
  car.driver = 'police';
  return car;
}

export function updatePolice(car, dt, targetPos, world) {
  const dx = targetPos.x - car.pos.x;
  const dz = targetPos.z - car.pos.z;
  const dist = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = THREE.MathUtils.clamp(diff * 1.6, -1, 1);
  const throttle = dist < 7 && Math.abs(car.speed) < 3 ? 0.4 : 1;
  car.drive(dt, throttle, steer, false, world);
  return dist;
}

// parked cars the player can steal, scattered along roads and lots
export function spawnParked(scene, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const road = pick(rng, CITY.roads);
    const along = range(rng, -195, 195);
    const side = rng() < 0.5 ? 1 : -1;
    const vertical = rng() < 0.5;
    let x;
    let z;
    let heading;
    if (vertical) {
      x = road + side * (CITY.roadHalfWidth - 1.6);
      z = along;
      heading = side > 0 ? 0 : Math.PI;
    } else {
      x = along;
      z = road + side * (CITY.roadHalfWidth - 1.6);
      heading = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    const car = new Vehicle(scene, x, z, heading, pick(rng, PALETTE.cars), rng() < 0.15 ? 'sports' : 'sedan');
    car.driver = null;
    cars.push(car);
  }
  return cars;
}
