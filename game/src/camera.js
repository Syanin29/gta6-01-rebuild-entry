// Third-person chase camera: mouse-orbit yaw/pitch around the player or
// his car, smoothed follow, a speed FOV kick, and a building clamp that
// pulls the camera in instead of letting it clip through walls.

import * as THREE from 'three';

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0.6;
    this.pitch = 0.32;
    this.pos = new THREE.Vector3(-150, 6, 55);
    this.look = new THREE.Vector3();
  }

  // target: Vector3 to follow; dist: preferred distance; colliders for clamp
  update(dt, target, dist, input, colliders, speed01 = 0) {
    if (input) {
      this.yaw -= input.lookX * 0.0026;
      this.pitch = THREE.MathUtils.clamp(this.pitch + input.lookY * 0.0022, -0.12, 1.05);
    }
    const back = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    let useDist = dist;
    // shorten the boom until the camera point is outside every building
    for (let d = dist; d > 1.6; d -= 0.8) {
      const p = new THREE.Vector3().copy(target).addScaledVector(back, d);
      p.y += 1.6;
      let inside = false;
      for (const c of colliders) {
        if (p.x > c.x1 && p.x < c.x2 && p.z > c.z1 && p.z < c.z2 && p.y < 30) {
          inside = true;
          break;
        }
      }
      if (!inside) {
        useDist = d;
        break;
      }
      useDist = 1.6;
    }
    const desired = new THREE.Vector3().copy(target).addScaledVector(back, useDist);
    desired.y = target.y + 1.6 + Math.sin(this.pitch) * useDist * 0.55;
    const k = 1 - Math.exp(-dt * 7);
    this.pos.lerp(desired, k);
    if (this.pos.y < 0.7) this.pos.y = 0.7;
    this.camera.position.copy(this.pos);
    this.look.set(target.x, target.y + 1.7, target.z);
    this.camera.lookAt(this.look);
    const targetFov = 62 + speed01 * 12;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
    }
  }

  snapBehind(target, heading, dist) {
    this.yaw = heading + Math.PI;
    this.pos.set(target.x - Math.sin(heading) * dist, target.y + 3, target.z - Math.cos(heading) * dist);
  }
}
