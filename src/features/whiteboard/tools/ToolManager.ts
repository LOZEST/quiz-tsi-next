import type { Tool } from './Tool';

export class ToolManager {
  private active: Tool;
  constructor(private readonly tools: Record<'pen' | 'eraser', Tool>) {
    this.active = tools.pen;
  }
  select(id: 'pen' | 'eraser') {
    this.active = this.tools[id];
  }
  replaceEraser(tool: Tool) {
    const eraserWasActive = this.active === this.tools.eraser;
    this.tools.eraser = tool;
    if (eraserWasActive) this.active = tool;
  }
  get current(): Tool {
    return this.active;
  }
}
