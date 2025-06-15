# Copilot Instructions for **MoBank** (and **MoTools**) – Agent Mode

## 1&nbsp;·&nbsp;Project Snapshot

* **Type:** Classroom-management web app (vanilla JS, HTML, CSS)
* **Purpose:** Track and adjust virtual student currency **MoBucks**
* **Hosting:** Vercel
* **Auth:** Auth0 (RBAC; teachers carry `admin` claim)
* **DB:** Firebase Firestore
* **Public Domain:** [mo-classroom.us](https://mo-classroom.us)
* **Auth0 Domain:** [dev-nqdfwemz14t8nf7w.us.auth0.com](https://dev-nqdfwemz14t8nf7w.us.auth0.com)

## 2&nbsp;·&nbsp;Canonical Folder Layout

| Path | Purpose |
|------|---------|
| `/pages`   | HTML pages (no inline JS/CSS) |
| `/js`      | Front-end logic (ES Modules only) |
| `/css`     | Global & component styles |
| `/data`    | Static JSON / seed data |
| `/images`  | Optimized assets |
| `/api`     | Vercel serverless functions (`[[...slug]].js` catch-all) |
| `/routes`  | Client-side route helpers |
| `/tools`   | **MoTools** – ancillary teacher/student utilities |
| `/tools/js`, `/tools/css`, … | Same structure as root |

 **Stay inside this structure – don’t create new top-level folders.**

## 3&nbsp;·&nbsp;Golden Rules

1. **Keep it modern & idiomatic** – ES2023+, async/await, const/let, arrow funcs.
2. **Zero inline `<script>`/`<style>` tags** and no external CDNs unless indispensable.
3. **Modularize** – one concern per file; export pure functions.
4. **Caching first** – always pipe API reads/writes through `js/cache.js`.
5. **Be terse** – comment very rarely and only when the code is non-obvious; no excess `console.log` unless during debugging.
6. **Security matters**
   * Validate every input (client & server). Never trust user input.
   * Never expose secrets; use Vercel/Firestore env vars.
   * Enforce Auth0 scopes (only `admin` for now) on both ends.
7. **If it isn’t broken, leave it** – refactor only for clear wins (perf, clarity, security).

## 4&nbsp;·&nbsp;Agent-Mode Workflow

| Step | Expectation |  
|------|-------------|
| _Analyze_ | Read existing code & docs before generating anything. |
| _Plan_    | Outline changes before coding. |
| _Implement_ | Follow sections **2** & **3** above. |
| _Self-test_ | Audit code and ensure functionality. |
| _Commit_ | Succinct messages: `feat:`, `fix:`, `perf:`, etc. |
| _Review_ | Flag any security or performance regressions for human oversight. |

## 5&nbsp;·&nbsp;Style Guide

* **Linting:** ESLint w/ Airbnb base (auto-fix on save).
* **Formatting:** Prettier default rules.
* **CSS:** Mobile-first; use CSS custom properties; no bulky frameworks.
* **Accessibility:** WAI-ARIA where needed; keyboard nav a must.

## 6&nbsp;·&nbsp;When in Doubt

* Prefer **clarity over cleverness**.
* Ask for needed env vars rather than hard-coding.
* Surface uncertainties to user; don't silently assume.

**Remember:** fast, secure, maintainable.
