import type { SettingsSchema } from '$slick';

export const id = 'ClubLeader';
export const pluginName = 'Club Leader Badge';
export const description = 'Shows a badge next to Hack Club club leaders, using the Club API';

export const settings = {
  badgeEmoji: {
    type: 'text',
    label: 'Badge emoji',
    description: 'A custom emoji name from this workspace (like clubs-icon), or paste a normal emoji such as ⭐.',
    default: 'clubs-icon',
    maxLength: 100,
  },
  apiKey: {
    type: 'text',
    label: 'Club API key (optional)',
    description: "With a key, the badge's tooltip also shows the club's name and status.",
    default: '',
    maxLength: 200,
  },
  underline: {
    type: 'boolean',
    label: "Underline leaders' names too",
    default: false,
  },
  underlineColor: {
    type: 'color',
    label: 'Underline color',
    default: '#ec3750',
  },
} as const satisfies SettingsSchema;
