---
paths:
  - "www/**"
  - "README.md"
---

# Marketing Website (www)

## No em dashes

**NEVER use the em dash character (`—`).** Use a regular hyphen (`-`) or rewrite the sentence
instead. This applies to all www content: components, blog articles, page copy.

## Project identity

Open TMS is an **independent open source project** maintained by Dominic Finn and the community.
It is NOT a System Loco project. System Loco IoT is an integration, not an ownership relationship.
Never describe the project as "maintained by System Loco" or "the System Loco team."

## Keeping the site in sync

When a user-facing feature ships, review and update:

- Feature page content: `www/src/pages/features/`
- Homepage feature list: `www/src/components/Features.tsx`
- Hero feature cards: `www/src/components/Hero.tsx`
- UI preview mockups: `www/src/components/previews/`

Keep the website in sync with `roadmap.md` and actual capabilities.
