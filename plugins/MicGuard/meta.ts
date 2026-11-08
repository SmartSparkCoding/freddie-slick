import type { PluginCategory, SettingsSchema } from '$slick';

export const id = 'MicGuard';
export const pluginName = 'Mic Guard';
export const description =
  'If someone else mutes you in a huddle, Mic Guard unmutes you again and tells you who did it';
export const category: PluginCategory = 'sounds';
export const defaultEnabled = false;

export const settings = {
  keepUnmuted: {
    type: 'boolean',
    label: 'Keep me unmuted',
    description: 'Someone mutes you, you get unmuted again. Also toggleable from a huddle’s mic menu.',
    default: true,
  },
  tellMe: {
    type: 'boolean',
    label: 'Tell me when it happens',
    description: 'Shows a small huddle alert naming whoever muted you.',
    default: true,
  },
  debug: {
    type: 'boolean',
    label: 'Log what it sees',
    description: 'Prints the mic button state and huddle menus it finds, for when the toggle does not show up.',
    default: false,
  },
} as const satisfies SettingsSchema;
