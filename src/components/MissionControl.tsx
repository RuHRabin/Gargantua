import { useState } from "react";
import { MISSIONS, type CampaignSnapshot } from "../game/campaign";
import { LESSON_BY_ID } from "../game/learning";
import type { SavedProgress } from "../game/progress";
import { Dialog } from "./Dialog";

export function MissionControl({ progress, campaign, onLaunch, onLearn, onClose, ready }: {
  progress: SavedProgress; campaign: CampaignSnapshot | undefined; onLaunch: (level: number) => void;
  onLearn: (id: string) => void; onClose: () => void; ready: boolean;
}) {
  const [selected, setSelected] = useState(Math.min(MISSIONS.length - 1, (campaign?.level ?? progress.unlockedLevel) - 1));
  const mission = MISSIONS[selected];
  const locked = selected + 1 > progress.unlockedLevel;
  const active = campaign?.level === selected + 1;
  return (
    <Dialog title="Your expedition" eyebrow="`Mission control / ${MISSIONS.length} chapters`" onClose={onClose} wide>
      <div className="mission-layout">
        <aside className="mission-list">
          {MISSIONS.map((entry, index) => <button key={entry.id} className={`mission-row ${selected === index ? "selected" : ""}`} onClick={() => setSelected(index)} aria-current={selected === index ? "true" : undefined}>
            <span className="mission-number">{String(index + 1).padStart(2, "0")}</span>
            <span><strong>{entry.title}</strong><small>{index + 1 > progress.unlockedLevel ? "Locked / Complete the previous chapter" : index < Math.max(progress.completedLevel, campaign?.completed ?? 0) ? "Complete / Replay available" : "Ready to explore"}</small>
              {progress.stars[index + 1] ? <span className="mission-stars" aria-label={`${progress.stars[index + 1]} of 3 stars`}>{[1, 2, 3].map((n) => <i key={n} className={n <= (progress.stars[index + 1] ?? 0) ? "lit" : ""} />)}</span> : null}</span>
            <span className="mission-row-arrow" aria-hidden="true">{index + 1 > progress.unlockedLevel ? <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor"><rect x="5" y="8" width="10" height="8" rx="1" /><path d="M7 8V5a3 3 0 0 1 6 0v3" /></svg> : "+"}</span>
          </button>)}
          <p className="mission-save-note">Unlocked chapters, discoveries and knowledge checks save on this device.</p>
          <div className="mission-personal-best"><span className="micro-label">Personal best</span><strong>{progress.bestPoints.toLocaleString()} <small>PTS</small></strong><small>{Object.values(progress.stars).reduce((sum, value) => sum + value, 0)} of {MISSIONS.length * 3} stars collected</small></div>
        </aside>
        <section className="mission-detail" key={mission.id}>
          <p className="micro-label">Level {String(selected + 1).padStart(2, "0")} / {mission.subtitle}</p>
          <h3>{mission.title}</h3>
          <p className="mission-description">{mission.description}</p>
          <h4 className="micro-label">Your objectives</h4>
          <ul className="mission-task-list">{mission.tasks.map((task) => {
            const value = active ? Math.min(task.goal, campaign.stats[task.metric]) : 0;
            const complete = value >= task.goal;
            return <li key={task.metric}><span className={`task-check ${complete ? "done" : ""}`}>{complete ? <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor"><path d="m4 10 4 4 8-9" /></svg> : ""}</span><span>{task.label}</span><small>{active ? `${Math.floor(value)} / ` : ""}{task.goal}{task.unit ?? ""}</small></li>;
          })}</ul>
          <div className="mission-subjects"><h4 className="micro-label">Ideas you will discover</h4>{mission.subjects.map((id) => <button key={id} onClick={() => onLearn(id)}>{LESSON_BY_ID.get(id)?.name}<span aria-hidden="true">+</span></button>)}</div>
          <div className="mission-launch"><span className="mission-reward">+{mission.reward.toLocaleString()} completion points</span><button className="primary-button" disabled={locked || !ready} onClick={() => onLaunch(selected + 1)}>{locked ? "Complete the previous chapter" : `Launch level ${String(selected + 1).padStart(2, "0")}`}<span aria-hidden="true">/</span></button></div>
          <p className="mission-save-note">Launching a chapter starts a new flight. The current flight score resets; your saved learning remains.</p>
        </section>
      </div>
    </Dialog>
  );
}