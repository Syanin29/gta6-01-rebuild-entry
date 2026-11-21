// Keyboard and mouse state for Solmar City. Keys are tracked by code so the
// layout does not matter; mouse look uses pointer lock on the canvas, with
// drag-to-look as a fallback for embeds that refuse the lock.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, cleared each frame
    this.lookX = 0;
    this.lookY = 0;
    this.shootHeld = false;
    this.shootPressed = false;
    this.locked = false;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.bind();
  }

  bind() {
    addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => {
      this.keys.clear();
      this.shootHeld = false;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.shootHeld = true;
      this.shootPressed = true;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      if (!this.locked && this.canvas.requestPointerLock) {
        const p = this.canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      }
    });
    addEventListener('mouseup', () => {
      this.shootHeld = false;
      this.dragging = false;
    });
    addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.lookX += e.movementX || 0;
        this.lookY += e.movementY || 0;
      } else if (this.dragging) {
        this.lookX += (e.clientX - this.lastX) * 2.2;
        this.lookY += (e.clientY - this.lastY) * 2.2;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
    });
  }

  down(code) {
    return this.keys.has(code);
  }

  hit(code) {
    return this.pressed.has(code);
  }

  // Movement axes in [-1, 1]: forward/back and strafe, WASD or arrows.
  moveAxes() {
    let f = 0;
    let s = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) f += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) f -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) s += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) s -= 1;
    return { f, s };
  }

  endFrame() {
    this.pressed.clear();
    this.shootPressed = false;
    this.lookX = 0;
    this.lookY = 0;
  }
}
