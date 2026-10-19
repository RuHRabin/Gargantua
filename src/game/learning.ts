export interface Lesson {
  id: string;
  name: string;
  category: "Physics" | "Objects" | "Fiction";
  kicker: string;
  summary: string;
  explanation: string;
  formula?: string;
  formulaNote?: string;
  inGame: string;
  diagram: "thrust" | "orbit" | "hole" | "light" | "clock" | "world" | "cube";
  source: { label: string; url: string };
  quiz: { question: string; answers: [string, string, string]; correct: number; explanation: string };
}

const anatomy = { label: "NASA / Anatomy of a black hole", url: "https://science.nasa.gov/universe/black-holes/anatomy/" };
const propulsion = { label: "NASA / Spacecraft propulsion", url: "https://www.nasa.gov/smallsat-institute/sst-soa/in-space-propulsion/" };
const water = { label: "NASA / Water-powered engines", url: "https://spinoff.nasa.gov/Spinoff2020/t_6.html" };
const trajectories = { label: "NASA / Trajectories", url: "https://science.nasa.gov/learn/basics-of-space-flight/chapter4-1/" };
const relativity = { label: "NASA / Gravity and time", url: "https://science.nasa.gov/universe/what-happens-when-something-gets-too-close-to-a-black-hole/" };
const film = { label: "Interstellar / Fictional universe", url: "https://www.interstellarmovie.net/" };

