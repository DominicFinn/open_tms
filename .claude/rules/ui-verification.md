---
paths:
  - "frontend/src/**/*.{ts,tsx}"
  - "frontend-shadcn-preview/**/*.{ts,tsx}"
---

# UI Completion Verification — CRITICAL

**Never assume UI work is done. Always verify it.**

When implementing or modifying any frontend feature, you MUST complete ALL of the following before
reporting the work as finished.

## Field-Level Completeness

- Every field defined in the backend schema/API response MUST have a corresponding UI element
  (form input, table column, detail display, or deliberate omission with a reason)
- When adding a new entity or modifying a schema, cross-reference the Prisma model, the API
  response DTO, and the UI form/table/detail page to confirm every field is accounted for
- Check create forms, edit forms, detail/view pages, and list/table views **separately** — a field
  present in the create form but missing from the detail page is incomplete

## End-to-End Verification Checklist

1. **Form submissions** — Does the create/edit form actually send all fields to the API? Check the
   fetch/axios call payload matches the form state
2. **API integration** — Does the frontend read all fields from the API response and display them?
   Check the response mapping
3. **Validation** — Are required fields enforced in the UI? Do error messages display correctly?
4. **Loading states** — Does the UI show loading indicators while data is being fetched?
5. **Error states** — Does the UI handle API errors gracefully (network failures, validation
   errors, 404s)?
6. **Empty states** — Does the UI handle empty/null data without crashing or showing "undefined"?
7. **Navigation** — Can the user get to this page? Is it linked from the sidebar, a list page, or
   a parent page?
8. **TypeScript** — Does the frontend code compile without type errors? Run `npx tsc --noEmit` in
   the frontend directory

## How to Verify

- **Read the component code** and trace the data flow: API call → state → render. Do not just check
  that the file exists
- **Start the dev server** (`cd frontend && npm run dev`) and open the page in a browser when possible
- **Compare the form fields against the API endpoint's request schema** to ensure nothing is missing
- **Compare the display fields against the API endpoint's response schema** to ensure nothing is missing
- If you cannot start the dev server, explicitly state "I was unable to verify this in a browser"
  and explain what you checked instead

## Common Failures to Watch For

- Form has fields in the UI but the submit handler does not include them in the API payload
- Detail page fetches data but only renders half the fields
- Table page is missing columns for important fields
- Create form works but edit form does not pre-populate existing values
- Dropdown/select fields have no options, or hardcoded options instead of fetching from the API
- Modal forms that close on submit but do not refresh the parent list
- New pages added but not wired into the router or sidebar navigation
