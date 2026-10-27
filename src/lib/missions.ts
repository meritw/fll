export const MISSIONS = [
  [1, "Drone Survey"],
  [2, "Exploding Seeds"],
  [3, "Flip the Rock"],
  [4, "Lucky Leaves"],
  [5, "Reaching Roots"],
  [6, "Leafcutter Frenzy"],
  [7, "Humongous Fungus"],
  [8, "Tangled"],
  [9, "Research Platform"],
  [10, "Fragile Microhabitats"],
  [11, "Window to the Past"],
  [12, "Forest Elder"],
  [13, "Keystone Species"],
  [14, "Seeds of Renewal"],
  [15, "Biocentric Architecture"],
] as const;

export type MissionSeed = (typeof MISSIONS)[number];

/**
 * Official BIOGLOW robot game cards, cropped from rulebook pages 9–12.
 * One image per seeded mission. Paths are public files under /mission-cards.
 */
export const MISSION_CARDS: Record<
  number,
  { src: string; width: number; height: number }
> = {
  1: { src: "/mission-cards/01-drone-survey.png", width: 749, height: 982 },
  2: { src: "/mission-cards/02-exploding-seeds.png", width: 754, height: 982 },
  3: { src: "/mission-cards/03-flip-the-rock.png", width: 749, height: 984 },
  4: { src: "/mission-cards/04-lucky-leaves.png", width: 750, height: 983 },
  5: { src: "/mission-cards/05-reaching-roots.png", width: 754, height: 982 },
  6: { src: "/mission-cards/06-leafcutter-frenzy.png", width: 749, height: 982 },
  7: { src: "/mission-cards/07-humongous-fungus.png", width: 749, height: 982 },
  8: { src: "/mission-cards/08-tangled.png", width: 749, height: 982 },
  9: { src: "/mission-cards/09-research-platform.png", width: 749, height: 982 },
  10: { src: "/mission-cards/10-fragile-microhabitats.png", width: 754, height: 982 },
  11: { src: "/mission-cards/11-window-to-the-past.png", width: 749, height: 982 },
  12: { src: "/mission-cards/12-forest-elder.png", width: 750, height: 982 },
  13: { src: "/mission-cards/13-keystone-species.png", width: 754, height: 982 },
  14: { src: "/mission-cards/14-seeds-of-renewal.png", width: 749, height: 982 },
  15: { src: "/mission-cards/15-biocentric-architecture.png", width: 1497, height: 982 },
};

export function missionCard(number: number) {
  return MISSION_CARDS[number] ?? null;
}
