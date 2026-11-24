/** Fixed set of exercises this build times (native: Exercises.java). */

export const NAMES = ['Sit to Stand', 'Timed Up and Go', 'Walk', 'Stair Climb'] as const;

export const KEYS = ['sit_to_stand', 'timed_up_and_go', 'walk', 'stair_climb'] as const;

export const HINTS = [
  'Stand up from a chair, then sit back down.',
  'Stand, walk three meters, then turn around and return to the chair and sit down.',
  'Walk at your usual pace.',
  'Go up and down a flight of stairs.',
] as const;
