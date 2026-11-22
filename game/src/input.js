// VICE BAY — keyboard and mouse, nothing more. InputPad only tracks the
// hardware and forwards gestures through hooks; the game itself decides
// what a key press means (see main.js).

export class InputPad {
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.hooks = hooks;
    this.pressed = new Set();
    // Mouse in canvas pixels; the game starts aiming at screen centre.
    this.mouse = { x: 640, y: 450, down: false };
    this.attach();
  }

  attach() {
    const scrollKeys = new Set([
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space",
    ]);

    window.addEventListener("keydown", (event) => {
      this.pressed.add(event.code);
      if (scrollKeys.has(event.code)) event.preventDefault();
      if (event.code === "Enter") this.hooks.onConfirm?.();
      if (event.code === "KeyP" || event.code === "Escape") this.hooks.onPause?.();
      if (event.code === "KeyE") this.hooks.onEnterCar?.();
      if (event.code === "KeyF") this.hooks.onShoot?.();
    });

    window.addEventListener("keyup", (event) => {
      this.pressed.delete(event.code);
    });

    this.canvas.addEventListener("mousemove", (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.mouse.x = (event.clientX - rect.left) * scaleX;
      this.mouse.y = (event.clientY - rect.top) * scaleY;
    });

    this.canvas.addEventListener("mousedown", (event) => {
      if (event.button === 0) {
        this.mouse.down = true;
        this.hooks.onPrimaryDown?.();
      }
    });

    window.addEventListener("mouseup", () => {
      this.mouse.down = false;
    });

    this.canvas.addEventListener("click", () => {
      this.hooks.onCanvasClick?.();
    });
  }

  // True while the physical key named by `code` is held down.
  held(code) {
    return this.pressed.has(code);
  }

  // True when any code in the list is held down.
  anyHeld(codes) {
    return codes.some((code) => this.pressed.has(code));
  }
}
