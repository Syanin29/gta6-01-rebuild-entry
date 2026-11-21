// Screenshot staging: ?shot=chase|drive|foot|start&seed=N builds one frozen
// moment of Solmar City — a police chase with the mission HUD up, a fast
// avenue run through traffic, Rio on foot by the pier with the beacon lit,
// and the title screen over the sunset. Each shot steps the simulation with
// a fixed timestep so the frame is deterministic, then raises __shotReady.

export function stageShot(name, game) {
  const L = game.world.landmarks;
  if (name === 'start') {
    game.screen = 'title';
    game.showTitle();
    game.chaseCam.pos.set(-120, 26, 150);
    game.chaseCam.yaw = 2.6;
    game.chaseCam.pitch = 0.18;
    game.step(1 / 60);
    game.renderOnce();
    window.__shotReady = true;
    return;
  }

  game.startGame(false);
  game.missions.start(game);

  if (name === 'chase') {
    // Rio mid-delivery through downtown, two units closing in behind him
    game.teleport(-140, 60, Math.PI / 2);
    const car = game.nearestCar(60);
    game.putInCar(car);
    car.speed = 24;
    game.raiseWanted(2);
    game.forceCops(2, 10);
    // flank him: one unit each side, close enough to read in frame
    const f = car.forward();
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    game.cops[0].pos.set(car.pos.x - f.x * 12 + side.x * 3.4, 0, car.pos.z - f.z * 12 + side.z * 3.4);
    game.cops[1].pos.set(car.pos.x - f.x * 15 - side.x * 3.8, 0, car.pos.z - f.z * 15 - side.z * 3.8);
    game.cops[0].speed = 26;
    game.cops[1].speed = 26;
    game.autopilot = { throttle: 1, steer: 0.01 };
    for (let i = 0; i < 150; i++) game.step(1 / 60);
    // the units close the gap while chasing; park them flanking the car,
    // inside the camera's field of view
    const f2 = car.forward();
    const side2 = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    game.cops[0].pos.set(car.pos.x - f2.x * 2.5 + side2.x * 4.6, 0, car.pos.z - f2.z * 2.5 + side2.z * 4.6);
    game.cops[0].heading = car.heading;
    game.cops[0].speed = car.speed;
    game.cops[1].pos.set(car.pos.x - f2.x * 5 - side2.x * 4.8, 0, car.pos.z - f2.z * 5 - side2.z * 4.8);
    game.cops[1].heading = car.heading;
    game.cops[1].speed = car.speed;
    game.chaseCam.snapBehind(car.pos, car.heading, 10.5);
    game.step(1 / 60);
  } else if (name === 'drive') {
    game.teleport(0, 140, Math.PI);
    const car = game.nearestCar(60);
    game.putInCar(car);
    car.speed = 34;
    game.autopilot = { throttle: 1, steer: 0 };
    for (let i = 0; i < 220; i++) game.step(1 / 60);
    game.chaseCam.snapBehind(car.pos, car.heading, 11);
    game.step(1 / 60);
  } else if (name === 'foot') {
    game.teleport(L.pier.front.x + 11, L.pier.front.z + 1, 0.9);
    for (const ped of game.peds.slice(0, 6)) {
      ped.pos.set(game.player.pos.x + (ped.pos.x % 9) - 4, 0, game.player.pos.z + 6 + (ped.pos.z % 7));
      ped.scare(game.player.pos.x, game.player.pos.z);
    }
    for (let i = 0; i < 90; i++) game.step(1 / 60);
    game.chaseCam.snapBehind(game.player.pos, game.player.heading, 7);
    game.step(1 / 60);
    // raise the pistol for the frame (step() reads aiming from the mouse)
    game.player.aiming = true;
    game.player.animate(1 / 60, false, false);
    game.player.sync();
  }

  game.renderOnce();
  window.__shotReady = true;
}
