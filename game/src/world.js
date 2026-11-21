// Solmar City itself: the road grid, blocks of buildings, the beach and sea,
// palms, streetlights, district signs and the named landmarks the missions
// use. Everything is built from boxes, cylinders and canvas textures — no
// external assets — and every solid thing registers an AABB collider.

import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { range, intRange, pick, chance } from './random.js';

const tmpColor = new THREE.Color();

function windowTexture(rng, baseHex) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#' + new THREE.Color(baseHex).getHexString();
  g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 18) {
    for (let x = 8; x < 118; x += 18) {
      const lit = rng() < 0.42;
      g.fillStyle = lit ? '#ffd98a' : '#2c3542';
      g.fillRect(x, y, 11, 13);
      g.fillStyle = 'rgba(255,255,255,0.16)';
      g.fillRect(x, y, 11, 3);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 96);
  g.strokeStyle = fg;
  g.lineWidth = 5;
  g.strokeRect(6, 6, 500, 84);
  g.fillStyle = fg;
  g.font = 'bold 44px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildWorld(scene, rng) {
  const colliders = [];
  const landmarks = {};
  const B = CITY.bounds;

  const addCollider = (x, z, w, d) => colliders.push({ x1: x - w / 2, x2: x + w / 2, z1: z - d / 2, z2: z + d / 2 });

  // ---- ground, beach, sea -------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(B * 2 + 160, B * 2 + 260),
    new THREE.MeshLambertMaterial({ color: 0x3f5a46 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 20);
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(B * 2 + 160, CITY.seaZ - CITY.beachZ + 24),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, (CITY.beachZ + CITY.seaZ) / 2 + 6);
  sand.receiveShadow = true;
  scene.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(B * 2 + 400, 320),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.92 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.0, CITY.seaZ + 150);
  scene.add(sea);

  // ---- roads + sidewalks + dashes -----------------------------------------
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const roadGeoX = new THREE.BoxGeometry(B * 2 + 20, 0.12, CITY.roadHalfWidth * 2);
  const roadGeoZ = new THREE.BoxGeometry(CITY.roadHalfWidth * 2, 0.12, B * 2 + 20);
  const walkGeoX = new THREE.BoxGeometry(B * 2 + 20, 0.07, CITY.sidewalkHalfWidth * 2);
  const walkGeoZ = new THREE.BoxGeometry(CITY.sidewalkHalfWidth * 2, 0.07, B * 2 + 20);
  for (const r of CITY.roads) {
    const wx = new THREE.Mesh(walkGeoX, walkMat);
    wx.position.set(0, 0.035, r);
    wx.receiveShadow = true;
    scene.add(wx);
    const wz = new THREE.Mesh(walkGeoZ, walkMat);
    wz.position.set(r, 0.035, 0);
    wz.receiveShadow = true;
    scene.add(wz);
    const rx = new THREE.Mesh(roadGeoX, roadMat);
    rx.position.set(0, 0.07, r);
    rx.receiveShadow = true;
    scene.add(rx);
    const rz = new THREE.Mesh(roadGeoZ, roadMat);
    rz.position.set(r, 0.07, 0);
    rz.receiveShadow = true;
    scene.add(rz);
  }
  const dashGeo = new THREE.BoxGeometry(3.2, 0.04, 0.35);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xe8e4d2 });
  const dashes = [];
  for (const r of CITY.roads) {
    for (let t = -B; t <= B; t += 9) {
      if (CITY.roads.some((o) => Math.abs(t - o) < 9)) continue;
      dashes.push([t, r, 0]);
      dashes.push([r, t, Math.PI / 2]);
    }
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  dashes.forEach(([x, z, rot], i) => {
    e.set(0, rot, 0);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x, 0.15, z), q, new THREE.Vector3(1, 1, 1));
    dashMesh.setMatrixAt(i, m4);
  });
  scene.add(dashMesh);

  // ---- buildings -----------------------------------------------------------
  const texVariants = PALETTE.buildings.map((hex) => windowTexture(rng, hex));
  const roofMats = PALETTE.roofs.map((hex) => new THREE.MeshLambertMaterial({ color: hex }));
  const buildingMats = texVariants.map(
    (tex) => new THREE.MeshLambertMaterial({ map: tex }),
  );

  function addBuilding(x, z, w, d, h, matIdx) {
    const side = buildingMats[matIdx % buildingMats.length];
    const roof = roofMats[matIdx % roofMats.length];
    const mats = [side, side, roof, roof, side, side];
    const b = box(w, h, d, mats, x, h / 2, z);
    scene.add(b);
    addCollider(x, z, w + 0.4, d + 0.4);
    // rooftop clutter on taller blocks
    if (h > 16 && chance(rng, 0.6)) {
      const ac = box(w * 0.3, 1.2, d * 0.3, roof, x + range(rng, -w / 4, w / 4), h + 0.6, z + range(rng, -d / 4, d / 4));
      scene.add(ac);
    }
    return b;
  }

  const edges = [-B, ...CITY.roads, B];
  for (let i = 0; i < edges.length - 1; i++) {
    for (let j = 0; j < edges.length - 1; j++) {
      const x1 = edges[i] + CITY.sidewalkHalfWidth + 2;
      const x2 = edges[i + 1] - CITY.sidewalkHalfWidth - 2;
      const z1 = edges[j] + CITY.sidewalkHalfWidth + 2;
      const z2 = edges[j + 1] - CITY.sidewalkHalfWidth - 2;
      const bw = x2 - x1;
      const bd = z2 - z1;
      if (bw < 10 || bd < 10) continue;
      const cx = (x1 + x2) / 2;
      const cz = (z1 + z2) / 2;
      if (cz > CITY.beachZ - 30) continue; // keep the beachfront open
      const roll = rng();
      if (roll < 0.14) {
        // pocket park: grass slab + palms, no building
        const park = box(bw, 0.18, bd, new THREE.MeshLambertMaterial({ color: PALETTE.grass }), cx, 0.09, cz);
        park.castShadow = false;
        scene.add(park);
        continue;
      }
      const nearCentre = Math.abs(cx) < 90 && Math.abs(cz) < 90;
      const h = nearCentre ? range(rng, 18, 44) : range(rng, 7, 22);
      if (roll < 0.55) {
        addBuilding(cx, cz, bw * range(rng, 0.55, 0.8), bd * range(rng, 0.55, 0.8), h, intRange(rng, 0, 7));
      } else {
        const w2 = bw * 0.42;
        const d2 = bd * 0.42;
        addBuilding(cx - bw / 4, cz - bd / 4, w2, d2, h * range(rng, 0.6, 1), intRange(rng, 0, 7));
        addBuilding(cx + bw / 4, cz + bd / 4, w2, d2, h * range(rng, 0.6, 1), intRange(rng, 0, 7));
        if (chance(rng, 0.5)) addBuilding(cx + bw / 4, cz - bd / 4, w2, d2, h * 0.5, intRange(rng, 0, 7));
      }
    }
  }

  // ---- landmarks ------------------------------------------------------------
  function landmark(name, x, z, w, d, h, sign, bg, fg, matIdx) {
    addBuilding(x, z, w, d, h, matIdx);
    const s = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(w * 0.9, 26), 4.2),
      new THREE.MeshBasicMaterial({ map: signTexture(sign, bg, fg) }),
    );
    s.position.set(x, h * 0.72, z + d / 2 + 0.15);
    scene.add(s);
    landmarks[name] = { x, z, front: { x, z: z + d / 2 + 6 } };
  }

  landmark('casino', 150, -30, 34, 24, 20, 'SOLMAR CASINO', '#2a1030', '#ffd76a', 1);
  landmark('motel', -150, 30, 30, 16, 7, 'PALM COURT MOTEL', '#10303a', '#7ae0d0', 4);
  landmark('chopShop', -150, -150, 24, 18, 8, 'DOCKSIDE AUTO', '#2a2a2a', '#ff9a3c', 6);
  landmark('policeStation', 30, -150, 26, 18, 12, 'SOLMAR PD', '#16283f', '#bcd8ff', 3);
  landmark('hospital', 150, 90, 26, 20, 14, 'ST. MARINA HOSPITAL', '#e8e4da', '#c03030', 0);

  // pier: wooden deck from the beach into the sea, posts, end platform
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
  const pierX = -60;
  const deck = box(8, 0.5, 52, pierMat, pierX, 1.4, CITY.seaZ + 8);
  scene.add(deck);
  for (let pz = CITY.beachZ + 4; pz < CITY.seaZ + 32; pz += 8) {
    for (const px of [pierX - 3.4, pierX + 3.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.2, 6), pierMat);
      post.position.set(px, 0.6, pz);
      scene.add(post);
    }
  }
  const platform = box(16, 0.5, 12, pierMat, pierX, 1.4, CITY.seaZ + 36);
  scene.add(platform);
  landmarks.pier = { x: pierX, z: CITY.seaZ + 36, front: { x: pierX, z: CITY.beachZ + 2 } };

  // lighthouse at the pier head with a slow rotating beam
  const lhBase = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 12, 10), new THREE.MeshLambertMaterial({ color: 0xe8e2d4 }));
  lhBase.position.set(pierX + 6, 7.4, CITY.seaZ + 36);
  lhBase.castShadow = true;
  scene.add(lhBase);
  const lhTop = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2, 10), new THREE.MeshLambertMaterial({ color: 0xb03030 }));
  lhTop.position.set(pierX + 6, 14.4, CITY.seaZ + 36);
  scene.add(lhTop);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.16, depthWrite: false }),
  );
  beam.rotation.z = Math.PI / 2;
  beam.position.set(pierX + 6, 14.4, CITY.seaZ + 36);
  const beamPivot = new THREE.Group();
  beamPivot.position.copy(beam.position);
  beam.position.set(15, 0, 0);
  beamPivot.add(beam);
  scene.add(beamPivot);

  // marina boats: simple hulls bobbing by the west beach
  const boats = [];
  const hullCols = [0xd84f4f, 0x4f7ad8, 0xe8e8e8, 0x53b06a];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const hull = box(3, 1.2, 8, new THREE.MeshLambertMaterial({ color: hullCols[i % 4] }), 0, 0.6, 0);
    const cabin = box(2, 1, 3, new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }), 0, 1.6, -0.5);
    g.add(hull, cabin);
    g.position.set(-170 + i * 14, 0.1, CITY.seaZ + 16 + (i % 2) * 8);
    g.rotation.y = range(rng, -0.4, 0.4);
    scene.add(g);
    boats.push(g);
  }

  // ---- palms + streetlights --------------------------------------------------
  function makePalm() {
    const g = new THREE.Group();
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a48 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f52 });
    let x = 0;
    let y = 0;
    for (let s = 0; s < 4; s++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.22 - s * 0.02, 0.26 - s * 0.02, 1.6, 6), trunkMat);
      x += s * 0.14;
      y += 1.55;
      seg.position.set(x, y - 0.8, 0);
      seg.rotation.z = -0.1;
      seg.castShadow = true;
      g.add(seg);
    }
    for (let f = 0; f < 7; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.4, 4), leafMat);
      const ang = (f / 7) * Math.PI * 2;
      frond.position.set(x + Math.cos(ang) * 1.2, y + 0.5, Math.sin(ang) * 1.2);
      frond.rotation.set(Math.sin(ang) * 1.1, 0, -Math.cos(ang) * 1.1);
      frond.castShadow = true;
      g.add(frond);
    }
    return g;
  }
  const palmProto = makePalm();
  const palmSpots = [];
  for (let x = -200; x <= 200; x += 16) palmSpots.push([x + range(rng, -3, 3), CITY.beachZ + range(rng, 2, 10)]);
  for (const r of CITY.roads) {
    for (let t = -190; t <= 190; t += 38) {
      if (chance(rng, 0.55)) palmSpots.push([t + range(rng, -2, 2), r + (chance(rng, 0.5) ? 8.6 : -8.6)]);
    }
  }
  for (const [px, pz] of palmSpots) {
    const p = palmProto.clone();
    p.position.set(px, 0, pz);
    p.rotation.y = range(rng, 0, Math.PI * 2);
    const s = range(rng, 0.85, 1.25);
    p.scale.set(s, s, s);
    scene.add(p);
  }

  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const lampGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const lampSpots = [];
  for (const r of CITY.roads) {
    for (let t = -195; t <= 195; t += 30) {
      lampSpots.push([t, r + 8.2]);
      lampSpots.push([t + 15, r - 8.2]);
    }
  }
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    m4.compose(new THREE.Vector3(x, 2.7, z), q.identity(), new THREE.Vector3(1, 1, 1));
    poles.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, 5.5, z), q, new THREE.Vector3(1, 1, 1));
    lamps.setMatrixAt(i, m4);
  });
  scene.add(poles, lamps);

  // ---- district signs ---------------------------------------------------------
  const districtSigns = [
    ['OLD TOWN', -120, 0, '#3a2a1a', '#e8c88a'],
    ['CASINO STRIP', 120, -60, '#2a1030', '#ffd76a'],
    ['THE DOCKS', 0, -180, '#1a2a3a', '#9ac8e8'],
    ['MARINA', -120, 120, '#10303a', '#7ae0d0'],
    ['BEACHFRONT', 60, 180, '#7a3a1a', '#ffe0a8'],
  ];
  for (const [text, x, z, bg, fg] of districtSigns) {
    const s = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 3),
      new THREE.MeshBasicMaterial({ map: signTexture(text, bg, fg), side: THREE.DoubleSide }),
    );
    s.position.set(x, 6.4, z);
    scene.add(s);
    for (const px of [x - 7, x + 7]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6.4, 6), poleMat);
      post.position.set(px, 3.2, z);
      scene.add(post);
    }
  }

  // ---- sky, sun, clouds ---------------------------------------------------------
  const skyGeo = new THREE.SphereGeometry(900, 16, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      mid: { value: new THREE.Color(PALETTE.skyMid) },
      low: { value: new THREE.Color(PALETTE.skyLow) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader:
      'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;' +
      'void main(){ float h = normalize(vP).y; vec3 c = h > 0.18 ? mix(mid, top, smoothstep(0.18, 0.65, h)) : mix(low, mid, smoothstep(-0.08, 0.18, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(38, 24),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sun.position.set(-420, 95, 640);
  sun.lookAt(0, 40, 0);
  scene.add(sun);

  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xf6d9c8, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    const n = intRange(rng, 3, 5);
    for (let k = 0; k < n; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(range(rng, 6, 13), 8, 6), cloudMat);
      puff.position.set(k * range(rng, 6, 10) - n * 4, range(rng, -1.5, 1.5), range(rng, -3, 3));
      puff.scale.y = 0.45;
      c.add(puff);
    }
    c.position.set(range(rng, -420, 420), range(rng, 90, 150), range(rng, -420, 420));
    scene.add(c);
    clouds.push(c);
  }

  // ---- lights ------------------------------------------------------------------
  scene.add(new THREE.HemisphereLight(0xffd9b0, 0x2c3a4a, 1.1));
  const sunLight = new THREE.DirectionalLight(0xffbe78, 2.35);
  sunLight.position.set(-180, 130, 260);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -260;
  sunLight.shadow.camera.right = 260;
  sunLight.shadow.camera.top = 260;
  sunLight.shadow.camera.bottom = -260;
  sunLight.shadow.camera.far = 900;
  scene.add(sunLight);
  scene.fog = new THREE.Fog(0xd98a5f, 240, 780);

  // animated bits the main loop ticks
  function tick(t) {
    beamPivot.rotation.y = t * 0.35;
    sea.position.y = Math.sin(t * 0.5) * 0.08;
    boats.forEach((b, i) => {
      b.position.y = 0.1 + Math.sin(t * 0.8 + i * 1.7) * 0.12;
      b.rotation.z = Math.sin(t * 0.6 + i) * 0.03;
    });
    clouds.forEach((c, i) => {
      c.position.x += 0.008 * (1 + (i % 3) * 0.4);
      if (c.position.x > 480) c.position.x = -480;
    });
  }

  // circle vs AABB push-out; returns corrected position
  function collide(pos, radius) {
    for (const c of colliders) {
      const nx = Math.max(c.x1, Math.min(pos.x, c.x2));
      const nz = Math.max(c.z1, Math.min(pos.z, c.z2));
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * radius;
          pos.z = nz + (dz / d) * radius;
        } else {
          // centre inside the box: push out along the smallest penetration
          const left = pos.x - c.x1;
          const right = c.x2 - pos.x;
          const top = pos.z - c.z1;
          const bottom = c.z2 - pos.z;
          const min = Math.min(left, right, top, bottom);
          if (min === left) pos.x = c.x1 - radius;
          else if (min === right) pos.x = c.x2 + radius;
          else if (min === top) pos.z = c.z1 - radius;
          else pos.z = c.z2 + radius;
        }
      }
    }
    pos.x = Math.max(-B - 8, Math.min(B + 8, pos.x));
    pos.z = Math.max(-B - 8, Math.min(CITY.seaZ + 44, pos.z));
    return pos;
  }

  // is a point on a road (within the asphalt band)?
  function onRoad(x, z) {
    for (const r of CITY.roads) {
      if (Math.abs(x - r) < CITY.roadHalfWidth || Math.abs(z - r) < CITY.roadHalfWidth) return true;
    }
    return false;
  }

  return { colliders, landmarks, tick, collide, onRoad };
}
