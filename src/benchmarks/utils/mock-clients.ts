interface SdkClient {
  callTool(request: { name: string; arguments?: Record<string, unknown> }): Promise<unknown>;
}

// ── data generators ───────────────────────────────────────────────────────────

function makeLead(i: number) {
  const statuses = ['Open', 'Working', 'Closed - Converted', 'Closed - Not Converted'];
  const industries = ['Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Retail'];
  return {
    Id: `003${String(i).padStart(15, '0')}`,
    Name: `Contact ${i}`,
    Company: `${industries[i % 5]} Corp ${i}`,
    Email: `contact${i}@company${i % 50}.example.com`,
    Phone: `+1-555-${String((i % 9000) + 1000)}-${String(((i * 7) % 9000) + 1000)}`,
    Status: statuses[i % 4],
    Amount: Math.round((i * 1247 + 500) % 500_000),
    Title: `${['VP', 'Director', 'Manager', 'Analyst'][i % 4]} of ${['Sales', 'Marketing', 'Operations', 'Finance'][i % 4]}`,
    Industry: industries[i % 5],
    AnnualRevenue: Math.round((i * 50_000 + 100_000) % 50_000_000),
    NumberOfEmployees: (i * 47 + 10) % 10_000,
    Rating: ['Hot', 'Warm', 'Cold'][i % 3],
    LeadSource: ['Web', 'Phone', 'Partner', 'List', 'Trade Show'][i % 5],
    LastModifiedDate: new Date(Date.now() - i * 86_400_000).toISOString(),
    CreatedDate: new Date(Date.now() - i * 172_800_000).toISOString(),
    OwnerId: `005${String(i % 50).padStart(15, '0')}`,
    Description: `Prospect from Q${(i % 4) + 1} campaign. Follow-up required by account team.`,
  };
}

function makeEmail(i: number) {
  return {
    id: `msg${String(i).padStart(8, '0')}`,
    from: `sender${i % 20}@example.com`,
    to: [`recipient${i % 5}@company.com`],
    subject: `${['Re: Report', 'Follow-up', 'Action Required', 'Meeting Notes', 'Update'][i % 5]} #${i}`,
    body: `Hi team,\n\nPlease review item ${i}. Action required by ${['Monday', 'Wednesday', 'Friday'][i % 3]}.\n\nBest regards,\nSender ${i % 20}`,
    date: new Date(Date.now() - i * 3_600_000).toISOString(),
    threadId: `thread${String(Math.floor(i / 3)).padStart(6, '0')}`,
    labels: [['INBOX', 'UNREAD'], ['INBOX'], ['SENT']][i % 3],
    snippet: `Please review item ${i}. Action required...`,
    hasAttachments: i % 5 === 0,
  };
}

function makeEvent(i: number) {
  const start = new Date(Date.now() + i * 3_600_000);
  return {
    id: `evt${String(i).padStart(8, '0')}`,
    summary: `${['Sprint Planning', 'Design Review', 'Stakeholder Update', '1:1', 'All Hands'][i % 5]} ${i}`,
    start: { dateTime: start.toISOString(), timeZone: 'America/New_York' },
    end: {
      dateTime: new Date(start.getTime() + 3_600_000).toISOString(),
      timeZone: 'America/New_York',
    },
    attendees: Array.from({ length: (i % 5) + 2 }, (_, j) => ({
      email: `attendee${j}@company.com`,
      responseStatus: ['accepted', 'tentative', 'needsAction'][j % 3],
    })),
    description: `Recurring meeting for team sync. Agenda shared 24h in advance via email.`,
    location: `Conference Room ${String.fromCharCode(65 + (i % 8))}`,
    organizer: { email: `organizer${i % 5}@company.com`, displayName: `Organizer ${i % 5}` },
    recurrence: i % 3 === 0 ? ['RRULE:FREQ=WEEKLY;BYDAY=MO'] : undefined,
  };
}

function makeSlackMessage(i: number) {
  return {
    ts: `${Math.floor(Date.now() / 1000) - i}.000${i % 1000}`,
    user: `U${String(i % 50).padStart(8, '0')}`,
    text: `${['Update on', 'Question about', 'FYI:', 'Reminder:', 'Alert:'][i % 5]} project item ${i}. ${['Please review.', 'No action needed.', 'Needs approval.'][i % 3]}`,
    channel: `C${['general', 'engineering', 'product', 'sales'][i % 4]}`,
    reactions: Array.from({ length: i % 4 }, (_, j) => ({
      name: ['+1', 'tada', 'eyes', 'checkmark'][j % 4],
      count: j + 1,
    })),
    reply_count: i % 5,
    thread_ts:
      i % 3 === 0 ? `${Math.floor(Date.now() / 1000) - Math.floor(i / 3)}.000000` : undefined,
  };
}

function makeDbRow(i: number) {
  return {
    id: i + 1,
    user_id: (i % 1000) + 1,
    session_id: `sess_${String(i % 500).padStart(8, '0')}`,
    event_type: ['page_view', 'click', 'form_submit', 'purchase', 'signup'][i % 5],
    properties: {
      page: `/path/${i % 50}`,
      referrer: `https://ref.example.com/${i % 20}`,
      duration_ms: (i * 137) % 30_000,
      value: i % 5 === 3 ? Math.round(((i * 9.99) % 500) * 100) / 100 : null,
    },
    created_at: new Date(Date.now() - i * 60_000).toISOString(),
    ip_address: `192.168.${i % 256}.${(i * 7) % 256}`,
    user_agent: `Mozilla/5.0 (compatible; TestClient/${i % 10})`,
  };
}

// ── mock clients ──────────────────────────────────────────────────────────────

export const salesforce: SdkClient = {
  async callTool({ name, arguments: args }) {
    if (name === 'search') return Array.from({ length: 200 }, (_, i) => makeLead(i));
    if (name === 'getRecord') return makeLead(Number((args as { id?: number })?.id ?? 0));
    return null;
  },
};

export const gmail: SdkClient = {
  async callTool({ name }) {
    if (name === 'listMessages') return Array.from({ length: 50 }, (_, i) => makeEmail(i));
    return null;
  },
};

export const calendar: SdkClient = {
  async callTool({ name }) {
    if (name === 'listEvents') return Array.from({ length: 30 }, (_, i) => makeEvent(i));
    return null;
  },
};

export const slack: SdkClient = {
  async callTool({ name }) {
    if (name === 'listChannels') return Array.from({ length: 80 }, (_, i) => makeSlackMessage(i));
    return null;
  },
};

export const database: SdkClient = {
  async callTool({ name }) {
    if (name === 'query') return Array.from({ length: 10_000 }, (_, i) => makeDbRow(i));
    return null;
  },
};

/** Fails on the Nth call (0-indexed). Succeeds on all others. */
export function flakyDatabase(failOnCall: number): SdkClient {
  let count = 0;
  return {
    async callTool({ name }) {
      const n = count++;
      if (n === failOnCall) throw new Error(`Transient connection error (call ${n})`);
      if (name === 'query') return Array.from({ length: 10_000 }, (_, i) => makeDbRow(i));
      return null;
    },
  };
}

/** Requires auth_token in arguments; returns 50 leads if valid, throws otherwise. */
export function authenticatedSalesforce(validToken: string): SdkClient {
  return {
    async callTool({ name, arguments: args }) {
      const token = (args as { auth_token?: string })?.auth_token;
      if (token !== validToken) throw new Error('Unauthorized: invalid auth token');
      if (name === 'search') return Array.from({ length: 50 }, (_, i) => makeLead(i));
      return null;
    },
  };
}
