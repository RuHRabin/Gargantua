import type { HazardProfile } from "./hazards";

export interface FlightStats {
  thrustSeconds: number;
  coastSeconds: number;
  solarSeconds: number;
  collected: number;
  uploaded: number;
  deepSeconds: number;
  surveys: number;
  flybys: number;
  scans: number;
  destroyed: number;
  dodged: number;
  ionSeconds: number;
  sailSeconds: number;
  ice: number;
  docks: number;
  services: number;
  sectorsCharted: number;
  /** Comets broken up with the mass driver. */
  cometsDestroyed: number;
  /** Longest chain of clears and close passes in this chapter. */
  peakStreak: number;
  /** Longest stretch flown without taking an impact in this chapter, in seconds. */
  cleanSeconds: number;
  /** Debris waves that have fully passed. */
  wavesCleared: number;
}

export interface MissionTask {
  label: string;
  metric: keyof FlightStats;
  goal: number;
  unit?: string;
}

export interface Mission {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  reward: number;
  subjects: string[];
  tasks: MissionTask[];
  /** What this chapter's traffic is made of. Omitted for the original chapters. */
  hazards?: HazardProfile;
  /** Short flight-condition tags shown in mission control, e.g. "Debris waves". */
  conditions?: string[];
  /** Par time in seconds for the third star. Defaults to 60 + 45 seconds per chapter number. */
  par?: number;
}

