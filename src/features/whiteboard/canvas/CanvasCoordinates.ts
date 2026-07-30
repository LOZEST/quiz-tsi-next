export interface CanvasSize {
  cssWidth: number;
  cssHeight: number;
  pixelRatio: number;
}

export class CanvasCoordinates {
  private size: CanvasSize = { cssWidth: 1, cssHeight: 1, pixelRatio: 1 };

  resize(cssWidth: number, cssHeight: number, pixelRatio = 1): CanvasSize {
    this.size = {
      cssWidth: Math.max(1, cssWidth),
      cssHeight: Math.max(1, cssHeight),
      pixelRatio: Math.max(1, pixelRatio),
    };
    return this.size;
  }

  screenToCanvas(clientX: number, clientY: number, rect: DOMRect) {
    return {
      x: ((clientX - rect.left) / rect.width) * this.size.cssWidth,
      y: ((clientY - rect.top) / rect.height) * this.size.cssHeight,
    };
  }

  get orientation(): 'portrait' | 'landscape' {
    return this.size.cssHeight >= this.size.cssWidth ? 'portrait' : 'landscape';
  }

  get current(): CanvasSize {
    return this.size;
  }
}
