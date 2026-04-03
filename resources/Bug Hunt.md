# Bug Hunt Report

**Date:** 2026-03-30
**Scope:** Full codebase audit — backend, frontend, migrations, infrastructure

---

## Critical — Missing Database Migrations

These tables exist in `schema.prisma` but have **no CREATE TABLE migration**, meaning a fresh database will be broken.

| # | Table | Schema Location | Impact | Status |
|---|-------|----------------|--------|--------|
| 1 | `WebhookLog` | schema.prisma:581-624 | Inbound webhook processing crashes | FIXED |
| 2 | `User` | schema.prisma:742-793 | Auth system non-functional | FIXED |
| 3 | `AuthProvider` | schema.prisma:795-815 | Auth system non-functional | FIXED |
| 4 | `Role` | schema.prisma:817-832 | Auth system non-functional | FIXED |
| 5 | `UserRole` | schema.prisma:834-845 | Auth system non-functional | FIXED |
| 6 | `Session` | schema.prisma:847-854 | Auth system non-functional | FIXED |
| 7 | `ApiKey` | schema.prisma:563-579 | API key auth broken (ALTER exists but no CREATE) | FIXED |
| 8 | `OutboundIntegration` | schema.prisma:626-655 | Outbound integrations non-functional | FIXED |
| 9 | `OutboundIntegrationLog` | schema.prisma:657-694 | Integration logging broken | FIXED |
| 10 | `EdiPartner` | schema.prisma:696-738 | EDI system non-functional | FIXED |
| 11 | `EdiFile` | schema.prisma:858-895 | EDI file processing broken | FIXED |

**Fix:** Created migration `20260327_add_missing_tables` with all 11 tables, indexes, and foreign keys.

---

## High — Backend Bugs

### BUG-12: Theme Color Key Mismatch in Email Templates — FIXED
- **File:** `backend/src/routes/emailTemplates.ts:203`
- **Issue:** Accessed `themeConfig?.['--color-primary']` but stored keys use `'primary'` (no `--` prefix)
- **Fix:** Changed to `themeConfig?.['primary']`

### BUG-13: Same Theme Color Key Bug in Email Event Handler — FIXED
- **File:** `backend/src/events/handlers/EmailHandler.ts:86`
- **Fix:** Changed to `themeConfig?.['primary']`

---

## High — Frontend Bugs

### BUG-14: MapProvider Doesn't Check Response Status — FIXED
- **File:** `frontend/src/MapProvider.tsx:56-57`
- **Fix:** Added `if (!res.ok)` check before `res.json()`

### BUG-15: MapsSettings Missing Response Validation — FIXED
- **File:** `frontend/src/pages/MapsSettings.tsx:14`
- **Fix:** Added response status check on load

### BUG-16: MapsSettings Test Endpoint Missing Validation — FIXED
- **File:** `frontend/src/pages/MapsSettings.tsx:55`
- **Fix:** Added `if (!res.ok)` check on test and save endpoints

### BUG-17: Carriers Page Missing Optional Chaining on Search — NOT A BUG
- **File:** `frontend/src/pages/Carriers.tsx:62-64`
- **Review:** Code already uses `&&` short-circuit guards — safe as-is

### BUG-18: CarrierCreationForm Sets validatedAt Unconditionally — NOT A BUG
- **File:** `frontend/src/components/CarrierCreationForm.tsx:165-166`
- **Review:** Backend schema accepts `validatedAt DateTime?` — behaviour is intentional

### BUG-19: EmailTemplates Missing Event Type Validation — FIXED
- **File:** `frontend/src/pages/EmailTemplates.tsx:124`
- **Fix:** Added validation that `formEventType` is non-empty before POST

### BUG-20: EdiPartners Password Field Shows Redacted String — FIXED
- **File:** `frontend/src/pages/EdiPartners.tsx:144`
- **Fix:** Password field now starts blank on edit instead of pre-filling `[REDACTED]`

---

## Medium — Frontend Bugs

### BUG-21: Locations Page Silent Error on Load Failure — FIXED
- **File:** `frontend/src/pages/Locations.tsx:40-41`
- **Fix:** Added `loadError` state and visible alert banner

### BUG-22: GoogleMapPicker Missing useEffect Dependencies — NOT A BUG
- **Review:** MapPicker uses intentional `[]` for one-time Google Maps init, with a separate useEffect for prop changes. Correct pattern.

### BUG-23: AddressAutocomplete Debounce Race Condition — NOT A BUG
- **Review:** Debounce properly clears on each keystroke. Provider doesn't change mid-typing in practice.

---

## Low — Migration Ordering Issues

### BUG-24: Duplicate "init" Migration Names — WON'T FIX
- Cosmetic issue only. Migrations run correctly in order.

### BUG-25: GeneratedDocument Column Ordering Across Migrations — WON'T FIX
- Works correctly when migrations run in order.

---

## Summary

| Severity | Total | Fixed | Not a Bug | Won't Fix |
|----------|-------|-------|-----------|-----------|
| Critical | 11 | 11 | 0 | 0 |
| High | 9 | 6 | 2 | 0 |
| Medium | 3 | 1 | 2 | 0 |
| Low | 2 | 0 | 0 | 2 |
| **Total** | **25** | **18** | **4** | **2** |
