/**
 * Ask Neo's answer engine, shared by the dedicated page and the panel that
 * opens over your work.
 *
 * Answers are grounded in the workspace's own records. Where there is no
 * grounded source the answer says so rather than guessing.
 */

import { money } from './engine';
import { formatDate, formatDateTime } from './clock';
import type {
  Citation,
  Connections,
  GroundingSource,
  IndexedDocument,
  Invoice,
  Member,
  MemoryPattern,
  NeoScope,
  WorkflowConfig,
} from './types';

export interface NeoContext {
  invoices: Invoice[];
  memory: MemoryPattern[];
  config: WorkflowConfig;
  members: Member[];
  documents: IndexedDocument[];
  connections: Connections;
}

export interface NeoAnswer {
  text: string;
  citations?: Citation[];
  ungrounded?: boolean;
  /**
   * Set when the question is sound but this surface cannot reach far enough to
   * answer it. The panel offers to carry it to the full page rather than
   * leaving the user to retype it.
   */
  outOfScope?: boolean;
}

function cite(invoice: Invoice): Citation {
  return {
    label: invoice.number,
    detail: `${formatDate(invoice.invoiceDate)} · ${invoice.status}`,
  };
}

/** Why an invoice is sitting where it is, in one clause. */
export function whyItNeedsYou(invoice: Invoice, config: WorkflowConfig): string {
  const block = invoice.matchResult?.hardBlock;
  if (block === 'no-grn') return 'no goods receipt, and the match type is 3-way';
  if (block === 'no-po') return 'no purchase order to match against';
  if (block === 'duplicate') return 'a duplicate of an invoice already processed';
  if (invoice.stage === 'extraction') {
    const pending = [...invoice.invoiceFields, ...invoice.poFields, ...invoice.grnFields].filter(
      (f) => f.confidence !== null && f.confidence < config.confidenceThreshold && !f.acknowledged,
    ).length;
    return `${pending} field${pending === 1 ? '' : 's'} below the ${config.confidenceThreshold}% confidence threshold`;
  }
  return 'a variance beyond tolerance';
}

/* ── Documents ────────────────────────────────────────────────────────── */

const GENERIC_TITLE_WORDS = new Set([
  'vendor', 'vendors', 'invoice', 'invoices', 'purchase', 'order', 'orders',
  'policy', 'policies', 'report', 'handbook', 'document', 'documents',
  'agreement', 'contract', 'master', 'services', 'service', 'group', 'bundle',
  'matrix', 'memorandum', 'onboarding', 'approval',
]);

/**
 * Answers from an indexed document, with the page it came from.
 *
 * This is the capability the page exists to expose: a 214-page agreement is
 * answerable across its whole length, where a general assistant caps out around
 * thirty pages and refuses the file.
 */
function answerFromDocuments(q: string, documents: IndexedDocument[]): NeoAnswer | null {
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  if (words.length === 0) return null;

  const hits: { doc: IndexedDocument; page: number; text: string; score: number }[] = [];
  for (const doc of documents) {
    // Naming the document or its counterparty is a strong signal about which one
    // you mean, so it outweighs a topic word several documents share. Generic
    // nouns in a title do not count: "vendor" in a question is a common noun,
    // not a reference to the handbook that happens to be called that.
    const nameWords = doc.name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 && !GENERIC_TITLE_WORDS.has(w));
    const namedBonus = nameWords.some((w) => q.includes(w)) ? 3 : 0;

    for (const passage of doc.passages) {
      const topical = passage.topics.reduce(
        (total, topic) => total + (q.includes(topic) ? 2 : words.some((w) => topic.includes(w)) ? 1 : 0),
        0,
      );
      if (topical > 0) {
        hits.push({ doc, page: passage.page, text: passage.text, score: topical + namedBonus });
      }
    }
  }
  if (hits.length === 0) return null;

  hits.sort((a, b) => b.score - a.score);
  /**
   * Only passages that come close to the best match. A loose word overlap on a
   * shared topic is not an answer, and padding a good citation with two weak
   * ones is how a grounded answer stops feeling grounded.
   */
  const best = hits[0].score;
  const top = hits.filter((hit) => hit.score >= best * 0.75).slice(0, 2);
  return {
    text: top
      .map((hit) => `From ${hit.doc.name}, page ${hit.page}:\n"${hit.text}"`)
      .join('\n\n'),
    citations: top.map((hit) => ({
      label: hit.doc.name.replace(/\.pdf$/, ''),
      detail: `page ${hit.page} of ${hit.doc.pages}`,
    })),
  };
}

