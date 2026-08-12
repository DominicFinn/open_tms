---
paths:
  - "backend/src/services/{llm,skills,automation}/**"
  - "backend/src/commands/{agentDecisions,agentConfig,automationRules}/**"
  - "backend/src/events/handlers/{TriageAgent,AutomationRule}Handler.ts"
  - "backend/src/events/projections/AgentDecisionProjection.ts"
  - "backend/src/repositories/AgentDecisionRepository.ts"
  - "backend/src/routes/{agentDecisions,agentConfig,automationRules,skills}.ts"
---

# Agent Decisions, Automation Rules & Skills — Rules

Architecture, decision flow, config/versioning and file map: `docs/AGENT_DECISION_LOGGING.md`

## Every agent decision must be logged

Every AI agent decision goes through the decision endpoint for compliance and automation discovery.
Log what was decided, why (the reasoning chain), what context the agent had, what action was taken,
and later the outcome.

- Log via `POST /api/v1/agent-decisions`
- Human review records the outcome via `PUT /api/v1/agent-decisions/:id/outcome`
- Proven patterns are promoted via `POST /api/v1/agent-decisions/:id/promote`

Each `AgentDecision` links to the prompt version that produced it via `promptVersionId`. Never
bypass the decision endpoint when adding a new agent behaviour.

## Prompts are configurable and versioned — don't hardcode

Agent behaviour is configurable per-org via `AgentConfig` + versioned prompts (`AgentConfigVersion`).
Handlers subscribe broadly to wildcard event patterns and **filter against config at runtime**, so
no worker restart is needed when config changes.

Every prompt change creates an immutable version. Rollback by activating a previous version. A
default config with the hardcoded prompt is auto-seeded on first worker startup if none exists.

Template variables available in prompts: `{{event}}`, `{{shipment}}`, `{{issues}}`, `{{sla_status}}`.

## One condition format everywhere

Automation rules, agent-extracted conditions, and skill-chain question nodes all use the same
`{field, operator, value}` `RuleCondition` shape, evaluated by `ConditionEvaluator`.

- Operators: `equals`, `notEquals`, `contains`, `in`, `greaterThan`, `lessThan`,
  `greaterThanOrEqual`, `lessThanOrEqual`, `exists`, `notExists`
- Nested field paths are supported: `payload.delayMinutes`, `context.shipment.status`
- Rules evaluate in priority order (1-100, lower first). **First matching rule executes**, the rest
  are skipped.
- A matched rule suppresses the triage agent for that event via deduplication markers.

## Adding a skill

Skills are discrete, configurable action units. Implement `ISkill` — a `definition` (fields,
`configSchema`, `requiresConfig`), `validateConfig()`, and `execute()` — then register it in the
`SkillRegistry`.

- All skill fields support `{{field.path}}` templating, resolved by `TemplateResolver` against event
  + context data (same variable format as agent prompts)
- Skills needing API keys or URLs read org-level config managed at `/settings/skills`
- Built-ins: `create_issue`, `escalate_issue`, `add_comment`, `contact_driver`, `send_email`
  (requires email config), `call_webhook` (requires URL config)

**Enable the LLM:** set `ANTHROPIC_API_KEY`. Optionally `ANTHROPIC_MODEL`.
