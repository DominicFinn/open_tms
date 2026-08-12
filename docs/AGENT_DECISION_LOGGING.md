# Agent Decision Logging, Automation Rules & Skills

> Conventions and DO/DON'T rules for this area live in
> `.claude/rules/domains/agents-and-automation.md`. This document is the architecture reference.

## Architecture

Every AI agent decision is logged through a dedicated "decision endpoint" for compliance and
automation discovery. The system captures: what was decided, why (reasoning), what context the agent
had, what action was taken, and the outcome (recorded later via human review).

## Key Concepts

- **Decision** - A logged judgment call by an AI agent, including full reasoning chain and context
  snapshot
- **Outcome** - Human review of whether the decision was correct/incorrect/partially correct
- **Promotion** - "Graduating" a proven decision pattern into a deterministic automation rule (no AI
  needed)

## Decision Flow

1. Agent receives trigger (domain event, schedule, manual)
2. Agent gathers context, calls LLM, produces decision
3. Decision logged via `POST /api/v1/agent-decisions` (the "decision endpoint")
4. Human reviews and records outcome via `PUT /api/v1/agent-decisions/:id/outcome`
5. Proven patterns promoted to automation via `POST /api/v1/agent-decisions/:id/promote`

## Triage Agent

The first agent implementation (`TriageAgentHandler`) subscribes to exception events and uses Claude
to triage them. It can create issues, escalate existing ones, or take no action. Every decision is
logged for compliance.

In the shipment-exception domain the triage agent acts as an **enricher** on issues raised by the
deterministic Issue Engine, not as a creator - see `ISSUE_ENGINE.md`.

**Enable:** Set `ANTHROPIC_API_KEY` env var. Optionally `ANTHROPIC_MODEL`.

**Subscribed events:** `shipment.exception`, `sla.breached`, `cargo.misdrop_detected`,
`cargo.missing_at_stop`, `cargo.left_on_vehicle`, `cold_chain.excursion_detected`

## Configurable Agent Prompts

Agent behaviour is configurable per-org via `AgentConfig` + versioned prompts
(`AgentConfigVersion`). The handler subscribes broadly to wildcard event patterns and filters
against config at runtime (no worker restart needed).

**Configurable:** system prompt (with `{{event}}`, `{{shipment}}`, `{{issues}}`, `{{sla_status}}`
template variables), subscribed events (checkboxes), temperature, max tokens, confidence threshold,
deduplication window, enabled toggle.

**Prompt versioning:** Every prompt change creates an immutable version. Each `AgentDecision` links
to the version that produced it via `promptVersionId`. Rollback by activating any previous version.

**Auto-seed:** Default config with hardcoded prompt is created on first worker startup if none
exists.

## Automation Rule Engine

Deterministic rules promoted from agent decisions. Rules use the same unified condition format
(`{field, operator, value}`) as agent-extracted conditions. When a rule matches an event, it executes
instantly without an LLM call. Rules suppress the triage agent for matched events via deduplication
markers.

**Condition evaluation:** `ConditionEvaluator` supports operators: `equals`, `notEquals`, `contains`,
`in`, `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`, `exists`, `notExists`.
Handles nested field paths (`payload.delayMinutes`, `context.shipment.status`).

**Rule priority:** Rules are evaluated in priority order (1-100, lower first). First matching rule
executes, remaining are skipped.

**Promote flow:** When a user promotes an agent decision, the `matchedConditions` from the LLM
response are extracted and pre-fill the automation rule. The
`POST /api/v1/automation-rules/from-decision/:id` endpoint handles this.

## Skills System

Extensible action framework. Skills are discrete, configurable action units with templated fields.

**ISkill interface:** Each skill has a `definition` (fields, configSchema, requiresConfig),
`validateConfig()`, and `execute()` method. New skills are registered in the `SkillRegistry`.

**Built-in skills:** `create_issue`, `escalate_issue`, `add_comment`, `contact_driver`, `send_email`
(requires email config), `call_webhook` (requires URL config).

**Template resolver:** All skill fields support `{{field.path}}` syntax resolved against event +
context data. Same variable format as agent prompts.

**Skill chains:** Ordered sequences of skills with question branching. Question nodes evaluate
conditions (same `RuleCondition` format) and follow matched/unmatched branches. `SkillChainExecutor`
walks the chain.

**Skill config:** Org-level configuration for skills that need API keys, webhook URLs, etc. Managed
via `/settings/skills` admin page.

## Key Files

### Agent decisions
- `backend/src/commands/agentDecisions/` - Create, RecordOutcome, Promote command handlers
- `backend/src/repositories/AgentDecisionRepository.ts` - repository with filtering and stats
- `backend/src/events/projections/AgentDecisionProjection.ts` - read model projection
- `backend/src/routes/agentDecisions.ts` - API routes (6 endpoints)
- `backend/src/routes/agentConfig.ts` - agent config CRUD + prompt versioning API

### LLM providers
- `backend/src/services/llm/ILlmProvider.ts` - provider-agnostic LLM interface
- `backend/src/services/llm/AnthropicLlmProvider.ts` - Claude implementation

### Handlers
- `backend/src/events/handlers/TriageAgentHandler.ts` - AI triage agent event handler
- `backend/src/events/handlers/AutomationRuleHandler.ts` - rule evaluation + skill dispatch

### Automation and skills
- `backend/src/services/automation/ConditionEvaluator.ts` - condition evaluation engine
- `backend/src/routes/automationRules.ts` - automation rules CRUD + promote + test
- `backend/src/services/skills/ISkill.ts` - skill interfaces and chain step types
- `backend/src/services/skills/SkillRegistry.ts` - skill catalog singleton
- `backend/src/services/skills/SkillChainExecutor.ts` - chain execution with branching
- `backend/src/services/skills/TemplateResolver.ts` - `{{field.path}}` template resolution
- `backend/src/services/skills/CreateIssueSkill.ts`
- `backend/src/services/skills/AddCommentSkill.ts`
- `backend/src/services/skills/ContactDriverSkill.ts`
- `backend/src/services/skills/SendEmailSkill.ts`
- `backend/src/services/skills/CallWebhookSkill.ts`
- `backend/src/routes/skills.ts` - skills catalog + config + chains API

### Tests
- `backend/src/__tests__/handlers/TriageAgentHandler.test.ts` - 12 triage agent tests
- `backend/src/__tests__/commands/AgentDecisionCommands.test.ts` - command handler tests
- `backend/src/__tests__/projections/AgentDecisionProjection.test.ts` - projection tests
- `backend/src/__tests__/services/ConditionEvaluator.test.ts` - 18 evaluator tests
- `backend/src/__tests__/services/SkillChainExecutor.test.ts` - 13 chain executor tests
