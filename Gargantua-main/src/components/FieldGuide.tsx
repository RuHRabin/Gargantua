import { useMemo, useState } from "react";
import { LESSONS, LESSON_BY_ID } from "../game/learning";
import type { SavedProgress } from "../game/progress";
import { Dialog } from "./Dialog";
import { LessonDiagram } from "./LessonDiagram";

export function FieldGuide({ initialId, progress, onClose, onMaster }: {
  initialId: string; progress: SavedProgress; onClose: () => void; onMaster: (id: string) => void;
}) {
  const [selected, setSelected] = useState(LESSON_BY_ID.has(initialId) ? initialId : "gargantua");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [labRadius, setLabRadius] = useState(4);
  const lesson = LESSON_BY_ID.get(selected)!;
  const mastered = progress.mastered.includes(selected);
  const answer = mastered ? lesson.quiz.correct : answers[selected];
  const correct = answer === lesson.quiz.correct;
  const filtered = useMemo(() => LESSONS.filter((entry) =>
    (category === "All" || category === entry.category)
    && `${entry.name} ${entry.kicker} ${entry.summary}`.toLowerCase().includes(query.toLowerCase())
  ), [category, query]);

  return (
    <Dialog title="The field guide" eyebrow="Gargantua / Learn the universe" onClose={onClose} wide>
      <div className="guide-layout">
        <aside className="guide-sidebar">
          <label className="guide-search"><span className="sr-only">Search science subjects</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a subject..." />
          </label>
          <div className="guide-filters" aria-label="Filter subjects">{["All", "Physics", "Objects", "Fiction"].map((item) =>
            <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)} aria-pressed={category === item}>{item}</button>
          )}</div>
          <div className="guide-subjects">
            {filtered.map((entry, index) => <button key={entry.id} className={`subject-row ${selected === entry.id ? "selected" : ""}`} onClick={() => setSelected(entry.id)} aria-current={selected === entry.id ? "true" : undefined}>
              <span className="subject-number">{String(index + 1).padStart(2, "0")}</span>
              <span><strong>{entry.name}</strong><small>{entry.category}{progress.discoveries.includes(entry.id) ? " / Observed" : ""}</small></span>
              <span className="subject-status" aria-label={progress.mastered.includes(entry.id) ? "Quiz mastered" : "Read subject"}>{progress.mastered.includes(entry.id) ? <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor"><path d="m4 10 4 4 8-9" /></svg> : "+"}</span>
            </button>)}
            {!filtered.length && <p className="empty-search">No matching subjects. Try "gravity" or "planet".</p>}
          </div>
          <div className="guide-progress"><span>{progress.mastered.length} / {LESSONS.length} mastered</span><div className="thin-progress"><span style={{ width: `${progress.mastered.length / LESSONS.length * 100}%` }} /></div><small>Read every subject. Discover them by flying.</small></div>
        </aside>
        <article className="guide-article" key={selected}>
          <div className="lesson-heading"><p className="micro-label">{lesson.category} / {lesson.kicker}</p><h3>{lesson.name}</h3><p className="lesson-summary">{lesson.summary}</p></div>
          <LessonDiagram type={lesson.diagram} clockRatio={1 / Math.sqrt(1 - 1 / labRadius)} />
          <section className="lesson-section"><h4>The idea</h4><p>{lesson.explanation}</p></section>
          {lesson.formula && <div className="lesson-equation"><span className="micro-label">A useful relationship</span><code>{lesson.formula}</code>{lesson.formulaNote && <p>{lesson.formulaNote}</p>}</div>}
          {["relativity", "power", "orbits"].includes(lesson.id) && <section className="physics-lab">
            <div className="physics-lab-heading"><h4>Try the model</h4><span>Drag to experiment</span></div>
            <label htmlFor="lab-radius">{lesson.id === "relativity" ? "Clock distance" : "Relative distance"}<strong>{labRadius.toFixed(1)} {lesson.id === "relativity" ? "rs" : "x reference radius"}</strong></label>
            <input id="lab-radius" type="range" min="1.1" max="20" step="0.1" value={labRadius} onChange={(event) => setLabRadius(Number(event.target.value))} />
            <output htmlFor="lab-radius">{lesson.id === "relativity" ? `1 local hour = ${(1 / Math.sqrt(1 - 1 / labRadius)).toFixed(2)} distant hours` : lesson.id === "power" ? `${(100 / (labRadius * labRadius)).toFixed(2)}% of reference light intensity` : `${(1 / Math.sqrt(labRadius)).toFixed(2)} x reference circular-orbit speed`}</output>
            <p>{lesson.id === "relativity" ? "An ideal stationary clock outside a non-rotating hole. As the distance grows, the ratio approaches 1." : lesson.id === "power" ? "A compact light source: double the distance and intensity falls to one quarter. An extended disk is more complex." : "A Newtonian circular-orbit model at fixed central mass. Larger orbits have lower orbital speed."}</p>
          </section>}
          <section className="lesson-section game-note"><h4>In this expedition</h4><p>{lesson.inGame}</p></section>
          <section className="knowledge-check" aria-labelledby="knowledge-question">
            <div className="knowledge-check-label"><h4>Check your understanding</h4><span>{mastered ? "100 points banked" : "+100 knowledge points"}</span></div>
            <p id="knowledge-question">{lesson.quiz.question}</p>
            <div className="quiz-options">{lesson.quiz.answers.map((option, index) => <button key={option} disabled={mastered || correct} className={`quiz-option ${answer === index ? correct ? "correct" : "incorrect" : ""}`} onClick={() => {
              setAnswers((previous) => ({ ...previous, [selected]: index }));
              if (index === lesson.quiz.correct) onMaster(selected);
            }}><span>{String.fromCharCode(65 + index)}</span>{option}{answer === index && <small>{correct ? "Correct" : "Try again"}</small>}</button>)}</div>
            {answer !== undefined && <p className={`answer-explanation ${correct ? "correct" : ""}`} role="status">{correct ? "Exactly. " : "Not quite. "}{lesson.quiz.explanation}</p>}
          </section>
          <a className="source-link" href={lesson.source.url} target="_blank" rel="noopener noreferrer">Read the source: {lesson.source.label}<span aria-hidden="true"> / External</span></a>
          <p className="science-disclaimer">Real concepts, simplified models, fictional destinations. These are clearly separated throughout the guide.</p>
        </article>
      </div>
    </Dialog>
  );
}