export const LESSONS: Lesson[] = [
  {
    id: "propulsion", name: "Rocket propulsion", category: "Physics", kicker: "Newton's third law",
    summary: "Throw mass backward. Move forward.",
    explanation: "A rocket expels propellant through a nozzle. The exhaust gains momentum in one direction and the spacecraft gains momentum in the other. Rockets do not need air to push against, so they work in a vacuum. Electrical power and propellant are different resources; even an ion engine normally needs both.",
    formula: "F = mass flow x exhaust velocity",
    formulaNote: "A simplified rocket-thrust equation, ignoring the nozzle pressure term.",
    inGame: "W or the thrust button consumes propellant. The Ranger's engine and resource rates are game-scale approximations, not a real propulsion specification.",
    diagram: "thrust", source: propulsion,
    quiz: { question: "What does a rocket push against in space?", answers: ["The surrounding air", "Its own expelled propellant", "The nearest planet"], correct: 1, explanation: "The rocket and its exhaust exchange momentum. No atmosphere is required." },
  },
  {
    id: "inertia", name: "Inertia & coasting", category: "Physics", kicker: "Newton's first law",
    summary: "Engines off does not mean motion off.",
    explanation: "An object keeps a constant velocity unless a net force acts on it. In deep space there is almost no aerodynamic drag. Near a massive body, gravity still changes a spacecraft's velocity and bends its path, even while the engines are off.",
    formula: "Net force = 0  ->  constant velocity",
    inGame: "Release thrust to coast. There is no artificial drag, although Gargantua's gravity still accelerates you. The flight computer caps top speed for playability.",
    diagram: "thrust", source: trajectories,
    quiz: { question: "Why can the ship move with its engines off?", answers: ["It retains momentum", "Space supplies free fuel", "Gravity disappears"], correct: 0, explanation: "Momentum persists. Gravity can still curve or accelerate that motion." },
  },
  {
    id: "power", name: "Light, power & solar sails", category: "Physics", kicker: "Two different uses of sunlight",
    summary: "Panels make electricity. Sails exchange momentum.",
    explanation: "Photovoltaic panels turn light into electrical energy for instruments, batteries and electric thrusters. Solar sails are different: reflected photons transfer momentum and can propel a craft without onboard propellant. Spacecraft may also use batteries, radioisotope generators or nuclear power; sunlight is not a universal requirement.",
    formula: "Light intensity ~ 1 / distance squared",
    formulaNote: "An approximation for a compact light source. A wide accretion disk has more complex illumination.",
    inGame: "R unfolds the photovoltaic arrays; they fill the battery using a simplified 1/r\u00b2 disk-light model. V switches to Sail mode, a separate reflective film that rides photon pressure with no propellant at all. Real radiation near an accretion disk would be far harsher than the game suggests.",
    diagram: "light", source: { label: "NASA JPL / Solar sail physics", url: "https://www.jpl.nasa.gov/news/flying-with-natures-own-fuel/" },
    quiz: { question: "Can sunlight propel a spacecraft without onboard propellant?", answers: ["No, never", "Yes, with a solar sail", "Only if light becomes fuel"], correct: 1, explanation: "Photons carry momentum. Reflecting them on a large sail produces a small, continuous force." },
  },
  {
    id: "electrolysis", name: "Water electrolysis", category: "Physics", kicker: "Energy is not reaction mass",
    summary: "Electricity splits water; it does not create matter.",
    explanation: "An electrolyzer uses electrical energy to separate water into hydrogen and oxygen. Those gases can be stored and burned in a rocket. The atoms come from the water reserve, so electricity alone cannot replenish the mass in a propellant tank. NASA has developed water-based spacecraft propulsion.",
    formula: "2 H2O + electrical energy -> 2 H2 + O2",
    inGame: "Hold C to process stored water and battery charge into propellant, or leave the auto-refinery (G) on and surplus solar charge does it for you whenever the arrays are out. The atoms come from the water, not the electricity. Water comes back from Endurance and from comet ice. Rates are accelerated for the game.",
    diagram: "light", source: water,
    quiz: { question: "What does the electrolyzer need besides electricity?", answers: ["A vacuum", "Water to supply the atoms", "Only more sunlight"], correct: 1, explanation: "The water supplies the hydrogen and oxygen. Energy rearranges matter; it does not make the required atoms from nothing." },
  },
  {
    id: "orbits", name: "Orbits & free fall", category: "Physics", kicker: "Falling around, not falling down",
    summary: "An orbit is a continuous fall with sideways motion.",
    explanation: "Gravity pulls a spacecraft inward while sideways velocity carries it around the central body. An orbiting astronaut floats because astronaut and craft are falling together, not because gravity has vanished. For a Newtonian circular orbit, closer objects need a higher orbital speed.",
    formula: "v = sqrt(G M / r)", formulaNote: "Circular-orbit speed in Newtonian gravity. Close to a black hole, general relativity is needed.",
    inGame: "Endurance begins on a circular orbit. The ship uses simplified gravity; distances and orbital rates are compressed and not a calibrated simulation of the movie.",
    diagram: "orbit", source: trajectories,
    quiz: { question: "Why do astronauts float in orbit?", answers: ["There is no gravity", "The craft cancels gravity", "They and the spacecraft fall together"], correct: 2, explanation: "They are in continuous free fall. Gravity is still what keeps the spacecraft in orbit." },
  },
  {
    id: "gargantua", name: "Gargantua", category: "Objects", kicker: "The black hole at the center",
    summary: "A fictional world built around real ideas.",
    explanation: "Gargantua is the fictional supermassive, rapidly rotating black hole in Interstellar. Real supermassive black holes exist: Sagittarius A* lies at the center of our Milky Way, and M87* was imaged by the Event Horizon Telescope. A black hole is not a cosmic vacuum cleaner; far away, its gravity behaves like that of any object with the same mass.",
    formula: "rs = 2 G M / c squared", formulaNote: "The Schwarzschild radius of a non-rotating black hole. Gargantua in the film rotates, so its geometry is more complex.",
    inGame: "The name comes from the film. Our visuals approximate a non-rotating black hole and use rs as a distance unit; they are not a full Kerr solution.",
    diagram: "hole", source: anatomy,
    quiz: { question: "Which statement is true?", answers: ["Gargantua is a confirmed real black hole", "Every black hole sucks in everything nearby", "Gargantua is fictional; black holes are real"], correct: 2, explanation: "Gargantua belongs to the movie. Astronomers observe real black holes through their effects on light and matter." },
  },
  {
    id: "disk", name: "Accretion disk", category: "Physics", kicker: "The light is outside the hole",
    summary: "Hot orbiting matter creates the glow.",
    explanation: "Gas can settle into a rapidly rotating disk around a black hole. As matter spirals inward, gravitational energy is converted into heat and radiation. The luminous disk is outside the event horizon. Not every black hole has a bright disk, and radiation near one could be deadly.",
    inGame: "The warm, rotating band supplies the disk-light the photovoltaic arrays drink from. Brightness, color, radiation safety and disk structure are artistic approximations; a real accretion disk would be hostile to spacecraft hardware.",
    diagram: "hole", source: anatomy,
    quiz: { question: "What produces the visible glow around the black hole?", answers: ["Light escaping from inside the horizon", "Hot matter outside the horizon", "The black surface reflecting starlight"], correct: 1, explanation: "The disk shines before its matter enters the horizon. Light from inside cannot reach an outside observer." },
  },
  {
    id: "lensing", name: "Gravitational lensing", category: "Physics", kicker: "Spacetime changes the path",
    summary: "One disk can appear above and below itself.",
    explanation: "Mass curves spacetime, and light follows that curved geometry. A black hole can bend light from the far side of its disk toward you, creating apparent arches above and below the dark shadow. These are distorted views of the same disk, not two extra disks.",
    inGame: "The raymarching shader numerically bends light paths. The bright side of the disk also hints at relativistic beaming, but the beaming model is simplified.",
    diagram: "hole", source: anatomy,
    quiz: { question: "Why does the disk seem to arch above the black hole?", answers: ["There is a second disk", "Gravity bends light from the far side", "The disk is reflected by a solid surface"], correct: 1, explanation: "Gravitational lensing redirects light from the far side of the same disk." },
  },
  {
    id: "relativity", name: "Gravitational time dilation", category: "Physics", kicker: "Two clocks, two rates",
    summary: "A lower clock runs slower relative to a distant one.",
    explanation: "Clocks deeper in a gravitational field tick more slowly relative to clocks farther away. Locally, your own clock feels normal. For a stationary clock outside a non-rotating black hole, the ideal distant-to-local clock ratio is 1 / sqrt(1 - rs/r). Motion and rotation also affect real comparisons.",
    formula: "distant time / local time = 1 / sqrt(1 - rs/r)",
    formulaNote: "Stationary Schwarzschild-clock model, not the ratio for a moving ship around the rotating Gargantua in the film.",
    inGame: "The HUD shows that simplified ratio, not 'seven years per hour'. The expedition deadline is separately accelerated for gameplay; it is not a physical Earth-clock prediction.",
    diagram: "clock", source: relativity,
    quiz: { question: "How does your own clock feel near the black hole?", answers: ["It feels normal locally", "You feel every second stretch", "It stops for you"], correct: 0, explanation: "Your local time feels normal. The difference appears when clocks at different locations are compared." },
  },
  {
    id: "horizon", name: "Event horizon", category: "Physics", kicker: "A boundary, not a wall",
    summary: "Beyond it, outward signals cannot escape.",
    explanation: "The event horizon is the boundary beyond which light and matter cannot send signals back to the outside universe. It is not a material surface. The visible black-hole shadow is larger than the horizon because light bending also directs some rays into the hole.",
    inGame: "The ending begins slightly outside 1 rs for safety and storytelling. Entering a tesseract and sending data back are fictional; a real outside observer cannot receive a signal sent from inside the horizon.",
    diagram: "hole", source: anatomy,
    quiz: { question: "Is the event horizon a solid surface?", answers: ["Yes, a black shell", "No, it is a causal boundary", "Yes, a frozen disk"], correct: 1, explanation: "It is a boundary in spacetime, not a wall made of material." },
  },
  {
    id: "flyby", name: "Flybys & gravity assists", category: "Physics", kicker: "Where the energy comes from",
    summary: "A moving planet can exchange energy with a spacecraft.",
    explanation: "A gravity assist changes a spacecraft's trajectory by exchanging energy and momentum with a moving planet. A flyby of a stationary mass does not give unlimited net speed: you gain speed falling in and lose it climbing out. Burning at high speed near closest approach can increase orbital energy efficiently; that is the Oberth effect.",
    inGame: "The 'deep flyby' is a piloting challenge. Its point bonus is a game reward, not free physical energy from stationary Gargantua.",
    diagram: "orbit", source: trajectories,
    quiz: { question: "In a real planetary gravity assist, where can the net energy gain come from?", answers: ["Energy appears from nothing", "The planet's orbital motion", "Empty space produces extra fuel"], correct: 1, explanation: "The planet and spacecraft exchange energy. The effect on a massive planet is extraordinarily small." },
  },
  {
    id: "endurance", name: "Endurance & Ranger", category: "Objects", kicker: "Your ship and your home port",
    summary: "Endurance is the mothership. Ranger is your shuttle.",
    explanation: "These are fictional spacecraft from Interstellar. Endurance's rotating ring evokes the real idea of artificial gravity: rotation makes a floor push on your body, providing centripetal acceleration. Ranger is the smaller landing and exploration craft. Their capabilities here are game abstractions.",
    formula: "a = angular speed squared x radius",
    inGame: "Approach Endurance to upload research and refill propellant, water and charge. The fast rotating ring is visual storytelling, not a calibrated habitat design.",
    diagram: "orbit", source: film,
    quiz: { question: "What creates the floor force in a rotating habitat?", answers: ["The black hole cancels weight", "Rotation and centripetal acceleration", "The habitat creates new mass"], correct: 1, explanation: "The rotating floor must push you inward to keep you moving in a circle." },
  },
  {
    id: "miller", name: "Miller's planet", category: "Objects", kicker: "A fictional ocean world",
    summary: "Water world. Extreme tides. Relative time.",
    explanation: "Miller's planet is the shallow-water world in Interstellar. Its enormous waves and dramatic clock difference connect to tidal forces and general relativity. Tidal forces are differences in gravitational pull across an object. The planet itself has not been discovered, and the film's clock ratio cannot be reproduced by our simple non-rotating model.",
    inGame: "The small blue world is named MILLER. Fly close or select it and scan within range for survey data. Its distance and size are deliberately compressed.",
    diagram: "world", source: film,
    quiz: { question: "What causes tidal stretching?", answers: ["A difference in gravity across an object", "Gravity vanishing in water", "A planet having no atmosphere"], correct: 0, explanation: "The near side feels a stronger pull than the far side. That difference creates tides." },
  },
  {
    id: "mann", name: "Mann's planet", category: "Objects", kicker: "A fictional frozen world",
    summary: "Cold does not automatically mean habitable.",
    explanation: "Mann's planet is the icy world in Interstellar, named after Dr. Mann. Habitability requires more than a surface to stand on: scientists study energy sources, chemistry, liquid-water possibilities and environmental stability. A convincing-looking world still needs reliable measurements.",
    inGame: "MANN is the pale planet on an outer orbit. Its texture represents a fictional environment, not an observed exoplanet.",
    diagram: "world", source: film,
    quiz: { question: "Which evidence matters when judging a world's habitability?", answers: ["Its name", "Only how bright it looks", "Measured chemistry, energy and environment"], correct: 2, explanation: "Habitability is an evidence-based scientific question, not a visual impression." },
  },
  {
    id: "edmunds", name: "Edmunds' planet", category: "Objects", kicker: "A fictional destination",
    summary: "A place to ask whether life could survive.",
    explanation: "Edmunds' planet is the possible new home in Interstellar. In real exoplanet science, the habitable zone is a region where surface liquid water might be possible under suitable conditions. Being in that zone does not prove that a planet has water, air, or life.",
    inGame: "EDMUNDS is the warm-colored outer world. A survey earns research points, but the game does not make a real habitability measurement.",
    diagram: "world", source: film,
    quiz: { question: "Does being in a habitable zone prove a planet has life?", answers: ["Yes, always", "No, it only suggests some conditions could be suitable", "Only if the planet is orange"], correct: 1, explanation: "The habitable zone is a useful starting point, not a detection of life." },
  },
  {
    id: "modes", name: "Three ways to push", category: "Physics", kicker: "Chemical, ion and sail",
    summary: "Light can power a ship, and it can push one. It cannot be burned.",
    explanation: "A chemical rocket burns propellant fast and hard. An ion engine uses electricity to accelerate a tiny stream of propellant to very high speed, so it gets far more push per kilogram carried; NASA's Dawn and DART flew on ion drives. A solar sail needs no propellant at all: photons carry momentum, and a large mirror reflecting them feels a small, continuous force. The push is strongest when the sail squarely faces the light and always points away from it, so sails steer by tilting, like tacking a boat.",
    formula: "Isp: chemical ~450 s / ion ~3000 s / sail: no propellant",
    formulaNote: "Specific impulse measures push per unit of propellant. Higher is more economical, usually at the cost of lower thrust.",
    inGame: "V cycles the drive. Chemical is strong and thirsty. Ion is gentle, sips propellant and drinks charge. Sail costs nothing but pushes only away from the disk, with strength following cos\u00b2 of the sail angle; angle the ship to tack. Sail force is scaled up enormously for play; a real sail accelerates over weeks.",
    diagram: "thrust", source: { label: "NASA / Solar sails & ion propulsion", url: "https://www.nasa.gov/smallspacecraft/what-is-a-solar-sail/" },
    quiz: { question: "Which drive could keep working with empty propellant tanks?", answers: ["The chemical engine", "The ion drive", "The solar sail"], correct: 2, explanation: "A sail is pushed by reflected light itself. The ion drive is economical but still throws propellant; the chemical engine burns it fastest." },
  },
  {
    id: "isru", name: "Water from comets", category: "Physics", kicker: "Living off the land in space",
    summary: "Ice is fuel waiting to be split.",
    explanation: "In-situ resource utilization means using what you find instead of carrying it. Comets and many asteroids hold water ice; water can be split into hydrogen and oxygen, which are rocket propellants, and the oxygen is breathable. NASA has tested extracting oxygen from Martian air with MOXIE and studies lunar polar ice for the same reason. Mass you do not launch is mass you do not have to lift.",
    formula: "ice -> water -> (electrolysis) -> H2 + O2",
    inGame: "Break a comet nearby and its ice tops up the water tanks; skim a coma with the scoop (F) to collect it slowly. With arrays out and the auto-refinery on, sunlight turns that water into propellant. Real harvesting would take robotic mining, not a flyby.",
    diagram: "light", source: { label: "NASA / In-situ resource utilization", url: "https://www.nasa.gov/isru/" },
    quiz: { question: "Why does water ice matter for deep-space travel?", answers: ["It can be split into rocket propellant and oxygen", "It cools the engines", "It is heavier than metal"], correct: 0, explanation: "Electrolysis separates water into hydrogen and oxygen: propellant and breathable air, sourced on site instead of launched from Earth." },
  },
  {
    id: "debris", name: "Asteroids & comets", category: "Objects", kicker: "Rock, metal and dirty ice",
    summary: "Two different kinds of leftover from planet building.",
    explanation: "Asteroids are rocky or metallic bodies, most of them in the belt between Mars and Jupiter. Comets are rich in ice and dust; when heated they release gas and grow a glowing coma and one or more tails. A comet's tail is pushed away from the light source by radiation pressure and stellar wind, so it does not simply trail behind the comet's direction of travel.",
    inGame: "Grey tumbling bodies are asteroids and need two or three hits. Pale fast bodies are comets, fragile but worth more. Their tails point away from the bright disk at the center, matching the real rule. A dense debris stream orbiting a black hole is dramatic license.",
    diagram: "orbit", source: { label: "NASA / Asteroids, comets & meteors", url: "https://science.nasa.gov/solar-system/asteroids-comets-meteors/" },
    quiz: { question: "Which way does a comet's tail point?", answers: ["Always behind its motion", "Away from the light source", "Toward the nearest planet"], correct: 1, explanation: "Radiation pressure and stellar wind push the tail away from the light source, even when the comet is traveling outward." },
  },
  {
    id: "defense", name: "Deflecting an impact", category: "Physics", kicker: "Momentum, not demolition",
    summary: "A small nudge, applied early, changes where a body arrives.",
    explanation: "NASA's DART mission deliberately struck the asteroid moonlet Dimorphos in 2022 and measurably changed its orbital period. That is a kinetic impactor: it transfers momentum rather than blowing the target apart. Real planetary defense depends on finding objects years ahead, because a tiny velocity change applied early grows into a large miss distance later.",
    formula: "impulse = force x time = change in momentum",
    inGame: "The mass driver shatters rock instantly because that is more fun to fly against. Firing also pushes the Ranger backward slightly, which is the honest part: every shot is Newton's third law.",
    diagram: "thrust", source: { label: "NASA / DART mission results", url: "https://science.nasa.gov/mission/dart/" },
    quiz: { question: "What did NASA's DART mission demonstrate?", answers: ["Destroying an asteroid completely", "Changing an asteroid's orbit by impact", "Towing an asteroid with a cable"], correct: 1, explanation: "DART transferred momentum and shortened Dimorphos's orbital period. It deflected the moonlet instead of destroying it." },
  },
  {
    id: "comets", name: "Reading a threat", category: "Physics", kicker: "Closing speed decides everything",
    summary: "What matters is not distance alone, but how fast the gap shrinks.",
    explanation: "Spacecraft operators track conjunctions by computing miss distance and relative velocity. A fast body on a near-miss trajectory is far more dangerous than a slow one at the same range, because the energy of an impact grows with the square of the relative speed. Agencies move real satellites out of the way when the collision probability crosses a threshold.",
    formula: "kinetic energy = 1/2 x mass x speed squared",
    inGame: "The threat readout shows the nearest body and turns amber inside 6 rs. Comets close much faster than asteroids, so treat them differently. Avoiding a close pass scores points; so does clearing one out of the way.",
    diagram: "orbit", source: { label: "NASA / Orbital debris program", url: "https://orbitaldebris.jsc.nasa.gov/" },
    quiz: { question: "Why is relative speed so important in a collision?", answers: ["It changes the object's color", "Impact energy grows with the square of speed", "Faster objects always miss"], correct: 1, explanation: "Kinetic energy scales with the square of relative speed, so a small fast object can carry enormous energy." },
  },
  {
    id: "wormhole", name: "Wormholes", category: "Fiction", kicker: "A hypothesis, not a discovered shortcut",
    summary: "A possible mathematical bridge through spacetime.",
    explanation: "Some solutions of general relativity describe wormhole-like geometries. No traversable wormhole has been observed, and keeping one open may require exotic conditions that are not known to be physically achievable. Interstellar turns the idea into a dramatic travel device.",
    inGame: "The blue sphere teleports the ship into richer inner orbits. The transit, recharge reward and safe navigation are entirely fictional mechanics.",
    diagram: "orbit", source: { label: "NASA / Black holes and wormholes", url: "https://science.nasa.gov/universe/black-holes/" },
    quiz: { question: "Have scientists observed a traversable wormhole?", answers: ["Yes, near Saturn", "Yes, every black hole contains one", "No"], correct: 2, explanation: "Traversable wormholes remain hypothetical. The game's shortcut belongs to fiction." },
  },
  {
    id: "tesseract", name: "The tesseract", category: "Fiction", kicker: "Real mathematics, fictional room",
    summary: "A four-dimensional cube, projected into three dimensions.",
    explanation: "A mathematical tesseract is the four-dimensional analogue of a cube. It has 16 vertices, 32 edges and 8 cubic cells. The shape you see is a lower-dimensional projection. Interstellar's five-dimensional library and gravity messages are a separate fictional interpretation, not an observed structure inside a black hole.",
    formula: "4D cube: 16 vertices / 32 edges / 8 cells",
    inGame: "Crossing the horizon reveals rotating projections of 4D cubes. Sending data through the bookshelf is a fictional ending, not an escape permitted by established physics.",
    diagram: "cube", source: { label: "Wolfram MathWorld / Tesseract", url: "https://mathworld.wolfram.com/Tesseract.html" },
    quiz: { question: "What is a mathematical tesseract?", answers: ["A four-dimensional cube", "A proven black-hole interior", "A fuel-free rocket"], correct: 0, explanation: "It is the four-dimensional analogue of a cube. A 3D image shows only a projection." },
  },
];

