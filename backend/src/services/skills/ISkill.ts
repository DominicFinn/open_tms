/**
 * ISkill — extensible skill interface for automation actions.
 *
 * Each skill is a discrete, configurable action unit that can be
 * invoked by automation rules, skill chains, or AI agents.
 */

import { DomainEvent } from '../../events/DomainEvent.js';

// ── Skill definition (metadata for UI and validation) ────────────

export interface SkillField {
  key: string;
  label: string;
  type: 'string' | 'text' | 'number' | 'select' | 'template';
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  templateHelp?: string;
}

export interface SkillConfigField {
  key: string;
  label: string;
  type: 'string' | 'password' | 'url' | 'number' | 'boolean';
  required: boolean;
  placeholder?: string;
}

export interface SkillDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
  category: 'communication' | 'triage' | 'integration' | 'internal';
  fields: SkillField[];
  configSchema: SkillConfigField[];
  requiresConfig: boolean;
}

// ── Skill execution ──────────────────────────────────────────────

export interface SkillExecutionParams {
  fields: Record<string, unknown>;
  config: Record<string, unknown>;
  event: DomainEvent;
  context: Record<string, unknown>;
  orgId: string;
}

export interface SkillExecutionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// ── Skill interface ──────────────────────────────────────────────

export interface ISkill {
  readonly definition: SkillDefinition;
  validateConfig(config: Record<string, unknown>): { valid: boolean; errors?: string[] };
  execute(params: SkillExecutionParams): Promise<SkillExecutionResult>;
}

// ── Skill chain step types ───────────────────────────────────────

export interface RuleCondition {
  field: string;
  operator: string;
  value?: unknown;
}

export type SkillChainStep =
  | {
      type: 'skill';
      skillType: string;
      skillConfigId?: string;
      fields: Record<string, string>;
    }
  | {
      type: 'question';
      question: string;
      conditions: RuleCondition[];
      branches: {
        label: string;
        matched: boolean;
        steps: SkillChainStep[];
      }[];
    };

export interface ChainStepResult {
  stepIndex: number;
  stepType: 'skill' | 'question';
  skillType?: string;
  question?: string;
  branchTaken?: string;
  result?: SkillExecutionResult;
}

export interface ChainExecutionResult {
  success: boolean;
  stepResults: ChainStepResult[];
  error?: string;
}
