import * as React from 'react';
import { Box, Chip, Divider, Stack, Typography } from '@neofloai/atoms';
import { PageBody } from '../components/common';
import { ShellBar } from '../components/shell';
import { useStore } from '../store';

/**
 * Product documentation.
 *
 * Global on purpose: this describes how Neoflo works, which is the same
 * wherever you are, so it names no workspace and prints nobody's settings. Where
 * a number is configurable it says where the setting lives rather than what it
 * currently is — otherwise this page would quietly become a second, stale copy
 * of the configuration screens.
 *
 * Written short. A reader who opened the docs has already hit something they did
 * not expect, and a wall of prose is not what helps.
 */

function Article({
  id,
  title,
  summary,
  children,
}: {
  id: string;
  title: string;
  summary: string;
  children?: React.ReactNode;
}) {
  return (
    <Stack component="section" id={id} sx={{ gap: 1, scrollMarginTop: 24 }}>
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {summary}
      </Typography>
      {children}
    </Stack>
  );
}

/** A term and what it means, for the handful that carry real weight. */
function Term({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <Stack direction="row" sx={{ gap: 2, alignItems: 'flex-start' }}>
      <Typography variant="body2" weight="medium" sx={{ width: 150, flexShrink: 0 }}>
        {term}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
        {children}
      </Typography>
    </Stack>
  );
}

const CONTENTS = [
  { id: 'stages', label: 'The three stages' },
  { id: 'checks', label: 'What gets checked' },
  { id: 'blocks', label: 'When it stops' },
  { id: 'confidence', label: 'Confidence and corrections' },
  { id: 'memory', label: 'What it remembers' },
  { id: 'askneo', label: 'Ask Neo' },
  { id: 'settings', label: 'Where the settings are' },
];

