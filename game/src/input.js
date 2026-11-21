// VICE BAY — keyboard + mouse. This class only tracks hardware state and
// forwards gestures to the game through hooks; it never decides what a key
// means on a given screen — the game does that.

const SCROLL_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];

export class InputPad {
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.hooks = hooks;
    this.pressed = new Set();
    this.mouse = { x: 640, y: 450, down: false };
    this.attach();
  }

  attach() {
    window.addEventListener("keydown", (event) => {
      this.pressed.add(event.code);
      if (SCROLL_KEYS.includes(event.code)) event.preventDefault();
      if (event.code === "Enter") this.hooks.onConfirm();
      if (event.code === "KeyP" || event.code === "Escape") this.hooks.onPause();
      if (event.code === "KeyE") this.hooks.onEnterCar();
      if (event.code === "KeyF") this.hooks.onShoot();
    });
    window.addEventListener("keyup", (event) => {
      this.pressed.delete(event.code);
    });
    this.canvas.addEventListener("mousemove", (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = (event.clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouse.y = (event.clientY - rect.top) * (this.canvas.height / rect.height);
    });
    this.canvas.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      this.mouse.down = true;
      this.hooks.onPrimaryDown();
    });
    window.addEventListener("mouseup", () => {
      this.mouse.down = false;
    });
    this.canvas.addEventListener("click", () => {
      this.hooks.onCanvasClick();
    });
  }

  held(code) {
    return this.pressed.has(code);
  }

  anyHeld(codes) {
    return codes.some((code) => this.pressed.has(code));
  }
}