/** What Ask Neo can reach, for the grounding summary on the page. */
export function groundingSources(ctx: NeoContext): GroundingSource[] {
  const totalPages = ctx.documents.reduce((sum, d) => sum + d.pages, 0);
  return [
    {
      label: 'Invoice Processing',
      detail: `${ctx.invoices.length} invoice records, with their POs, receipts and audit trails`,
      connected: true,
    },
    {
      label: 'Indexed documents',
      detail:
        ctx.documents.length === 0
          ? 'Nothing indexed yet'
          : `${ctx.documents.length} documents, ${totalPages.toLocaleString('en-US')} pages`,
      connected: ctx.documents.length > 0,
    },
    {
      label: 'Zoho Books',
      detail: ctx.connections.zohoBooks
        ? 'Purchase orders, bills, chart of accounts, vendor master'
        : 'Not connected',
      connected: ctx.connections.zohoBooks,
    },
    {
      label: 'Mailbox',
      detail: ctx.connections.mailboxProvider
        ? `${ctx.connections.mailboxAddress} · ${ctx.connections.mailboxFolder}`
        : 'Not connected',
      connected: Boolean(ctx.connections.mailboxProvider),
    },
    {
      label: 'Ticketing',
      detail: ctx.connections.ticketing
        ? `${ctx.connections.ticketing === 'freshdesk' ? 'Freshdesk' : 'Zendesk'} tickets and their attachments`
        : 'Not connected',
      connected: Boolean(ctx.connections.ticketing),
    },
  ];
}

/* ── Questions about one invoice ──────────────────────────────────────── */

function answerAboutInvoice(q: string, invoice: Invoice, ctx: NeoContext): NeoAnswer | null {
  const { config } = ctx;
  const result = invoice.matchResult;

  if (/why|blocked|stuck|wrong|problem|fail/.test(q)) {
    if (invoice.status === 'Action Required') {
      const block = result?.hardBlock;
      const overridable = !block;
      return {
        text: `${invoice.number} needs you because of ${whyItNeedsYou(invoice, config)}.\n\n${
          overridable
            ? 'You can correct the extraction, override it with a written reason, or reject it. An override is logged with your name, the rule bypassed and the reason.'
            : 'This one is a hard block, so there is no override. An override records a judgment about a discrepancy the system found and showed, and nothing was compared here.'
        }`,
        citations: [cite(invoice)],
      };
    }
    return {
      text: `Nothing is blocking ${invoice.number}. It is ${invoice.status.toLowerCase()}.`,
      citations: [cite(invoice)],
    };
  }

  if (/variance|difference|match|po|grn|receipt/.test(q)) {
    if (!result) {
      return {
        text: `Matching has not run on ${invoice.number} yet. It runs once every low-confidence field is acknowledged or corrected.`,
        citations: [cite(invoice)],
      };
    }
    const lines = result.lineItem.findings.map(
      (f) =>
        `• ${f.description} — ${f.field === 'unitPrice' ? 'unit price' : f.field === 'lineTotal' ? 'line total' : 'quantity'}: invoice ${f.invoiceValue}, PO ${f.poValue}${
          f.grnValue !== null ? `, GRN ${f.grnValue}` : ''
        } (${f.diffVsPo > 0 ? '+' : ''}${f.diffVsPo} against the PO)`,
    );
    const meta = result.metadata.findings.map(
      (f) => `• ${f.field}: invoice ${f.invoiceValue} against ${f.poValue}`,
    );
    // A hard block stops the comparison before it happens, so empty findings
    // are not a pass. Saying "passed all three checks" next to a screen showing
    // a block is the worst thing this answer could do.
    if (result.hardBlock) {
      const blocked =
        result.hardBlock === 'duplicate'
          ? 'The duplicate check hit, so metadata and line item were skipped. There is nothing to compare.'
          : result.hardBlock === 'no-po'
            ? 'There is no purchase order to match against, so metadata and line item have not run.'
            : 'There is no goods receipt and the match type is 3-way, so metadata and line item have not run.';
      return {
        text: `Nothing has been compared on ${invoice.number} yet. ${blocked}\n\nSupply the missing document, or reject the invoice. Matching re-runs as soon as you do.`,
        citations: [cite(invoice)],
      };
    }

    if (result.metadata.state === 'pending' || result.lineItem.state === 'pending') {
      return {
        text: `Matching has not finished on ${invoice.number}. The metadata and line-item checks have not run yet, so there is no variance to show.`,
        citations: [cite(invoice)],
      };
    }

    if (lines.length === 0 && meta.length === 0) {
      return {
        text: `${invoice.number} passed all three checks on a ${result.matchTypeUsed} match. Reference data came from ${
          invoice.poSource === 'zoho' ? 'Zoho, as structured ground truth' : 'uploaded documents, so both sides carry a confidence score'
        }.`,
        citations: [cite(invoice)],
      };
    }
    return {
      text: `${invoice.number}, on a ${result.matchTypeUsed} match:\n\n${[...meta, ...lines].join('\n')}`,
      citations: [cite(invoice)],
    };
  }

  if (/who|touched|history|audit|change/.test(q)) {
    return {
      text: invoice.audit
        .slice()
        .reverse()
        .slice(0, 6)
        .map((entry) => `• ${entry.action} — ${entry.actor}, ${formatDateTime(entry.at)}${entry.detail ? `. ${entry.detail}` : ''}`)
        .join('\n'),
      citations: [cite(invoice)],
    };
  }

  if (/vendor|before|history|previous|other/.test(q)) {
    const theirs = ctx.invoices.filter((i) => i.vendor === invoice.vendor && i.id !== invoice.id);
    if (theirs.length === 0) {
      return {
        text: `${invoice.vendor} has no other invoices in this workspace.`,
        citations: [cite(invoice)],
      };
    }
    const total = theirs.reduce((sum, i) => sum + i.amount, 0);
    return {
      text: `${theirs.length} other invoice${theirs.length === 1 ? '' : 's'} from ${invoice.vendor}, totaling ${money(total)}:\n\n${theirs
        .map((i) => `• ${i.number} — ${money(i.amount, i.currency)}, ${formatDate(i.invoiceDate)}, ${i.status}`)
        .join('\n')}`,
      citations: theirs.map(cite),
    };
  }

  if (/override|reason/.test(q)) {
    if (invoice.overrides.length === 0) {
      return {
        text: `No overrides on ${invoice.number}.`,
        citations: [cite(invoice)],
      };
    }
    return {
      text: invoice.overrides
        .map((o) => `• ${o.rule} — ${o.actor}, ${formatDateTime(o.at)}: "${o.reason}"`)
        .join('\n'),
      citations: [cite(invoice)],
    };
  }

  return null;
}

