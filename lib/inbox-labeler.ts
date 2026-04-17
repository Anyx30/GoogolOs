import { runGwsCommand } from './gws-runner';

export interface LabelRule {
  match: 'domain' | 'from' | 'subject';
  value: string;
  labelId: string;
  skipInbox?: boolean;
}

export interface LabelResult {
  labeled: number;
  skipped: number;
  breakdown: Record<string, number>;
}

// Label IDs (must match what exists in Gmail)
const LABELS = {
  ACTION_REQUIRED: 'Label_11',
  FINANCE:         'Label_12',
  CLIENTS:         'Label_13',
  TEAM:            'Label_14',
  LEGAL:           'Label_15',
  EVENTS:          'Label_16',
  TRAVEL:          'Label_17',
  NEWSLETTERS:     'Label_18',
  WAITING:         'Label_19',
  TOOLS:           'Label_20',
  ADS:             'Label_1',
  OPERATIONS:      'Label_7162805879955471328',
};

// Rules are checked in order — first match wins
export const LABEL_RULES: LabelRule[] = [
  // --- ADS (skip inbox) ---
  { match: 'domain', value: 'firecrawl.dev',          labelId: LABELS.ADS,         skipInbox: true },
  { match: 'domain', value: 'makemytrip.com',          labelId: LABELS.ADS,         skipInbox: true },
  { match: 'domain', value: 'mybiz-makemytrip.com',    labelId: LABELS.ADS,         skipInbox: true },

  // --- NEWSLETTERS (skip inbox) ---
  { match: 'domain', value: 'mail.beehiiv.com',        labelId: LABELS.NEWSLETTERS, skipInbox: true },
  { match: 'domain', value: 'substack.com',            labelId: LABELS.NEWSLETTERS, skipInbox: true },
  { match: 'domain', value: 'update.10xresearch.com',  labelId: LABELS.NEWSLETTERS, skipInbox: true },
  { match: 'domain', value: 'newsletter.trigify.io',   labelId: LABELS.NEWSLETTERS, skipInbox: true },
  { match: 'domain', value: 'yourstory.com',           labelId: LABELS.NEWSLETTERS, skipInbox: true },
  { match: 'domain', value: 'news.se.ro',              labelId: LABELS.NEWSLETTERS, skipInbox: true },
  { match: 'domain', value: 'list.aiprm.com',          labelId: LABELS.NEWSLETTERS, skipInbox: true },
  { match: 'domain', value: 'medium.com',              labelId: LABELS.NEWSLETTERS, skipInbox: true },
  { match: 'domain', value: 'cointelegraph.com',       labelId: LABELS.NEWSLETTERS, skipInbox: true },
  { match: 'domain', value: 'deeplearning.ai',         labelId: LABELS.NEWSLETTERS, skipInbox: true },
  { match: 'domain', value: 'blockchain-life.com',     labelId: LABELS.NEWSLETTERS, skipInbox: true },
  { match: 'domain', value: 'ai4conferences.com',      labelId: LABELS.NEWSLETTERS, skipInbox: true },
  { match: 'domain', value: 'thetechrevolutionforum.com', labelId: LABELS.NEWSLETTERS, skipInbox: true },
  { match: 'domain', value: 'radiostud.io',            labelId: LABELS.NEWSLETTERS, skipInbox: true },
  { match: 'domain', value: 'technextforward.com',     labelId: LABELS.NEWSLETTERS, skipInbox: true },
  { match: 'domain', value: 'apacdao.net',             labelId: LABELS.NEWSLETTERS, skipInbox: true },
  { match: 'domain', value: 'akindo.io',               labelId: LABELS.NEWSLETTERS, skipInbox: true },

  // --- EVENTS ---
  { match: 'domain', value: 'user.luma-mail.com',      labelId: LABELS.EVENTS },
  { match: 'from',   value: 'hello@lu.ma',             labelId: LABELS.EVENTS },
  { match: 'domain', value: 'ethglobal.com',           labelId: LABELS.EVENTS },
  { match: 'domain', value: 'events.evion.app',        labelId: LABELS.EVENTS },
  { match: 'domain', value: 'near.org',                labelId: LABELS.EVENTS },

  // --- FINANCE ---
  { match: 'domain', value: 'razorpay.com',            labelId: LABELS.FINANCE },
  { match: 'domain', value: 'skydo.com',               labelId: LABELS.FINANCE },
  { match: 'domain', value: 'hdfcbank.bank.in',        labelId: LABELS.FINANCE },
  { match: 'domain', value: 'orbitxpay.com',           labelId: LABELS.FINANCE },
  { match: 'domain', value: 'notifications.mystablecorp.xyz', labelId: LABELS.FINANCE },
  { match: 'domain', value: 'refrens.com',             labelId: LABELS.FINANCE },
  { match: 'subject', value: 'invoice',                labelId: LABELS.FINANCE },
  { match: 'subject', value: 'payment receipt',        labelId: LABELS.FINANCE },

  // --- TEAM ---
  { match: 'domain', value: 'metaborong.com',          labelId: LABELS.TEAM },
  { match: 'subject', value: 'leave request',          labelId: LABELS.TEAM },

  // --- LEGAL ---
  { match: 'subject', value: 'agreement',              labelId: LABELS.LEGAL },
  { match: 'subject', value: 'contract',               labelId: LABELS.LEGAL },

  // --- CLIENTS ---
  { match: 'subject', value: 'proposal',               labelId: LABELS.CLIENTS },

  // --- TRAVEL ---
  { match: 'domain', value: 'sg.booking.com',          labelId: LABELS.TRAVEL },
  { match: 'subject', value: 'booking confirmation',   labelId: LABELS.TRAVEL },
  { match: 'subject', value: 'your itinerary',         labelId: LABELS.TRAVEL },

  // --- OPERATIONS ---
  { match: 'from',   value: 'workspace-noreply@google.com', labelId: LABELS.OPERATIONS },
  { match: 'from',   value: 'googlecloud@google.com',       labelId: LABELS.OPERATIONS },
  { match: 'domain', value: 'slack.com',               labelId: LABELS.OPERATIONS },
  { match: 'domain', value: 'onsurity.com',            labelId: LABELS.OPERATIONS },

  // --- TOOLS ---
  { match: 'domain', value: 'e.atlassian.com',         labelId: LABELS.TOOLS },
  { match: 'domain', value: 'po.atlassian.net',        labelId: LABELS.TOOLS },
  { match: 'domain', value: 'mail.clickup.com',        labelId: LABELS.TOOLS },
  { match: 'domain', value: 'email.figma.com',         labelId: LABELS.TOOLS },
  { match: 'domain', value: 'figma.com',               labelId: LABELS.TOOLS },
  { match: 'domain', value: 'info.vercel.com',         labelId: LABELS.TOOLS },
  { match: 'domain', value: 'mail.notion.so',          labelId: LABELS.TOOLS },
  { match: 'domain', value: 'linear.app',              labelId: LABELS.TOOLS },
  { match: 'domain', value: 'send.zapier.com',         labelId: LABELS.TOOLS },
  { match: 'domain', value: 'info.n8n.io',             labelId: LABELS.TOOLS },
  { match: 'domain', value: 'mail.cursor.com',         labelId: LABELS.TOOLS },
  { match: 'domain', value: 'mail.trigger.dev',        labelId: LABELS.TOOLS },
  { match: 'domain', value: 'email.openai.com',        labelId: LABELS.TOOLS },
  { match: 'domain', value: 'email.claude.com',        labelId: LABELS.TOOLS },
  { match: 'domain', value: 'gamma.app',               labelId: LABELS.TOOLS },
  { match: 'domain', value: 'warp.dev',                labelId: LABELS.TOOLS },
  { match: 'domain', value: 'apify.com',               labelId: LABELS.TOOLS },
  { match: 'domain', value: 'searchapi.io',            labelId: LABELS.TOOLS },
  { match: 'domain', value: 'admin.manus.im',          labelId: LABELS.TOOLS },
  { match: 'domain', value: 'updates.wispr.ai',        labelId: LABELS.TOOLS },
  { match: 'domain', value: 'mail.wispr.ai',           labelId: LABELS.TOOLS },
  { match: 'domain', value: 'beautiful.ai',            labelId: LABELS.TOOLS },
  { match: 'domain', value: 'mail.pencil.dev',         labelId: LABELS.TOOLS },
  { match: 'domain', value: 'emails.paper.design',     labelId: LABELS.TOOLS },
  { match: 'domain', value: 'mail.postman.com',        labelId: LABELS.TOOLS },
  { match: 'domain', value: 'tldv.io',                 labelId: LABELS.TOOLS },
  { match: 'domain', value: 'cal.com',                 labelId: LABELS.TOOLS },
  { match: 'domain', value: 'xetch.studio',            labelId: LABELS.TOOLS },
];

