import { useState } from "react";
import { Dialog } from "./Dialog";
import "./howto.css";

const PAGES = [
  {
    title: "Your goal",
    lead: "Fly the Ranger around the black hole Gargantua, complete each level's objectives, and earn up to three stars.",
    items: [
      ["Objectives", "Shown top-left in flight. Finish them all to clear the level."],
      ["Stars", "One for finishing, one for taking no hits, one for beating par time."],
      ["Points", "Collect research, break debris, dodge close passes, map new sectors. Chains multiply points."],
    ],
  },
  {
    title: "Flying",
    lead: "There is no air in space. Thrust pushes you, and you keep coasting once you let go.",
    items: [
      ["Steer", "Mouse or arrow keys. On a phone, drag anywhere on the sky."],
      ["Thrust", "W, Space or left click. On a phone, hold Thrust."],
      ["Brake", "S, or hold Brake on a phone."],
      ["Autopilot", "N flies you to the selected destination."],
    ],
  },
  {
    title: "Fuel and power",
    lead: "You can never be stranded. Sunlight and the space station keep you flying.",
    items: [
      ["Solar arrays (R)", "Turn light from Gargantua's glowing disk into battery charge."],
      ["Refinery (C, or G for auto)", "Uses charge to split water into rocket propellant."],
      ["Solar sail (V)", "Rides the pressure of light itself. Needs no propellant at all."],
      ["Endurance station", "Fly into the ring to dock. It refills tanks, battery, water and hull."],
    ],
  },
  {
    title: "Dangers and discovery",
    lead: "Asteroids and comets cross your path. Break them, dodge them, and explore.",
    items: [
      ["Mass driver", "X or right click. Each shot uses a little battery charge."],
      ["Scan (B)", "Survey nearby planets and unlock field-guide entries."],
      ["Star chart (M)", "48 sectors. Fly into a blank one to chart it."],
      ["NASA live", "Real pictures and real asteroids passing Earth today."],
    ],
  },
];

export function HowToPlay({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
  const current = PAGES[page];
  const last = page === PAGES.length - 1;
  return (
    <Dialog title="How to play" eyebrow={`Flight manual / ${page + 1} of ${PAGES.length}`} onClose={onClose}>
      <div className="howto">
        <div className="howto-steps" role="tablist">
          {PAGES.map((p, i) => (
            <button key={p.title} role="tab" aria-selected={i === page} className={i === page ? "active" : i < page ? "done" : ""} onClick={() => setPage(i)}>
              <span>{String(i + 1).padStart(2, "0")}</span>{p.title}
            </button>
          ))}
        </div>
        <section className="howto-page" key={page}>
          <h3>{current.title}</h3>
          <p className="howto-lead">{current.lead}</p>
          <dl>
            {current.items.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
          </dl>
        </section>
        <div className="howto-actions">
          <button className="text-button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Back</button>
          <button className="primary-button" onClick={() => (last ? onClose() : setPage((p) => p + 1))}>
            {last ? "Start flying" : "Next"}<span aria-hidden="true">/</span>
          </button>
        </div>
      </div>
    </Dialog>
  );
}