LESSONS.push({
  id: "exploration", name: "Mapping space", category: "Physics", kicker: "How we chart where no one has been",
  summary: "A map is built one observation at a time.",
  explanation: "Space missions navigate with coordinates measured from a reference body and a reference direction, the same idea as latitude and longitude. Real deep-space probes are tracked by radio: NASA's Deep Space Network measures a spacecraft's distance from the round-trip time of a signal and its speed from the Doppler shift of that signal. Every new pass adds data, and the map of a region grows as more of it is visited and measured.",
  formula: "distance = speed of light x round-trip time / 2",
  formulaNote: "Radio ranging. A signal's round trip to a spacecraft reveals how far away it is.",
  inGame: "The star chart (M) divides the space around Gargantua into six orbital bands and eight bearings. Flying into an unexplored sector charts it permanently. The grid is a game-scale navigation aid, not a literal structure in space.",
  diagram: "orbit", source: { label: "NASA / Deep Space Network", url: "https://www.nasa.gov/communicating-with-missions/dsn/" },
  quiz: { question: "How does a ground station measure a spacecraft's distance?", answers: ["By photographing it", "From the round-trip time of a radio signal", "By estimating its brightness"], correct: 1, explanation: "Radio waves travel at the speed of light, so the delay of an echoed signal gives the distance." },
});

export const LESSON_BY_ID = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));