const USER_LABEL_IDS = new Set(Object.values(LABELS));

interface GmailMessage {
  id: string;
  labelIds?: string[];
}

interface MessageMetadata {
  id: string;
  from: string;
  subject: string;
  labelIds: string[];
}

function extractDomain(from: string): string {
  const match = from.match(/@([\w.-]+)/);
  return match ? match[1].toLowerCase() : '';
}

function applyRules(from: string, subject: string): LabelRule | null {
  const fromLower = from.toLowerCase();
  const subjectLower = subject.toLowerCase();
  const domain = extractDomain(fromLower);

  for (const rule of LABEL_RULES) {
    if (rule.match === 'domain' && domain === rule.value) return rule;
    if (rule.match === 'from' && fromLower.includes(rule.value)) return rule;
    if (rule.match === 'subject' && subjectLower.includes(rule.value)) return rule;
  }
  return null;
}

async function fetchMessageMetadata(id: string): Promise<MessageMetadata | null> {
  try {
    const result = await runGwsCommand([
      'gmail', 'users', 'messages', 'get',
      '--params', JSON.stringify({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject'],
      }),
    ]) as Record<string, unknown>;

    const payload = result?.payload as Record<string, unknown> | undefined;
    const headers = (payload?.headers as Array<{ name: string; value: string }>) ?? [];
    const headerMap: Record<string, string> = {};
    for (const h of headers) headerMap[h.name] = h.value;

    return {
      id,
      from: headerMap['From'] ?? '',
      subject: headerMap['Subject'] ?? '',
      labelIds: (result?.labelIds as string[]) ?? [],
    };
  } catch {
    return null;
  }
}

