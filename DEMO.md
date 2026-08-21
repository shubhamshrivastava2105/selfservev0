# Demo script

Twelve minutes if you talk, four if you click.

```bash
npm run dev
```

**Dates look current whenever you run this.** Every record is positioned relative to
today, so the queue always shows invoices one, two and six days old rather than a fixed
date that has gone stale.

**Before you start:** open the browser window wide. Below 1200px the Ask Neo panel floats
over the page instead of docking beside it, and below 1024px the nav rail folds to icons.
Both are deliberate, but the side-by-side panel is the better story.

## The scenario switcher

Press **S**, or use the **Scenarios** button in the bottom right corner. Twenty-one named
states, one click each: every signup path, every exception, every terminal state. Each one
resets the prototype first, so scenarios never contaminate each other.

Use it two ways. Run the script below in order for a narrative, or jump straight to a
scenario when someone asks "what happens if…". **Opening position** puts everything back,
and so does reloading the page: state is React-only, with nothing persisted.

The switcher is a demo aid, not a feature. It floats over the app rather than sitting in
the navigation so nobody mistakes it for product, and it strips out cleanly (see the README).

Every section below names the scenario that jumps straight to it.

---

## 1. Signup decides everything (90 seconds)

*Scenarios: Domain already on Neoflo · First from a domain · Personal email address ·
Arrived on an invitation · Tenant exists, nothing open to join*

**Everyone signs up the same way**, with Google or an email and password. The domain check
runs after you authenticate, and it decides what happens next. The form starts empty, and
tells you which path you are on as you type:

| Type this | It says | Then Create account gives you |
| --- | --- | --- |
| `shubham.s@neoflo.ai` | neoflo.ai is already on Neoflo | The routing screen, with a workspace list |
| `ravi@acmefoods.com` | You will be the first from acmefoods.com | Profile screen. No list, because the organization did not exist until now |
| `shubham@gmail.com` | Use your work email address | **Nothing.** Both signup routes are disabled |

A personal address is refused outright: an organization is keyed on a company domain, so a
shared provider would put unrelated people in one tenant. Note that **Continue with Google
is disabled too**, not just the password route.

The fourth path, arriving on an invitation, has no entry on this screen by design: a real
invited user clicks a tokenised link in an email, which this prototype has no routes for.
Use the **Arrived on an invitation** scenario instead.

Each signup scenario stages this form rather than skipping to the outcome, so the shared
step stays visible. One click on **Create account** carries on.

For the rest of the demo, sign up as `shubham.s@neoflo.ai` and **Join** Finance.

**Worth pointing out on the routing screen:** the organization has a private *Payroll*
workspace, and nothing on this screen says so. Not a greyed-out row, not a count. Private
means a person with no access learns nothing, which also matters because managed tenants run
on private workspaces. It exists in the sample data purely to prove it never renders.

*AP EMEA* says **Request**, not Join: you get your own workspace immediately and the request
goes to its owner, so a pending approval never blocks you.

## 2. The landing page (60 seconds)

*Scenarios: First visit · Returning visit*

First visit greets you and leads with **Get to your first posted invoice**. Navigate away
and come back: it becomes **Good afternoon**, leads with what changed while you were away,
and the checklist shrinks to a single line showing only the next step.

**It is a chat window, not a dashboard.** The greeting is at the top, Neo's opening
messages follow (what changed, where you left off, the checklist), and the composer is
anchored at the bottom. Anything you ask continues the same thread. **New question** in the
bar clears it.

Click the **paperclip** to see what Neo is holding: 3 documents, 344 pages, the longest 214. Ask
**"What are our payment terms with Redwood?"** and it answers from page 18 of the master
agreement. That is the capability, since general assistants stop around thirty pages.

Then ask **"What is our office wifi password?"** It says it does not have enough
information rather than guessing.

## 2b. Upload your own documents (60 seconds)

*Scenarios: Nothing in the queue, then use Upload documents*

**Add invoices → Upload invoice and documents.** Drag real files in, or pick them. Neoflo
reads each filename and guesses what it is (invoice, purchase order, receipt, tax document)
and you correct anything it got wrong. The invoice number comes from the filename, so
`Invoice_88213.pdf` becomes INV-88213.

Then try **an invoice on its own**, with no PO or receipt beside it:

