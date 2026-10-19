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
    reward: 2400, subjects: ["exploration", "modes", "isru", "kinetics"],
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
  stars: 1 | 2 | 3;
  starNotes: [string, string, string];
  bonuses: { label: string; points: number }[];
}

/** Stars reward craft, not just completion: finish, finish clean, finish fast. */
export function rateLevel(result: Omit<LevelResult, "stars" | "starNotes">): Pick<LevelResult, "stars" | "starNotes"> {
  const clean = result.hits === 0;
  const parTime = 60 + result.level * 45;
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
  };
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
    this.streakTimer = 8;
    return earned;
  }

  breakStreak() {
    this.streak = 0;
    this.streakTimer = 0;
  }

  tick(dt: number) {
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
    const parTime = 60 + (this.index + 1) * 45;
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