export const MISSIONS: Mission[] = [
  {
    id: "first-light", title: "First light", subtitle: "A gentle first flight",
    description: "A quiet orbit with nothing to hit and no clock running against you. Fire the engines, feel the ship coast, then open the arrays and let the disk fill the battery. Take your time; this chapter is here to teach the controls.",
    reward: 300, subjects: ["propulsion", "inertia", "power"],
    tasks: [
      { label: "Fire the main engines", metric: "thrustSeconds", goal: 1, unit: "s" },
      { label: "Coast with engines off", metric: "coastSeconds", goal: 2, unit: "s" },
      { label: "Open the arrays and collect light", metric: "solarSeconds", goal: 3, unit: "s" },
    ],
  },
  {
    id: "debris-run", title: "Debris run", subtitle: "Clear the corridor",
    description: "Gargantua drags a storm of rock and ice through these orbits. Break up the asteroids with the mass driver, slip past the ones you cannot clear, and try the ion drive: it barely touches the tanks.",
    reward: 500, subjects: ["debris", "defense", "modes", "orbits"],
    tasks: [
      { label: "Destroy asteroids", metric: "destroyed", goal: 4 },
      { label: "Dodge a close pass", metric: "dodged", goal: 3 },
      { label: "Cruise on the ion drive", metric: "ionSeconds", goal: 4, unit: "s" },
      { label: "Collect research data", metric: "collected", goal: 25 },
    ],
  },
  {
    id: "relative-time", title: "Relative time", subtitle: "Test Einstein's idea",
    description: "Fly inside 8 Schwarzschild radii and watch the clock ratio climb. The light is fierce down here, which makes it the perfect place to ride the solar sail back out without spending a drop of propellant.",
    reward: 700, subjects: ["relativity", "horizon", "comets", "modes"],
    tasks: [
      { label: "Observe within 8 rs", metric: "deepSeconds", goal: 4, unit: "s" },
      { label: "Ride the solar sail", metric: "sailSeconds", goal: 6, unit: "s" },
      { label: "Avoid close passes", metric: "dodged", goal: 7 },
      { label: "Upload research data", metric: "uploaded", goal: 45 },
    ],
  },
  {
    id: "worlds-beyond", title: "Worlds beyond", subtitle: "Become an explorer",
    description: "Scan a planet up close and complete an inward-and-outward flyby. Comets run fast and fragile: one clean hit is enough, and the ice they shed refills your water tanks.",
    reward: 900, subjects: ["miller", "mann", "edmunds", "flyby", "isru"],
    tasks: [
      { label: "Survey any planet", metric: "surveys", goal: 1 },
      { label: "Dive below 5 rs and exit beyond 8 rs", metric: "flybys", goal: 1 },
      { label: "Recover comet ice", metric: "ice", goal: 1 },
      { label: "Clear debris from the lane", metric: "destroyed", goal: 12 },
    ],
  },
  {
    id: "bring-it-home", title: "Bring it home", subtitle: "Knowledge is the cargo",
    description: "Deliver 150 research units to Endurance through the thickest traffic of the expedition. Field-guide quizzes keep earning knowledge points along the way.",
    reward: 1200, subjects: ["electrolysis", "wormhole", "tesseract"],
    tasks: [
      { label: "Transmit total research data", metric: "uploaded", goal: 150 },
      { label: "Survive close passes", metric: "dodged", goal: 14 },
    ],
  },
  {
    id: "home-port", title: "Home port", subtitle: "Learn to come back",
    description: "Endurance is more than a landmark. Dock with the station, transmit cargo, repair the hull and replenish propellant, water and battery charge. A good pilot knows when to come home.",
    reward: 1450, subjects: ["endurance", "electrolysis"],
    tasks: [
      { label: "Dock with Endurance", metric: "docks", goal: 1 },
      { label: "Run station resupply", metric: "services", goal: 1 },
      { label: "Upload 80 research units", metric: "uploaded", goal: 80 },
    ],
  },
  {
    id: "uncharted-lanes", title: "Uncharted lanes", subtitle: "Map the unknown",
    description: "The star chart is full of blank space. Fly through eight new sectors, scan a planet and return with your survey. Every safely charted bearing expands your navigable map.",
    reward: 1800, subjects: ["exploration", "miller", "mann", "edmunds"],
    tasks: [
      { label: "Chart new sectors", metric: "sectorsCharted", goal: 8 },
      { label: "Survey a planetary body", metric: "surveys", goal: 1 },
      { label: "Dodge close passes", metric: "dodged", goal: 8 },
    ],
  },
  {
    id: "deep-expedition", title: "Deep expedition", subtitle: "Bring the system together",
    description: "A full-spectrum run: chart new space, collect and transmit research, then make a final resupply stop at Endurance. Discoveries and your star chart persist between flights.",
    reward: 2400, subjects: ["exploration", "modes", "isru", "defense"],
    tasks: [
      { label: "Chart new sectors", metric: "sectorsCharted", goal: 14 },
      { label: "Complete a station resupply", metric: "services", goal: 2 },
      { label: "Transmit 150 research units", metric: "uploaded", goal: 150 },
    ],
  },
  {
    id: "final-survey", title: "The long way home", subtitle: "Finish the atlas",
    description: "Complete the expedition's record: bring the Ranger home for a full station service and extend your sector chart into the outer system. Endurance is the safe harbor between every leg.",
    reward: 2800, subjects: ["exploration", "endurance", "modes"],
    tasks: [
      { label: "Visit the Endurance service bay", metric: "services", goal: 3 },
      { label: "Chart the whole region", metric: "sectorsCharted", goal: 22 },
      { label: "Complete the science relay", metric: "uploaded", goal: 220 },
    ],
  },
  {
    id: "meteor-stream", title: "Meteor stream", subtitle: "Debris from one bearing",
    description: "A comet broke apart upstream of Endurance, and its debris now flows through the lane as a stream: bunches of rock that arrive together from a single bearing, a few seconds apart. Shatter the leaders, thread the gaps, and clear a whole wave for a bonus. A wave that never touches the hull pays the most.",
    reward: 3000, subjects: ["streams", "defense", "debris"], par: 330,
    conditions: ["Debris waves", "Light traffic between waves"],
    hazards: { intensity: 1.2, cometShare: 0.25, wave: { every: 22, size: 6, kind: "asteroid", spread: 5 } },
    tasks: [
      { label: "Clear debris waves", metric: "wavesCleared", goal: 3 },
      { label: "Chain a streak of six", metric: "peakStreak", goal: 6 },
      { label: "Avoid close passes", metric: "dodged", goal: 20 },
    ],
  },
  {
    id: "comet-hunters", title: "Comet hunters", subtitle: "Ice on the move",
    description: "The stream carried ice with it. Comets crowd these lanes now: fast, fragile and worth far more than rock. Break them up close to the Ranger and the scoop field pulls the fragments into your water tanks. Between hunts, coast on the ion drive and let the tanks fill.",
    reward: 3300, subjects: ["comets", "isru", "debris", "modes"], par: 330,
    conditions: ["Comet shower", "Fast, fragile targets"],
    hazards: { intensity: 1.9, cometShare: 0.7, wave: { every: 30, size: 4, kind: "comet" } },
    tasks: [
      { label: "Destroy comets", metric: "cometsDestroyed", goal: 8 },
      { label: "Recover comet ice", metric: "ice", goal: 4 },
      { label: "Cruise on the ion drive", metric: "ionSeconds", goal: 30, unit: "s" },
    ],
  },
  {
    id: "steady-hand", title: "Steady hand", subtitle: "Not a scratch",
    description: "Fewer bodies, but they move fast and they do not forgive. This chapter measures your longest stretch without a single impact, so every clean second counts and one hit sets the clock back to zero. Coasting saves propellant and keeps your hands calm; scan the nearby bodies while you drift.",
    reward: 3600, subjects: ["inertia", "modes", "comets"], par: 360,
    conditions: ["Fast traffic", "One hit resets your run"],
    hazards: { intensity: 1.5, speed: 1.45, cometShare: 0.5 },
    tasks: [
      { label: "Fly 60 seconds without an impact", metric: "cleanSeconds", goal: 60, unit: "s" },
      { label: "Coast with engines off", metric: "coastSeconds", goal: 45, unit: "s" },
      { label: "Run sensor scans", metric: "scans", goal: 3 },
    ],
  },
  {
    id: "gravity-assist", title: "Gravity assist", subtitle: "Borrow the hole's energy",
    description: "The traffic thins out near the hole, and the reward for going deep is time and speed. Make three clean inward-and-outward flybys, linger in the fierce light below 8 Schwarzschild radii, and use the solar sail to climb out. Keep the data flowing to Endurance as you go.",
    reward: 4000, subjects: ["tides", "flyby", "relativity", "horizon"], par: 390,
    conditions: ["Light traffic", "Deep-dive flybys"],
    hazards: { intensity: 0.9, cometShare: 0.4, speed: 1.1 },
    tasks: [
      { label: "Complete deep flybys", metric: "flybys", goal: 3 },
      { label: "Observe within 8 rs", metric: "deepSeconds", goal: 14, unit: "s" },
      { label: "Ride the solar sail", metric: "sailSeconds", goal: 12, unit: "s" },
      { label: "Transmit total research data", metric: "uploaded", goal: 260 },
    ],
  },
  {
    id: "storm-front", title: "Storm front", subtitle: "Everything at once",
    description: "A second stream is crossing the first, and the rocks are bigger than anything so far. Debris waves arrive close together over a thick background of traffic. Keep your streak alive, clear the waves, and remember that the mass driver kicks the Ranger back with every shot.",
    reward: 4600, subjects: ["streams", "defense", "modes"], par: 450,
    conditions: ["Frequent debris waves", "Large rocks", "Heavy traffic"],
    hazards: { intensity: 2.2, cometShare: 0.35, size: 1.25, wave: { every: 17, size: 6, kind: "mixed" } },
    tasks: [
      { label: "Clear debris waves", metric: "wavesCleared", goal: 8 },
      { label: "Chain a streak of ten", metric: "peakStreak", goal: 10 },
      { label: "Destroy asteroids and comets", metric: "destroyed", goal: 40 },
    ],
  },
  {
    id: "beyond-the-atlas", title: "Beyond the atlas", subtitle: "Close the expedition",
    description: "The chart ends here, and the work does not. Push into the outer sectors, keep Endurance supplied through four service stops, relay a full library of data home, and prove you can still fly clean when the lane fills with debris. The last chapter asks for everything you have learned.",
    reward: 6000, subjects: ["exploration", "endurance", "tides"], par: 600,
    conditions: ["Debris waves", "Long range", "Station resupply"],
    hazards: { intensity: 1.8, cometShare: 0.4, wave: { every: 35, size: 5, kind: "mixed" } },
    tasks: [
      { label: "Chart new sectors", metric: "sectorsCharted", goal: 30 },
      { label: "Complete station resupplies", metric: "services", goal: 4 },
      { label: "Transmit research data", metric: "uploaded", goal: 300 },
      { label: "Fly 40 seconds without an impact", metric: "cleanSeconds", goal: 40, unit: "s" },
    ],
  },
];

