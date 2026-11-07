// Badge (and optional underline) for Hack Club club leaders.
// Looks each sender up once by Slack ID through the Club API, cached in Slick storage.

import { SlickPlugin } from '$slick';
import * as meta from './meta.ts';

type LeaderInfo = { leader: boolean; club: string | null; status: string | null };
type View = { emoji: string; emojiUrl: string | null; underline: boolean };
type Message = { user?: string; bot_id?: string };

const ENDPOINT = 'https://clubapi.hackclub.com/leader/slack';
const USER_ID = /^[UW][A-Z0-9]+$/;
const LEADER_TTL_MS = 24 * 60 * 60 * 1000;
const NOT_LEADER_TTL_MS = 6 * 60 * 60 * 1000;
const EMOJI_NAME = /^:?([a-z0-9_+'-]+):?$/i;

const personId = (userId?: string, botId?: string) =>
  !botId && userId && USER_ID.test(userId) && userId !== 'USLACKBOT' ? userId : null;

// Grouped follow-up messages get the same header children with `visible: false`;
// only the shown sender counts (same check as Slick's UserPronouns plugin).
const isShownSender = (child: React.ReactNode) => {
  const props = React.isValidElement(child) ? (child.props as Record<string, unknown>) : null;
  return !!props && 'isInteractive' in props && props.visible !== false;
};

export default class ClubLeader extends SlickPlugin<typeof meta.settings> {
  static readonly id = meta.id;
  static readonly pluginName = meta.pluginName;
  static readonly description = meta.description;
  static readonly defaultEnabled = false;
  static readonly requiredAPIs = [] as const;
  static readonly settings = meta.settings;
  static readonly liveSettings = ['badgeEmoji', 'underline', 'underlineColor'];

  private leaders = this.api.Cache<LeaderInfo | null>('club_leader', (info) =>
    info?.leader ? LEADER_TTL_MS : NOT_LEADER_TTL_MS,
  );
  private view = new this.api.Store<View>({ emoji: '', emojiUrl: null, underline: false });
  private emojiList: Promise<Record<string, string>> | null = null;
  private warnedKey = false;

  start() {
    this.onSettingsChange();

    // Looks a user up once and re-renders when the answer arrives.
    const useLeader = (userId: string | null) => {
      const [info, setInfo] = React.useState<LeaderInfo | null>(() =>
        userId ? (this.leaders.peek(this.key(userId)) ?? null) : null,
      );
      React.useEffect(() => {
        if (!userId) return;
        let live = true;
        void this.lookUp(userId).then((result) => live && setInfo(result));
        return () => {
          live = false;
        };
      }, [userId]);
      return info;
    };

    const Badge = ({ userId }: { userId: string }) => {
      const info = useLeader(userId);
      const { emoji, emojiUrl } = this.view.use();
      if (!info?.leader) return null;
      const tip = info.club ? `Club leader: ${info.club}${info.status ? ` (${info.status})` : ''}` : 'Club leader';
      return (
        <span className="slick-club-leader" title={tip} aria-label={tip} data-stringify-ignore="">
          {emojiUrl ? <img className="slick-club-leader__img" src={emojiUrl} alt={`:${emoji}:`} /> : emoji || '♣'}
        </span>
      );
    };

    // Underline: only a class on the name, so a hidden sender stays hidden.
    this.api.patchComponent<{ userId?: string; botId?: string; className?: string }>(
      'BaseMessageSender',
      (Original) => (props) => {
        const info = useLeader(personId(props.userId, props.botId));
        const { underline } = this.view.use();
        if (!underline || !info?.leader) return <Original {...props} />;
        return <Original {...props} className={[props.className, 'slick-club-leader-name'].filter(Boolean).join(' ')} />;
      },
    );

    // Channels: the badge goes right after the shown sender in the message header.
    this.api.patchComponent<{ msg?: Message; children?: React.ReactNode }>('BaseBroadcastPreamble', (Original) => (props) => {
      const userId = personId(props.msg?.user, props.msg?.bot_id);
      if (!userId) return <Original {...props} />;
      const children = React.Children.toArray(props.children);
      const sender = children.findIndex(isShownSender);
      if (sender === -1) return <Original {...props} />;
      children.splice(sender + 1, 0, <Badge key="slick-club-leader" userId={userId} />);
      return <Original {...props}>{children}</Original>;
    });

    // Threads build their own header, which ends on a <br> we have to move past.
    this.api.patchComponent<{ msg?: Message; adjacent?: boolean; visible?: boolean; omitLinebreak?: boolean }>(
      'ThreadSenderAndTimestampGeneric',
      (Original) => (props) => {
        const userId = personId(props.msg?.user, props.msg?.bot_id);
        if (props.adjacent || props.visible === false || !userId) return <Original {...props} />;
        return (
          <>
            <Original {...props} omitLinebreak />
            <Badge userId={userId} />
            {props.omitLinebreak ? null : <br />}
          </>
        );
      },
    );
  }

  onSettingsChange() {
    const color = this.config.underlineColor || '#ec3750';
    this.api.setStyle(`
      .slick-club-leader {
        display: inline-flex;
        align-items: center;
        margin-left: 4px;
        font-size: 14px;
        line-height: 1;
        vertical-align: middle;
        cursor: default;
        user-select: none;
      }
      .slick-club-leader__img { width: 16px; height: 16px; object-fit: contain; }
      .slick-club-leader-name,
      .slick-club-leader-name .c-message__sender_button {
        text-decoration: underline ${color} !important;
        text-decoration-thickness: 2px !important;
        text-underline-offset: 3px;
      }
    `);
    void this.resolveEmoji();
  }

  // Custom emoji need their image URL; anything else is shown as typed.
  private async resolveEmoji() {
    const raw = this.config.badgeEmoji.trim();
    const underline = this.config.underline === true;
    const match = raw.match(EMOJI_NAME);
    if (!match) return this.view.set({ emoji: raw, emojiUrl: null, underline });

    const name = match[1].toLowerCase();
    try {
      this.emojiList ??= this.api
        .userAPI<{ emoji?: Record<string, string> }>('emoji.list', {}, { signal: this.api.signal })
        .then((response) => response.emoji ?? {});
      const list = await this.emojiList;
      let url = list[name];
      for (let hops = 0; url?.startsWith('alias:') && hops < 5; hops++) url = list[url.slice(6)];
      if (url?.startsWith('http')) return this.view.set({ emoji: name, emojiUrl: url, underline });
      this.log(`no custom emoji called :${name}:, showing the default badge`);
    } catch (error) {
      this.emojiList = null;
      this.log("could not load the workspace's emoji", error);
    }
    this.view.set({ emoji: '', emojiUrl: null, underline });
  }

  private key(userId: string) {
    return `${this.config.apiKey ? 'k' : 'n'}:${userId}`;
  }

  private async lookUp(userId: string) {
    try {
      return await this.leaders.get(this.key(userId), () => this.fetchLeader(userId));
    } catch (error) {
      this.log(`could not check ${userId}`, error);
      return null;
    }
  }

  private async fetchLeader(userId: string): Promise<LeaderInfo> {
    const apiKey = this.config.apiKey.trim();
    const response = await this.api.fetch(`${ENDPOINT}?slackid=${encodeURIComponent(userId)}`, {
      headers: apiKey ? { Authorization: apiKey } : {},
    });
    if (response.status === 401) {
      if (!this.warnedKey) this.log('the Club API rejected your API key; check it in the plugin settings');
      this.warnedKey = true;
      throw new Error('invalid API key');
    }
    if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`);

    const data = JSON.parse(response.body || '{}') as { leader?: boolean; club_name?: unknown; club_status?: unknown };
    const club = typeof data.club_name === 'string' ? data.club_name : null;
    const status = typeof data.club_status === 'string' ? data.club_status : null;
    return { leader: data.leader === true || !!club, club, status };
  }
}
