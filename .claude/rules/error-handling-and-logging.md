# Error Handling, Logging & Complexity

## Error handling

- **Only use try/catch at the edges** — route handlers, queue/job handlers, CLI commands, event
  handlers. Inside the codebase, know how to handle the error.
- **Don't use exceptions for flow control.** If you expect something to happen, it is not
  exceptional — check for it explicitly and return a result.
- Create **specific exception classes** rather than throwing bare `Error`, so the edge can map them
  onto the right HTTP status (see the api-design rule).
- A caught error that is swallowed silently is a bug. Either handle it meaningfully or let it
  propagate to the edge.
- Failed jobs go to the dead-letter queue and stay reprocessable — see the queues rule.

## Logging

**Log plenty, at the appropriate level. Never log PII.**

PII includes: email, phone, name, address, postcode, IP tied to an identified user, date of birth,
card details, full user-agent tied to an identified user. In this domain also treat **driver
contact details, consignee names and addresses, and signature/POD data** as PII.

- **Use internal IDs instead**: log `orgId`, `shipmentId`, `orderId`, `userId`, `carrierId` — never
  the email, name, or address.
- This applies to **audit and event metadata too** — an event already links to `actorId`, so the
  payload must not duplicate PII.
- For unauthenticated or failed-auth events where there is no user yet: log a hashed or truncated
  identifier plus IP. Never the raw email or phone.
- **Never concatenate strings into a log message — use structured logging.**

```ts
// ✅ GOOD
log.info('Shipment delivered', { shipmentId, orgId, providerType });
log.warn('Login failed', { userId: user?.id, ip: req.ip });

// ❌ BAD — PII in log
log.warn(`Login failed for ${email}`);
log.warn('Login failed', { email });

// ❌ BAD — string concatenation
log.info('Shipment ' + shipmentId + ' delivered to ' + consigneeName);
```

- Log security events (failed auth, permission denied, suspicious activity) — with IDs, not PII.
- The same rules apply to broadcast payloads. A payload is a log with an audience.

## Comments and documentation

- **Don't add meaningless comments** where the code is self-explanatory. Invest in naming instead.
- **DO comment business rules and decisions** — capture the *why*, not the *what*:

```ts
// BUSINESS RULE: unlatched issue types auto-resolve on their recovery event;
// latched safety types (temperature, tamper, mis-ship) never do, because a
// cleared reading doesn't mean the cargo is safe.
```

- When a business rule changes, update the inline comment **and** the relevant doc in `docs/`.
- Concurrency reasoning gets a doc block — see the transactions-and-concurrency rule.

## Complexity

- Watch for growing complexity. **Once cyclomatic complexity exceeds 10, refactor.**
- Don't build mega-classes or mega-handlers. Break them apart along the layering in the architecture
  rule.
- Single responsibility: a class or module should have one reason to change.
- Prefer flat read models over perfectly normalised joins — write twice, read fast.

## General style

- Private by default. Only export what's needed.
- Prefer stateless, pure functions where practical.
- Don't leak abstractions across a boundary — a repository returns data, not a query builder.
- Once constructed, an object must be safe to use. No half-initialised state, no gotcha nulls.
- Don't overuse generics. Use them when they genuinely reduce duplication.