export interface CampaignSnapshot {
  level: number;
  points: number;
  completed: number;
  stats: FlightStats;
  streak: number;
  streakMultiplier: number;
  levelPoints: number;
}

  

/** A level-complete report card: what was earned, how well it was flown, and the star rating. */
export interface LevelResult {
  level: number;
  title: string;
  nextTitle: string | null;
  reward: number;
  levelPoints: number;
  totalPoints: number;
  seconds: number;
  hullLost: number;
  hits: number;
  destroyed: number;
  dodged: number;
  collected: number;
  bestStreak: number;
  /** Par time used for this chapter's third star, when it differs from the default. */
  par?: number;
  stars: 1 | 2 | 3;
  starNotes: [string, string, string];
  bonuses: { label: string; points: number }[];
}

/** Stars reward craft, not just completion: finish, finish clean, finish fast. */
export function rateLevel(result: Omit<LevelResult, "stars" | "starNotes">): Pick<LevelResult, "stars" | "starNotes"> {
  const clean = result.hits === 0;
  const parTime = result.par ?? 60 + result.level * 45;
  const quick = result.seconds <= parTime;
  const stars = (1 + (clean ? 1 : 0) + (quick ? 1 : 0)) as 1 | 2 | 3;
  return {
    stars,
    starNotes: [
      "Objectives complete",
      clean ? "Flawless hull / no impacts taken" : `Took ${result.hits} impact${result.hits === 1 ? "" : "s"} / fly clean for a star`,
      quick ? `Under par / ${Math.round(result.seconds)}s of ${parTime}s` : `${Math.round(result.seconds)}s / beat ${parTime}s for a star`,
    ],
  };
}

