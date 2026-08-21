# Neoflo Self-Serve

A clickable prototype of the self-serve flow, built from three PRDs: the User Journey
for the Self-Serve Flow, Self-Serve Signup/Onboarding/User Management, and Self-Serve
Workflow (Invoice Processing).

Twelve screens, real matching logic, no backend. Built with `@neofloai/atoms` on React,
Vite and TypeScript.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open the URL Vite prints. It picks 5173 unless that port is taken.

`package.json` depends on `github:neofloai/atoms`, so anyone installing this needs
access to that repo.

A click-by-click demo script lives in [DEMO.md](DEMO.md).

**Scenario switcher.** Press **S** in the running app, or use the Scenarios button in the
bottom right. Twenty-one named states, one click each, covering every signup path and
exception. It is a demo aid rather than a feature: to strip it out, delete
`src/scenarios.ts`, `src/components/ScenarioSwitcher.tsx`, the `applyScenario` block in
`src/store.tsx`, and the one line that renders it in `src/App.tsx`.

## 1. The path through it

Sign up, route, profile, then land in Ask Neo. Work an invoice from the queue through
its three stages and post or export it. Configuration, Connections, Members and
Reporting sit on the nav rail. Every screen is reachable by clicking.

Three onboarding routes all start from the signup screen:

| What you do | Where it goes |
| --- | --- |
| Any `@company.com` address | Routing screen, because the domain matches the existing tenant |
| **Join** a workspace marked *Joins instantly* | Straight in |
| **Request** *AP EMEA*, which needs approval | You get your own workspace now, and the request goes to that owner |
| **Create my own workspace** | New workspace in the same tenant, named for you |
| A `@gmail.com` address | Refused. Both signup routes disable, because an organization is keyed on a company domain |

## 2. What actually works

The matching engine computes. These are not drawn states.

- **Confidence per field**, on the invoice and on uploaded POs and GRNs. Matching
  refuses to run until every below-threshold field is acknowledged or corrected.
  Correcting a value marks it verified.
- **Duplicate, then metadata and line item.** Duplicate runs first on invoice number,
  vendor and legal entity. On a hit the other two skip. A variance shows the invoice
  value, the PO value, the GRN value and the difference against each.
- **Three hard blocks** (duplicate, no PO, no GRN in 3-way) offer no override.
  Everything else does, with a mandatory written reason that lands in the audit trail
  and in the override count in Reporting.
- **Configuration reaches only what runs next.** Switch to 2-way and an already-blocked
  invoice stays blocked until its stage re-runs. Each result carries the match type that
  produced it.
- **Memory forms while you watch.** Two patterns start at a streak of 2 against a
  threshold of 3, so assigning a GL code to a Redwood line crosses the threshold and
  gets offered on the next line as a suggestion you accept.
- **Straight-through processing.** One invoice in the opening queue posted itself and
  never surfaced. It carries the same audit trail, and the queue filters for it.
- **Sample data never posts.** The three pre-computed samples finish at Exported and
  stay out of Reporting.
- **CSV export downloads for real.** One row per line, with the PO and GRN values
  beside it. A bulk download does not close an invoice that has not cleared matching.
- **Reporting computes** cycle time, touch time, time to first processed invoice and the
  share matched against ERP data from the records in state.
- **Ask Neo answers from live state** with citations, and says "I don't have enough
  information" rather than guessing. Open it from any screen with the Ask Neo button;
  opened from an invoice, it answers about that invoice.
- **Ask Neo is one chat surface.** The greeting sits at the top, then Neo's opening
  messages: what changed since your last visit as three numbers, the invoice you had open
  last, and the activation checklist. The composer is anchored at the bottom with an
  attachment control, and your conversation continues in the same thread.
- **Attaching a document is the paperclip**, and it also lists what Neo already holds
  (with page counts) and what else it can read. There is no separate document panel.
- **Workspace visibility** is public, needs-approval, or private, and new workspaces
  start public. Private workspaces never appear on the routing screen, which the
  Payroll workspace in the sample data exists to prove.
- **Open and Closed tabs** on the queue, matching the shipped product. You land on
  Open, and the status filter offers only the statuses that tab can contain.
- **Attachments that are not matching inputs.** A Faktur Pajak or delivery note is stored
  and carried to posting, never validated and never compared.
- **Upload is real.** Drag files in or pick them; Neoflo classifies each by filename, you
  correct it, and the invoice number comes from the file you gave it. Extracted values are
  representative rather than read from the PDF.
- **An invoice on its own resolves properly.** The PO number is read from the invoice face,
  fetched from Zoho where it is connected, and hard blocks where it is not.
- **Light and dark** both ship, switchable from the bar.

## 3. What is drawn but not wired

- **Source documents.** The PDF pane beside the extracted values is a placeholder.
- **Zoho and the mailbox.** Connecting them is a toggle, not an OAuth flow. Turning Zoho
  Books off does genuinely disable posting and make STP inert, so the consequence is
  real even though the connection is not.
- **Invites** add a pending row. No mail goes out.
- **Suspend, remove and ownership transfer** change state with no backend behind them.
- **The workspace switcher** lists the one workspace you are in. Creating one from it asks
  for a name and a visibility setting but does not persist.
- Tax codes, tolerances and confidence defaults stand in for the per-country data the
  SME provides before build.

## 4. Where things live

```
src/
  clock.ts       one clock. Every date is an ISO timestamp, formatted at render
  data.ts        all sample data, plus the sample and upload factories
  types.ts       the domain model
  engine.ts      matching, duplicate detection, tolerance, CSV. All pure.
  neo.ts         Ask Neo's answer engine, shared by the page and the panel
  store.tsx      one store, React state only
  components/    shell (rail and bars), Ask Neo panel, shared confidence field
  screens/       Onboarding, AskNeo, Queue, InvoiceDetail, Settings, People
```

Change what appears on screen in `src/data.ts`: vendors, amounts, members, memory
streaks, defaults. No component needs opening.

**Dates are never hardcoded.** Seed records are positioned relative to the moment the app
loads (`at(2, 9, 19)` is "two days ago at 9:19"), so an invoice that reads two days old
still reads that way next month. Nothing is stored as a display string, and dates are
formatted at the point they are rendered in US convention.

State lives in React only, with no persistence, so a reload resets the demo before the
next one.

## 5. One note on the design system

Atoms' `Select` can only take an accessible name from its visible `label` prop. It omits
`slotProps`, and MUI 9 dropped the nested `SelectProps` forward, so a bare select in a
table cell has no name for a screen reader. Two places work around it: coding uses
labeled fields instead of a grid of bare selects, and the members table uses a named
button with a menu. This is worth an Atoms component request if coding grids become
common.

## 6. Edge cases not built

The switcher covers everything that is built. These three are not:

Three from the workflow PRD's own table:

1. An invoice referencing several POs, matched against the combined balance.
2. An uploaded PO contradicting the Zoho PO, where Zoho wins and the conflict is shown.
3. A workflow turned off mid-processing.

## 7. Open questions the PRDs left

These surface in the UI where they bite, rather than hiding in a doc.

1. Whether the 7-minute activation target counts a pre-computed invoice (Reporting).
2. One OAuth grant with two consumers instead of two grants, for the mailbox
   (Connections).
3. Whether connecting a folder pulls in mail already sitting there (Connections).
4. Ask Neo is English only while invoice processing reads four languages (Ask Neo).
5. Role vocabulary differs between the Ask Neo PRD and the other two.