async function batchModify(
  ids: string[],
  addLabelIds: string[],
  removeLabelIds: string[]
): Promise<void> {
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000);
    await runGwsCommand([
      'gmail', 'users', 'messages', 'batchModify',
      '--params', JSON.stringify({ userId: 'me' }),
      '--json', JSON.stringify({ ids: chunk, addLabelIds, removeLabelIds }),
    ]);
  }
}

export async function runInboxLabeler(
  maxEmails = 200
): Promise<{ result: LabelResult; summary: string }> {
  // 1. Fetch recent emails (no user label filter — we check per-message below)
  const listResult = await runGwsCommand([
    'gmail', 'users', 'messages', 'list',
    '--params', JSON.stringify({
      userId: 'me',
      q: 'in:inbox',
      maxResults: maxEmails,
    }),
  ]) as Record<string, unknown>;

  const messages = (listResult?.messages as GmailMessage[]) ?? [];
  if (messages.length === 0) {
    return {
      result: { labeled: 0, skipped: 0, breakdown: {} },
      summary: 'No inbox emails found.',
    };
  }

  // 2. Fetch metadata concurrently in batches of 20
  const metadata: MessageMetadata[] = [];
  for (let i = 0; i < messages.length; i += 20) {
    const batch = messages.slice(i, i + 20);
    const results = await Promise.all(batch.map(m => fetchMessageMetadata(m.id)));
    metadata.push(...results.filter((m): m is MessageMetadata => m !== null));
  }

  // 3. Filter to only unlabeled messages
  const unlabeled = metadata.filter(
    m => !m.labelIds.some(id => USER_LABEL_IDS.has(id))
  );

  if (unlabeled.length === 0) {
    return {
      result: { labeled: 0, skipped: metadata.length, breakdown: {} },
      summary: `Scanned ${metadata.length} emails — all already labeled.`,
    };
  }

  // 4. Match rules and group by (labelId, skipInbox)
  const labelGroups: Map<string, { ids: string[]; skipInbox: boolean }> = new Map();
  let skipped = 0;

  for (const msg of unlabeled) {
    const rule = applyRules(msg.from, msg.subject);
    if (!rule) { skipped++; continue; }

    const key = rule.labelId;
    if (!labelGroups.has(key)) {
      labelGroups.set(key, { ids: [], skipInbox: rule.skipInbox ?? false });
    }
    labelGroups.get(key)!.ids.push(msg.id);
  }

  // 5. Apply labels
  const breakdown: Record<string, number> = {};
  let labeled = 0;

  for (const [labelId, { ids, skipInbox }] of labelGroups) {
    await batchModify(ids, [labelId], skipInbox ? ['INBOX'] : []);
    breakdown[labelId] = ids.length;
    labeled += ids.length;
  }

  const labelNames: Record<string, string> = {
    [LABELS.ACTION_REQUIRED]: 'Action Required',
    [LABELS.FINANCE]:         'Finance',
    [LABELS.CLIENTS]:         'Clients',
    [LABELS.TEAM]:            'Team',
    [LABELS.LEGAL]:           'Legal & Compliance',
    [LABELS.EVENTS]:          'Events',
    [LABELS.TRAVEL]:          'Travel',
    [LABELS.NEWSLETTERS]:     'Newsletters',
    [LABELS.WAITING]:         'Waiting / Follow-up',
    [LABELS.TOOLS]:           'Tools',
    [LABELS.ADS]:             'Ads',
    [LABELS.OPERATIONS]:      'Operations',
  };

  const lines = Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => `- **${labelNames[id] ?? id}**: ${count} emails`);

  const summary = [
    `Scanned ${metadata.length} inbox emails, labeled ${labeled}, skipped ${skipped + (unlabeled.length - labeled - skipped)} (no matching rule).`,
    '',
    ...lines,
  ].join('\n');

  return { result: { labeled, skipped: metadata.length - labeled, breakdown }, summary };
}
