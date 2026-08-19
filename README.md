# Neoflo — Self-Serve prototype

A clickable prototype of the self-serve journey, built from three PRDs:

- **User Journey for the Self-Serve Flow** — the five acts
- **Self-Serve · Signup, Onboarding & User Management** — hierarchy, routing, roles
- **Self-Serve · Workflow (Invoice Processing)** — ingestion, extraction, matching, posting, memory

Built with `@neofloai/atoms`. React + Vite + TypeScript. No backend, no database, no
persistence — everything is React state, so a reload resets it before the next demo.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open the URL Vite prints (http://localhost:5173 unless that port is taken).

## The path through it

Sign up → routing → profile → **Ask Neo** (landing) → **Invoices** → an invoice's
three stages → post or download. Configuration, Connections, Members and Reporting
hang off the nav rail. Every screen is reachable by clicking; nothing needs a URL.

Three onboarding paths are all reachable from the signup screen:

| What you do | Where it goes |
| --- | --- |
| Any `@company.com` address | Routing screen — the domain matches the existing tenant |
| **Join** a workspace marked *Joins instantly* | Straight in, auto-approve on |
| **Join** *AP — EMEA* (needs approval) | Your own workspace is provisioned now, request goes to its owner |
| **Create my own workspace** | New workspace in the same tenant, auto-named |
| A `@gmail.com` address | Skips routing — a public domain forms its own tenant |

## What is really wired

The matching engine computes; it is not a set of drawn states.

- **Confidence per field**, on the invoice *and* on uploaded POs and GRNs. Matching
  refuses to run until every below-threshold field is acknowledged or corrected.
  Correcting a value marks it verified.
- **Duplicate → metadata + line item.** Duplicate runs first on invoice number,
  vendor and legal entity; on a hit the other two are skipped. Variance shows the
  invoice value, the PO value, the GRN value and the difference against each.
- **The three hard blocks** — duplicate, no PO, no GRN in 3-way — offer no override.
  Everything else does, with a mandatory written reason that lands in the audit trail
  and in reporting's override count.
- **Config reaches only what runs next.** Switch to 2-way and an already-blocked
  invoice stays blocked until its stage re-runs. The result carries the match type it
  was produced under.
- **Memory.** Two patterns start at a streak of 2 against a threshold of 3, so
  assigning a GL code to a Redwood line forms a memory in front of you — offered back
  on the next line as a suggestion you accept, never filled in behind you.
- **Straight-through processing.** One invoice in the opening queue posted itself and
  never surfaced; it carries the same audit trail, and the queue has a filter for it.
- **Sample data never posts.** The three pre-computed samples complete at Exported and
  are excluded from reporting.
- **CSV export** is a real download — the output of the matching, one row per line with
  the PO and GRN values beside it. A bulk download does not close an invoice that has
  not cleared matching.
- **Reporting** computes cycle time, touch time, time to first processed invoice and
  the share matched against ERP data from the actual records in state.
- **Ask Neo** answers from live workspace state with citations, and says *"I don't have
  enough information"* rather than guessing.
- **Colour scheme** switches light/dark from the bar.

## What is drawn but not wired

- **Source documents.** The PDF pane beside the extracted values is a placeholder —
  there is no real document to render.
- **Zoho and the mailbox.** Connecting them is a toggle, not an OAuth flow. Turning
  Zoho Books off genuinely disables posting and makes STP inert, so the consequence is
  real even though the connection is not.
- **Uploading** adds a fixed invoice rather than reading a file you choose.
- **Invites and emails.** An invite adds a pending row; no mail is sent.
- **Suspend, remove and ownership transfer** change state but have no backend.
- **The workspace switcher** lists the one workspace you are in; creating one from it
  is a named dialog that does not persist.
- Tax codes, tolerances and confidence defaults stand in for the per-country data the
  SME provides before build.

## Where things live

```
src/
  data.ts        every piece of sample data, and the sample/upload factories
  types.ts       the domain model
  engine.ts      matching, duplicate detection, tolerance, CSV — all pure
  store.tsx      one store, React state only
  components/    shell (rail + bars), and the shared confidence field
  screens/       Onboarding · AskNeo · Queue · InvoiceDetail · Settings · People
```

Change what is on screen in `src/data.ts` — vendors, amounts, members, memory streaks,
defaults. No component needs opening.

## One note on the design system

`Atoms`' `Select` can only take an accessible name through its visible `label` prop —
it omits `slotProps`, and MUI 9 dropped the nested `SelectProps` forward — so a select
sitting bare in a table cell has no name for a screen reader. Two places worked around
it: coding is a list of labelled fields rather than a grid of bare selects, and the
members table uses a named button with a menu. Worth an Atoms component request if
coding grids become common.

## Open questions the PRDs left

Surfaced in the UI where they bite, rather than hidden:

- Whether the 7-minute activation target counts a pre-computed invoice (Reporting).
- One OAuth grant with two consumers, not two, for the mailbox (Connections).
- Whether connecting a folder pulls in mail already sitting there (Connections).
- Ask Neo is English-only while invoice processing reads four languages (Ask Neo).
- Role vocabulary differs between the Ask Neo PRD and the other two.