export class Campaign {
  index = 0;
  points = 0;
  completed = 0;
  // Per-level bookkeeping for the debrief screen.
  levelPoints = 0;
  levelStart = 0;
  levelHits = 0;
  levelHullLost = 0;
  levelDestroyed = 0;
  levelDodged = 0;
  levelCollected = 0;
  levelServices = 0;
  levelDocks = 0;
  stationCredits = 3;
  // Chaining destroys and dodges builds a multiplier; taking a hit resets it.
  streak = 0;
  bestStreak = 0;
  streakTimer = 0;
  stats: FlightStats = {
    thrustSeconds: 0, coastSeconds: 0, solarSeconds: 0, collected: 0,
    uploaded: 0, deepSeconds: 0, surveys: 0, flybys: 0, scans: 0,
    destroyed: 0, dodged: 0, ionSeconds: 0, sailSeconds: 0, ice: 0,
    docks: 0, services: 0, sectorsCharted: 0,
    cometsDestroyed: 0, peakStreak: 0, cleanSeconds: 0, wavesCleared: 0,
  };
  /** Seconds since the last impact, feeding the cleanSeconds record. */
  cleanRun = 0;
  private knowledge = new Set<string>();

  reset(level = 1, now = 0) {
    this.index = Math.max(0, Math.min(MISSIONS.length - 1, Math.floor(level) - 1));
    this.completed = this.index;
    this.points = 0;
    this.stationCredits = 3;
    this.knowledge.clear();
    for (const key of Object.keys(this.stats) as (keyof FlightStats)[]) this.stats[key] = 0;
    this.beginLevel(now);
  }

