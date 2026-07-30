import type { Tool } from './Tool';

export class ToolManager {
  private active: Tool;
  constructor(private readonly tools: Record<'pen' | 'eraser', Tool>) {
    this.active = tools.pen;
  }
  select(id: 'pen' | 'eraser') {
    this.active = this.tools[id];
  }
  get current(): Tool {
    return this.active;
  }
}
