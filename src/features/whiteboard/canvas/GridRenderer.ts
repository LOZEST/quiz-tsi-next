export class GridRenderer {
  constructor(public enabled = false) {}

  render(context: CanvasRenderingContext2D, width: number, height: number) {
    if (!this.enabled) return;
    context.save();
    context.strokeStyle = 'rgba(60, 60, 67, 0.10)';
    context.lineWidth = 1;
    for (let x = 24.5; x < width; x += 24) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 24.5; y < height; y += 24) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    context.restore();
  }
}