/* ── Questions about the workspace ────────────────────────────────────── */

export function answerQuestion(
  question: string,
  ctx: NeoContext,
  options: { scope?: NeoScope; focus?: Invoice | null } = {},
): NeoAnswer {
  const { scope = 'workspace', focus = null } = options;
  const q = question.toLowerCase();
  const { invoices, config, memory, members, documents } = ctx;

  // A question asked from inside an invoice is about that invoice first.
  if (focus) {
    const scoped = answerAboutInvoice(q, focus, ctx);
    if (scoped) return scoped;
  }

  /**
   * Vocabulary that only a document or another system can answer. Checked before
   * anything else in workflow scope, because a contract question that happens to
   * name a vendor would otherwise fall into the vendor lookup and come back with
   * invoice totals: an answer to a question nobody asked.
   */
  const needsDocuments =
    /contract|agreement|\bmsa\b|clause|policy|handbook|memorandum|\bpage\b|document|payment terms|\bterms\b|notice|termination|escalat|onboard|\bw-?9\b|ticket/.test(
      q,
    );

  if (scope === 'workflow' && needsDocuments) {
    return {
      text: "That one needs your documents or a connected system, and from here I only read Invoice Processing: this invoice, its purchase order and receipt, the checks that ran, and how this workflow is configured.",
      outOfScope: true,
    };
  }

  // Documents, connected systems and other workflows are the page's reach, not
  // the panel's. The panel stays inside Invoice Processing on purpose.
  if (scope === 'workspace') {
    const fromDocuments = answerFromDocuments(q, documents);
    if (fromDocuments) return fromDocuments;

    if (/document|contract|agreement|policy|handbook|indexed|upload|page/.test(q)) {
      if (documents.length === 0) {
        return {
          text: 'Nothing is indexed yet. Upload a document and it becomes answerable right away, however long it is.',
          ungrounded: true,
        };
      }
      const totalPages = documents.reduce((sum, d) => sum + d.pages, 0);
      return {
        text: `${documents.length} documents are indexed, ${totalPages.toLocaleString('en-US')} pages in total:\n\n${documents
          .map((d) => `• ${d.name} — ${d.pages} pages, ${d.kind.toLowerCase()}, indexed ${d.indexedAt}`)
          .join('\n')}\n\nAsk about anything in them and I will answer with the page it came from.`,
        citations: documents.map((d) => ({
          label: d.name.replace(/\.pdf$/, ''),
          detail: `${d.pages} pages · ${d.origin}`,
        })),
      };
    }
  }

  const real = invoices.filter((i) => !i.isSample);
  const needsMe = invoices.filter((i) => i.status === 'Action Required');
  const posted = real.filter((i) => i.status === 'Posted');
  const exported = real.filter((i) => i.status === 'Exported');
  const rejected = real.filter((i) => i.status === 'Rejected');

  if (/need|action|attention|waiting|stuck|blocked/.test(q)) {
    if (needsMe.length === 0) {
      return {
        text: 'Nothing needs you right now. Every invoice in the queue is either moving on its own or already closed.',
      };
    }
    return {
      text: `${needsMe.length} invoice${needsMe.length === 1 ? '' : 's'} need you:\n\n${needsMe
        .map((i) => `• ${i.number} — ${i.vendor}, ${money(i.amount, i.currency)}: ${whyItNeedsYou(i, config)}`)
        .join('\n')}`,
      citations: needsMe.map(cite),
    };
  }

  if (/posted|paid|zoho|erp/.test(q)) {
    if (posted.length === 0) return { text: 'Nothing has posted to Zoho from this workspace yet.' };
    const total = posted.reduce((sum, i) => sum + i.amount, 0);
    const stp = posted.filter((i) => i.stpPosted);
    return {
      text: `${posted.length} invoice${posted.length === 1 ? '' : 's'} posted to Zoho Books, totaling ${money(total)}. ${
        stp.length > 0
          ? `${stp.length} of those posted by straight-through processing and never surfaced to anyone.`
          : 'A person worked all of them first.'
      }`,
      citations: posted.map(cite),
    };
  }

  if (/duplicate/.test(q)) {
    const dupes = invoices.filter((i) => i.matchResult?.hardBlock === 'duplicate');
    if (dupes.length === 0) return { text: 'No duplicates have been caught in this workspace.' };
    return {
      text: `${dupes.length} invoice${dupes.length === 1 ? ' was' : 's were'} caught as duplicates. The check runs first and covers the whole organization, so it spans every workspace. On a hit the other two checks are skipped. A duplicate cannot be overridden; a person rejects it, with a reason.`,
      citations: dupes.map(cite),
    };
  }

  if (/override/.test(q)) {
    const withOverrides = invoices.filter((i) => i.overrides.length > 0);
    if (withOverrides.length === 0) return { text: 'No overrides have been recorded in this workspace.' };
    return {
      text: withOverrides
        .flatMap((i) => i.overrides.map((o) => `• ${i.number} — ${o.rule}, by ${o.actor}: "${o.reason}"`))
        .join('\n'),
      citations: withOverrides.map(cite),
    };
  }

  if (/learn|memory|remember|suggest/.test(q)) {
    const live = memory.filter((m) => m.streak >= config.memoryThreshold);
    const building = memory.filter((m) => m.streak < config.memoryThreshold);
    return {
      text: `${live.length} pattern${live.length === 1 ? ' is' : 's are'} live and offered back as suggestions:\n\n${live
        .map((m) => `• ${m.field} — ${m.patternKey} → ${m.suggestedValue} (${m.streak} acknowledgments)`)
        .join('\n')}${
        building.length > 0
          ? `\n\n${building.length} more ${building.length === 1 ? 'is' : 'are'} still building a streak, and will be offered at ${config.memoryThreshold}:\n\n${building
              .map((m) => `• ${m.field} — ${m.patternKey} (${m.streak} of ${config.memoryThreshold})`)
              .join('\n')}`
          : ''
      }\n\nYou always accept a suggestion explicitly. Nothing is filled in behind you.`,
      citations: [
        {
          label: 'Workflow memory',
          detail: `Threshold ${config.memoryThreshold} · scoped to this workflow instance`,
        },
      ],
    };
  }

  if (/tolerance|threshold|match type|3-way|2-way|config|setting|straight/.test(q)) {
    return {
      text: `This workflow runs a ${config.matchType} match. The confidence threshold is ${config.confidenceThreshold}% on both invoice and reference fields. Total tolerance is ${money(config.totalToleranceAbsolute)} or ${config.totalTolerancePercent}%, line tolerance ${money(config.lineToleranceAbsolute)} or ${config.lineTolerancePercent}%. Straight-through processing is ${config.straightThrough ? 'on' : 'off'}, and memory forms at ${config.memoryThreshold} acknowledgments.\n\nA change to any of these reaches what runs next. It does not re-grade invoices already decided.`,
      citations: [{ label: 'Workflow configuration', detail: 'Invoice Processing · this workspace' }],
    };
  }

  if (/who|member|team|role|permission/.test(q)) {
    return {
      text: members
        .map(
          (m) =>
            `• ${m.name} — Invoice Processing: ${m.invoiceProcessing}, Agentic Search: ${m.agenticSearch} (${m.status})`,
        )
        .join('\n'),
      citations: [{ label: 'Workspace members', detail: `${members.length} people` }],
    };
  }

  if (/cycle|touch|how long|how fast|time|metric|report/.test(q)) {
    const surfaced = real.filter((i) => i.firstSurfacedAt !== null && i.terminalAt !== null);
    const fromErp = real.filter((i) => i.poSource === 'zoho').length;
    return {
      text: `Across ${real.length} real invoices: ${posted.length} posted, ${exported.length} exported, ${rejected.length} rejected, and ${needsMe.length} still needing a person.\n\n${surfaced.length} of the closed ones surfaced to a user at some point. Touch time excludes straight-through invoices rather than counting them as zero. ${fromErp} of ${real.length} matched against Zoho data rather than uploaded documents.`,
      citations: [{ label: 'Reporting', detail: 'Per workflow, rolled up per workspace' }],
    };
  }

  const vendors = [...new Set(invoices.map((i) => i.vendor))];
  const matched = vendors.find((v) => q.includes(v.toLowerCase().split(' ')[0]));
  if (matched) {
    const theirs = invoices.filter((i) => i.vendor === matched);
    const total = theirs.reduce((sum, i) => sum + i.amount, 0);
    return {
      text: `${theirs.length} invoice${theirs.length === 1 ? '' : 's'} from ${matched}, totaling ${money(total)}:\n\n${theirs
        .map((i) => `• ${i.number} — ${money(i.amount, i.currency)}, ${formatDate(i.invoiceDate)}, ${i.status}`)
        .join('\n')}`,
      citations: theirs.map(cite),
    };
  }

  if (/how many|total|spend|value|queue/.test(q)) {
    const total = real.reduce((sum, i) => sum + i.amount, 0);
    return {
      text: `${invoices.length} invoices in this workspace: ${real.length} real, and ${invoices.length - real.length} marked as sample data. The real ones total ${money(total)}. Sample records stay out of reporting and never post to a connected ERP.`,
      citations: [{ label: 'Invoice queue', detail: `${invoices.length} records` }],
    };
  }

  if (scope === 'workflow') {
    return {
      text: "Here I only answer about Invoice Processing: this invoice, its purchase order and receipt, the checks that ran, and how this workflow is configured.\n\nYour indexed documents, connected systems and other workflows are outside what I can reach from here.",
      outOfScope: true,
    };
  }

  return {
    text: "I don't have enough information to answer that from your workspace. I can only answer from documents you have indexed, your invoice records, and the tools you have connected, and I would rather say so than guess.\n\nIn this version I answer. I do not act.",
    ungrounded: true,
  };
}

/** Starter questions. The page advertises its reach; the panel advertises its focus. */
export function suggestedQuestions(focus?: Invoice | null): string[] {
  if (focus) {
    return [
      'Why does this need me?',
      'Show me the variance against the PO',
      'Who has touched this invoice?',
      `What else have we had from ${focus.vendor.split(' ')[0]}?`,
    ];
  }
  return [
    'What are our payment terms with Redwood?',
    'What needs me?',
    'When can a vendor raise prices?',
    'What is the approval threshold above $10,000?',
    'Have we caught any duplicates?',
    'What documents have you indexed?',
  ];
}
