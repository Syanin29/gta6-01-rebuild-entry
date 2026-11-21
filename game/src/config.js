// Solmar City — Low Tide Hustle: shared tuning constants.
// One place for the numbers every other module reads: city geometry, the
// sunset palette, vehicle and character speeds, and the mission payouts.

export const CITY = {
  roads: [-180, -120, -60, 0, 60, 120, 180], // road centre lines on both axes
  roadHalfWidth: 7,
  sidewalkHalfWidth: 10,
  bounds: 212, // playable square half-size
  beachZ: 196, // sand starts here, sea beyond
  seaZ: 228,
};

export const PALETTE = {
  skyTop: 0x2b3a67,
  skyMid: 0xb8563f,
  skyLow: 0xf2a65a,
  sun: 0xffd9a0,
  sea: 0x1d5f74,
  sand: 0xd9b380,
  asphalt: 0x2e3138,
  sidewalk: 0x8d8d94,
  grass: 0x4a7c59,
  buildings: [0xc9b8a3, 0xa8b6c4, 0xd6c7b2, 0x9fb4a8, 0xc4a29b, 0xb9c4d6, 0xe0d3b8, 0x8fa3b8],
  roofs: [0x5d4a3f, 0x4a4f57, 0x6b4f3a, 0x3f4a52],
  cars: [0xb03030, 0x3050b0, 0xd8d8d8, 0x222226, 0x2e8b57, 0xd8a020, 0x7a3fa0, 0x40a0c0, 0xe06820, 0x606068],
  clothes: [0xd84f4f, 0x4f7ad8, 0x53b06a, 0xe0c040, 0x9a5fd0, 0xe8e8e8, 0x333338, 0x40b8b0],
};

export const PLAYER = {
  walkSpeed: 4.2,
  runSpeed: 8.0,
  turnRate: 10,
  radius: 0.45,
  maxHealth: 100,
  maxArmor: 100,
};

export const CAR = {
  accel: 14,
  brake: 22,
  reverseMax: 9,
  topSpeed: 46, // m/s, about 165 km/h
  steerMax: 0.55,
  grip: 7.5,
  driftGrip: 2.2,
  drag: 0.35,
  radius: 1.7,
};

export const TRAFFIC = {
  count: 14,
  cruiseSpeed: 11,
  laneOffset: 3.4,
};

export const POLICE = {
  topSpeed: 49,
  ramSlow: 0.55,
  spawnDistance: 55,
  bustRadius: 6,
  bustTime: 2.4,
};

export const WANTED = {
  max: 5,
  decayDelay: 14, // seconds unseen before a star drops
  sightRange: 62,
};

export const COMBAT = {
  pistolDamage: 34,
  punchDamage: 20,
  punchRange: 1.9,
  startAmmo: 24,
  ammoPerPickup: 24,
};

export const MISSIONS = [
  { id: 'pickup', title: 'Low Tide Pickup', pay: 1200 },
  { id: 'hotwheels', title: 'Hot Wheels', pay: 1800 },
  { id: 'payday', title: 'Payday Run', pay: 2500 },
];

export const DISTRICTS = [
  { name: 'The Docks', test: (x, z) => z < -120 },
  { name: 'Old Town', test: (x, z) => x < -60 && z >= -120 && z < 60 },
  { name: 'Casino Strip', test: (x, z) => x >= 60 && z >= -120 && z < 60 },
  { name: 'Marina', test: (x, z) => x < -60 && z >= 60 },
  { name: 'Beachfront', test: (x, z) => z >= 150 },
  { name: 'Downtown', test: () => true },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (d.test(x, z)) return d.name;
  return 'Downtown';
}