  beginLevel(now: number) {
    this.levelPoints = 0;
    this.levelStart = now;
    this.levelHits = 0;
    this.levelHullLost = 0;
    this.levelDestroyed = 0;
    this.levelDodged = 0;
    this.levelCollected = 0;
    this.levelServices = 0;
    this.levelDocks = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.streakTimer = 0;
    // Records of skill start fresh each chapter, so one great run does not clear the next chapter's goal.
    this.stats.peakStreak = 0;
    this.stats.cleanSeconds = 0;
    this.cleanRun = 0;
  }

  get streakMultiplier() {
    return this.streak >= 12 ? 3 : this.streak >= 6 ? 2 : this.streak >= 3 ? 1.5 : 1;
  }

  addPoints(value: number) {
    const rounded = Math.max(0, Math.round(value));
    this.points += rounded;
    this.levelPoints += rounded;
  }

  earnStationCredit() {
    this.stationCredits = Math.min(9, this.stationCredits + 1);
  }

  spendStationCredit() {
    if (this.stationCredits <= 0) return false;
    this.stationCredits--;
    return true;
  }

  /** Combat points are multiplied by the current streak and extend it. */
  addStreakPoints(value: number) {
    const earned = Math.round(value * this.streakMultiplier);
    this.addPoints(earned);
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.stats.peakStreak = Math.max(this.stats.peakStreak, this.streak);
    this.streakTimer = 8;
    return earned;
  }

  breakStreak() {
    this.streak = 0;
    this.streakTimer = 0;
  }

  /** An impact ends the current hit-free run. */
  noteHit() {
    this.cleanRun = 0;
  }

  tick(dt: number) {
    this.cleanRun += dt;
    this.stats.cleanSeconds = Math.max(this.stats.cleanSeconds, this.cleanRun);
    if (this.streakTimer > 0) {
      this.streakTimer -= dt;
      if (this.streakTimer <= 0) this.breakStreak();
    }
  }

  rewardKnowledge(id: string) {
    if (this.knowledge.has(id)) return false;
    this.knowledge.add(id);
    this.addPoints(100);
    return true;
  }

  /** Returns a full debrief when every task in the current level is met; otherwise null. */
  advance(now: number, hull: number): LevelResult | null {
    const mission = MISSIONS[this.index];
    if (!mission || !mission.tasks.every((task) => this.stats[task.metric] >= task.goal)) return null;

    const seconds = Math.max(1, now - this.levelStart);
    const bonuses: { label: string; points: number }[] = [{ label: "Objectives complete", points: mission.reward }];
    if (this.levelHits === 0) bonuses.push({ label: "Flawless hull", points: 250 });
    if (this.levelServices > 0) bonuses.push({ label: "Endurance resupply", points: 120 });
    if (hull >= 90) bonuses.push({ label: "Ship in good repair", points: 100 });
    if (this.bestStreak >= 6) bonuses.push({ label: `Best streak x${this.bestStreak}`, points: this.bestStreak * 20 });
    const parTime = mission.par ?? 60 + (this.index + 1) * 45;
    if (seconds <= parTime) bonuses.push({ label: "Under par time", points: Math.round((parTime - seconds) * 3) });
    for (const bonus of bonuses) this.addPoints(bonus.points);

    const base = {
      level: this.index + 1,
      title: mission.title,
      nextTitle: MISSIONS[this.index + 1]?.title ?? null,
      reward: mission.reward,
      levelPoints: this.levelPoints,
      totalPoints: this.points,
      seconds,
      hullLost: this.levelHullLost,
      hits: this.levelHits,
      destroyed: this.levelDestroyed,
      dodged: this.levelDodged,
      collected: this.levelCollected,
      bestStreak: this.bestStreak,
      par: mission.par,
      bonuses,
    };
    this.completed = this.index + 1;
    this.index++;
    return { ...base, ...rateLevel(base) };
  }

  snapshot(): CampaignSnapshot {
    return {
      level: Math.min(MISSIONS.length, this.index + 1),
      points: this.points,
      completed: this.completed,
      stats: { ...this.stats },
      streak: this.streak,
      streakMultiplier: this.streakMultiplier,
      levelPoints: this.levelPoints,
    };
  }
}