- The PO number is still read off the invoice face, because these are PO-based invoices.
- With Zoho connected, the purchase order is **fetched** and the audit trail says so.
- The receipt is not, because receipts live in Inventory, so a 3-way match hard blocks.
- With no ERP at all (*Hard block: no purchase order*), there is nothing to resolve against
  and you either type the number, attach the document, or reject.

## 3. Work an invoice (3 minutes)

*Scenarios: Four fields below threshold · Faktur Pajak attached · Hard block: no goods receipt · Cleared and ready to post*

**Invoices → INV-77120 → Open.** This is the whole workflow in one record.

- Four fields sit below the 85% threshold, each showing its **actual confidence score**,
  not just a color. **Run matching is disabled** until they are dealt with.
- Note the second alert: a **Faktur Pajak** is attached. Stored and carried to posting,
  never validated, never compared.
- Click **Acknowledge all**. Run matching lights up.
- **Run matching.** It hard blocks: no goods receipt, and the match type is 3-way. Read the
  reason. There is no override offered, because nothing was compared.
- **Upload the GRN.** Matching re-runs and all three checks pass.
- **Continue to posting → Post to Zoho Books.**

## 4. The three samples (2 minutes)

*Scenarios: Line variance against PO and GRN · Duplicate caught · Sample cannot post*

**Add invoices → Run a sample.** Three arrive: a clean match, a deliberate line variance,
and a duplicate of the first.

Open **INV-2026-4418** (the variance) and run matching. The variance table shows the
invoice value, the PO value, the GRN value and the difference against each. Override one
with a reason and watch the check flip to passed and the override land in the audit trail.

Open the **duplicate** and run matching. It finds the original, skips the other two checks,
and offers no override. A duplicate can only be rejected.

Try to post either one: **blocked, because they are sample data.** They finish at Exported
and stay out of reporting.

## 5. Memory forming (60 seconds)

*Scenario: One acknowledgment from a memory*

**Add invoices → Upload an invoice.** The vendor field reads `REDWOOD OFFICE SUPPLY CO` at
71% confidence, and underneath it Neo offers `Redwood Office Supply` from what it already
learned. Click to accept; it is never filled in behind you.

Run matching, then open the **Coding** tab and set a line's VAT code. Once the same code has
been chosen enough times for that vendor, the pattern is remembered and offered back on the
next line. GL is not set by hand: the ERP derives it from the purchase order and returns it
on a **Simulate**.

## 6. Ask Neo, in the workflow versus on the page (90 seconds)

With an invoice open, click **Ask about this invoice**. The panel docks beside the record
rather than covering it, and the nav rail folds so the room comes out of the chrome.

Ask **"Why does this need me?"** It answers about this invoice and cites it.

Now ask **"What are our payment terms with Redwood?"** It declines: from here it only reads
Invoice Processing. Click **Ask it there** and it carries the question to the full page and
answers it from the contract.

## 7. Configuration reaches only what runs next (60 seconds)

*Scenarios: Config changed, result did not · Straight-through, but inert*

**Workflow → Match type → 2-way.** Then open **INV-88213**, which is blocked for a missing
GRN. It is *still blocked*, and says the result was produced by a 3-way match. Nothing is
re-graded retroactively. Click **Re-run matching** and it clears.

**Workspace → turn Zoho Books off.** Go back to **Workflow**: straight-through processing
now warns that it is on but inert, because it has nowhere to post.

## 8. The rest (60 seconds)

- **Reporting** computes cycle time, touch time and the share matched against ERP data from
  the actual records, and logs everything you did this session.
- **Members** shows a role per workflow. The owner cannot be removed or suspended until
  ownership is transferred.
- **Workspace → Who can join** switches between public, needs-approval and private.
- The **theme toggle** in the bar works everywhere.

---

## Not represented, if someone asks

Three edge cases from the workflow PRD are not built:

1. **An invoice referencing several POs**, matched against the combined balance.
2. **An uploaded PO contradicting the Zoho PO**, where Zoho wins and the conflict is shown.
3. **A workflow turned off mid-processing.**

Also drawn rather than wired: the PDF viewer beside the extracted values, the Zoho and
mailbox OAuth flows, invite emails, and upload (it adds a fixed invoice rather than reading
a file you pick). Turning Zoho off does genuinely disable posting, so the consequences are
real even where the connection is not.

Tax codes, tolerances and confidence defaults stand in for the per-country data the SME
provides before build.
