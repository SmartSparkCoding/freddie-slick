// Club API calls and response parsing. No Slick or React here, so it can be tested on its own.

export const BASE = 'https://clubapi.hackclub.com';

export type ClubDetails = { country: string | null };

export type Lookup = {
  leader: boolean;
  /** The club they lead, or (for members) belong to. */
  club: string | null;
  status: string | null;
  /** Set when they're a member rather than a leader (API key only). */
  member?: boolean;
  details?: ClubDetails | null;
  /** The lookup failed; remembered briefly so it isn't retried on every render. */
  failed?: boolean;
};

export const FAILED: Lookup = { leader: false, club: null, status: null, failed: true };

type Response = { status: number; body: string };
export type Fetch = (url: string, init: { headers: Record<string, string> }) => Promise<Response>;

export class KeyRejected extends Error {}
export class HttpError extends Error {
  status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

function parse(response: Response): Record<string, any> {
  if (response.status === 401) throw new KeyRejected();
  if (response.status < 200 || response.status >= 300) throw new HttpError(response.status);
  return JSON.parse(response.body || '{}');
}

/** `/leader/slack`: public (leader yes/no) or, with any valid key, the club name and status. */
export async function leaderBySlack(fetch: Fetch, userId: string, apiKey: string): Promise<Lookup> {
  const headers: Record<string, string> = apiKey ? { Authorization: apiKey } : {};
  const data = parse(await fetch(`${BASE}/leader/slack?slackid=${encodeURIComponent(userId)}`, { headers }));
  const club = text(data.club_name);
  return { leader: data.leader === true || !!club, club, status: text(data.club_status) };
}

/** `/person`: leader and member matches plus the club's full record, in one request. Needs Read permission. */
export async function person(fetch: Fetch, userId: string, apiKey: string): Promise<Lookup> {
  const data = parse(
    await fetch(`${BASE}/person?slackid=${encodeURIComponent(userId)}`, { headers: { Authorization: apiKey } }),
  );
  const leader = data.leader?.by_slack;
  const member = data.member?.by_slack;
  const isLeader = leader?.found === true;
  const isMember = !isLeader && member?.found === true;
  const club = text(isLeader ? leader?.club_name : isMember ? member?.club_name : null);
  const fields = club ? (data.clubs?.[club]?.fields ?? data.clubs?.[club] ?? null) : null;
  return {
    leader: isLeader,
    member: isMember,
    club,
    status: text(leader?.club_status) ?? text(fields?.status) ?? text(fields?.club_status),
    details: fields
      ? {
          country: text(fields.venue_addr_country ?? fields.country),
        }
      : null,
  };
}

/** Tooltip text for a badge. */
export function describe(info: Lookup): string {
  const role = info.leader ? 'Club leader' : 'Club member';
  if (!info.club) return role;
  const lines = [`${role}: ${info.club}${info.status ? ` (${info.status})` : ''}`];
  if (info.details?.country) lines.push(info.details.country);
  return lines.join('\n');
}