export function DocumentationScreen() {
  const { goTo } = useStore();

  return (
    <>
      <ShellBar />
      <PageBody maxWidth={860}>
        <Stack sx={{ gap: 4 }}>
          <Stack sx={{ gap: 0.5 }}>
            <Typography variant="h3" component="h1">
              Documentation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              How Neoflo reads an invoice, what it checks, and what it does when something does not
              line up. The same for every workspace.
            </Typography>
          </Stack>

          {/* A short index, because seven sections is enough to want one and
              few enough not to need a sidebar. */}
          <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
            {CONTENTS.map((item) => (
              <Chip
                key={item.id}
                size="sm"
                appearance="outline"
                variant="secondary"
                label={item.label}
                onClick={() =>
                  document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })
                }
              />
            ))}
          </Stack>

          <Divider />

          <Article
            id="stages"
            title="The three stages"
            summary="Every invoice takes the same route, and only moves forward."
          >
            <Stack sx={{ gap: 1.25, mt: 0.5 }}>
              <Term term="Extraction">
                The invoice is read. Each field carries how confident the read was, and clicking a
                field shows you where on the page it came from. Correct anything wrong; the
                correction becomes the record's own value.
              </Term>
              <Term term="Matching">
                The invoice is compared against its purchase order, and against the goods receipt
                too where the workflow is set to a 3-way match. Differences inside tolerance pass
                quietly; anything beyond it waits for you.
              </Term>
              <Term term="ERP posting">
                The payload that will be written to your accounting system, with the tax codes per
                line. Simulate first — that is a dry run which reports back the GL accounts the
                posting will land in without writing anything.
              </Term>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              You can look back at a stage the invoice has already passed. That is a read: the
              record stays where it is, and nothing on an earlier stage can be edited.
            </Typography>
          </Article>

          <Article
            id="checks"
            title="What gets checked"
            summary="Three things, in this order. The first one to fail stops the rest."
          >
            <Stack sx={{ gap: 1.25, mt: 0.5 }}>
              <Term term="Duplicate">
                Whether this invoice has been seen before. Which fields count as the same invoice is
                configurable — by default the invoice number, the vendor and the legal entity.
              </Term>
              <Term term="Metadata">
                Vendor, currency and totals against the purchase order. Vendor names are compared
                loosely enough to ignore legal-entity suffixes, punctuation and casing.
              </Term>
              <Term term="Line items">
                Quantity, unit price and line total per line, against the purchase order and the
                receipt. Each of the three comparisons can be turned off.
              </Term>
            </Stack>
          </Article>

          <Article
            id="blocks"
            title="When it stops"
            summary="Three situations cannot be waved through, because there is nothing to check against."
          >
            <Stack sx={{ gap: 1.25, mt: 0.5 }}>
              <Term term="A duplicate">
                Reject it to close the invoice. The other checks are skipped — there is no point
                matching an invoice you have already paid.
              </Term>
              <Term term="No purchase order">
                Type the PO number, attach the purchase order, or reject the invoice.
              </Term>
              <Term term="No goods receipt">
                Only on a 3-way match. Attach the receipt, or change the workflow to a 2-way match.
              </Term>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              A variance beyond tolerance is different: that one you can override, with a written
              reason, and the reason is kept on the invoice.
            </Typography>
          </Article>

          <Article
            id="confidence"
            title="Confidence and corrections"
            summary="A low-confidence read is flagged, never blocking."
          >
            <Typography variant="body2" color="text.secondary">
              Every read gets a score. Below the workflow's threshold, the field is flagged and the
              invoice says a person should look — but nothing is gated, and you can carry on.
              Correcting a field marks it as verified, clears the flag, and updates the invoice
              itself, so the dashboard and reporting agree with what you saw.
            </Typography>
          </Article>

          <Article
            id="memory"
            title="What it remembers"
            summary="Repetition, not instruction."
          >
            <Typography variant="body2" color="text.secondary">
              Code the same kind of line the same way often enough and that becomes a pattern, which
              is then offered back as a suggestion you accept or ignore. Vendor-name corrections work
              the same way. Nothing is remembered from a single instance, and nothing is applied
              without being offered first.
            </Typography>
          </Article>

          <Article
            id="askneo"
            title="Ask Neo"
            summary="It answers from your records and your documents, and says so when it cannot."
          >
            <Typography variant="body2" color="text.secondary">
              On its own page, Ask Neo reads across the workflows you hold a role in and the
              documents you attached — however long they are. Attach reading material with the
              paperclip; tick a document off to leave it out of answers without losing it. Inside an
              invoice, the panel deliberately stays on that invoice.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Answers cite the record or the page they came from. When there is nothing to answer
              from, it says that rather than guessing.
            </Typography>
          </Article>

          <Article
            id="settings"
            title="Where the settings are"
            summary="Two levels, and they hold different things."
          >
            <Stack sx={{ gap: 1.25, mt: 0.5 }}>
              <Term term="Workspace">
                What the workspace connects to and who can join it: the accounting system, the
                mailbox invoices arrive in, ticketing.{' '}
                <Box
                  component="button"
                  type="button"
                  onClick={() => goTo('workspace-config')}
                  sx={{
                    background: 'none',
                    border: 'none',
                    p: 0,
                    font: 'inherit',
                    color: 'primary.main',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Open workspace configuration
                </Box>
              </Term>
              <Term term="Workflow">
                How invoices are read and matched: match type, the confidence threshold, tolerances,
                which line comparisons run, and when a memory forms.{' '}
                <Box
                  component="button"
                  type="button"
                  onClick={() => goTo('workflow-config')}
                  sx={{
                    background: 'none',
                    border: 'none',
                    p: 0,
                    font: 'inherit',
                    color: 'primary.main',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Open workflow configuration
                </Box>
              </Term>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Both arrive filled in with sensible defaults, so there is nothing to set up before you
              start. A change applies to what runs next — invoices already decided are not
              re-graded.
            </Typography>
          </Article>
        </Stack>
      </PageBody>
    </>
  );
}
