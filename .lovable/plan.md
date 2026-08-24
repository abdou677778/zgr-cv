## ZGR CV — Quick CV Builder

A single-page app where the user fills a form on the left and sees a live CV preview on the right, then prints/exports to PDF via the browser print dialog. No backend, no accounts — data persists in localStorage so refresh keeps the work.

### Scope (v1)
- Header: app title "ZGR CV" + "Print / Save as PDF" button
- Left panel — form sections:
  - Personal info: full name, job title, email, phone, location, short summary
  - Experience (repeatable): role, company, start/end, description
  - Education (repeatable): degree, school, start/end
  - Skills: comma-separated tags
- Right panel — live A4-styled CV preview rendered from the form state
- Print stylesheet: hides the form, prints only the CV at A4
- LocalStorage autosave + "Reset" button

### Tech
- Single route `src/routes/index.tsx` replacing the placeholder
- shadcn `Input`, `Textarea`, `Button`, `Card`, `Label`, `Separator` (already in project)
- Zod validation on inputs (lengths, email)
- No Lovable Cloud, no auth, no payments

### Out of scope (v1)
- Multiple templates/themes, multi-page CV, server-side PDF, sharing links, accounts

If you want a different scope (e.g. multiple templates, accounts, downloadable PDF without print dialog), tell me before I build.