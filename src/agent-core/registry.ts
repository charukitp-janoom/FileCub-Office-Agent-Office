import type { AgentCode, IAgent } from "./types";

export class AgentRegistry {
  private agents = new Map<AgentCode, IAgent>();

  register(agent: IAgent): void {
    if (this.agents.has(agent.code)) {
      throw new Error(`Agent "${agent.code}" is already registered`);
    }
    this.agents.set(agent.code, agent);
  }

  get(code: AgentCode): IAgent | undefined {
    return this.agents.get(code);
  }

  list(): IAgent[] {
    return [...this.agents.values()];
  }
}
