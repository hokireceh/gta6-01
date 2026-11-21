// VICE BAY — keyboard + mouse input. Written fresh for the rebuild.
// Tracks held keys (by e.code) and the mouse position/buttons over the canvas.
export const input = {
  keys: new Set(),
  mouse: { x: 0, y: 0, down: false, clicked: false, clickX: 0, clickY: 0 },
  _attached: false,

  attach(canvas) {
    if (this._attached) return;
    this._attached = true;
    const codes = new Set([
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyF', 'KeyP',
      'Escape', 'Enter', 'KeyM', 'Space',
    ]);
    window.addEventListener('keydown', (e) => {
      if (codes.has(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'Enter') this.enterPressed = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const r = canvas.getBoundingClientRect();
      this.mouse.down = true;
      this.mouse.clicked = true;
      this.mouse.clickX = e.clientX - r.left;
      this.mouse.clickY = e.clientY - r.top;
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
  },

  // Call once per frame after the game consumed the click.
  consumeClick() {
    this.mouse.clicked = false;
  },
  consumeEnter() {
    this.enterPressed = false;
  },

  get up() { return this.keys.has('KeyW') || this.keys.has('ArrowUp'); },
  get down() { return this.keys.has('KeyS') || this.keys.has('ArrowDown'); },
  get left() { return this.keys.has('KeyA') || this.keys.has('ArrowLeft'); },
  get right() { return this.keys.has('KeyD') || this.keys.has('ArrowRight'); },
  get sprint() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); },
  get interact() { return this.keys.has('KeyE'); },
  get fire() { return this.keys.has('KeyF') || this.mouse.down; },
  get pause() { return this.keys.has('KeyP') || this.keys.has('Escape'); },
  get minimap() { return this.keys.has('KeyM'); },
  enterPressed: false,
};
