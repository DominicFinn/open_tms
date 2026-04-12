/**
 * SkillRegistry — singleton registry of all available skills.
 *
 * Skills register at startup. The registry provides:
 * - Lookup by type for execution
 * - Full catalog of definitions for the UI
 */

import { ISkill, SkillDefinition } from './ISkill.js';

export class SkillRegistry {
  private skills = new Map<string, ISkill>();

  register(skill: ISkill): void {
    if (this.skills.has(skill.definition.type)) {
      throw new Error(`Skill type "${skill.definition.type}" is already registered`);
    }
    this.skills.set(skill.definition.type, skill);
  }

  get(type: string): ISkill | undefined {
    return this.skills.get(type);
  }

  getAll(): ISkill[] {
    return Array.from(this.skills.values());
  }

  getDefinitions(): SkillDefinition[] {
    return this.getAll().map((s) => s.definition);
  }

  has(type: string): boolean {
    return this.skills.has(type);
  }
}
