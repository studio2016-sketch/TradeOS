"use client";
import { useState } from "react";
import {
  Sprout,
  Check,
  ArrowRight,
  BookOpen,
  Compass,
  ShieldCheck,
} from "lucide-react";

export const studyLessons = [
  {
    id: "sources",
    title: "Follow the source",
    label: "Discover",
    icon: Compass,
    idea: "A price is an observation, not a promise. Its source and timestamp tell you what you actually know.",
    question:
      "A quote has a price but no observation time. What is the sound next step?",
    options: [
      "Treat it as current because the page refreshed",
      "Check its source and timestamp before relying on it",
      "Assume a higher score makes the quote fresh",
    ],
    answer: 1,
    explanation:
      "A dashboard refresh is not source freshness. If the observation time is missing, preserve that uncertainty rather than filling it with confidence.",
  },
  {
    id: "uncertainty",
    title: "Make room for unknowns",
    label: "Understand",
    icon: BookOpen,
    idea: "Good research separates what is observed, what is inferred, and what is still unknown. More recorded data is not automatically better evidence.",
    question:
      "TradeOS reports 117 of 120 factors observed. What does that establish?",
    options: [
      "117 factors have observations, not proof of accuracy",
      "A 97.5% chance that a trade wins",
      "Permission to trade because most checks are filled",
    ],
    answer: 0,
    explanation:
      "Coverage is a count, not a probability of success. Observed factors still need provenance, freshness and independent validation.",
  },
  {
    id: "risk",
    title: "Protect your choices",
    label: "Reflect",
    icon: ShieldCheck,
    idea: "Practicing a hypothetical plan can teach discipline without taking financial risk. Choosing not to trade is a valid outcome.",
    question:
      "Your hypothetical plan has a stop price. What should you remember?",
    options: [
      "The stop guarantees the exact loss",
      "Completing this lesson makes live trading safe",
      "Gaps, slippage and costs can make actual losses larger",
    ],
    answer: 2,
    explanation:
      "A stop is a planning input, not a loss guarantee. Study progress does not certify a strategy, predict returns or unlock live execution.",
  },
] as const;
export function studyProgress(completed: readonly string[]) {
  return studyLessons.filter((lesson) => completed.includes(lesson.id)).length;
}
export default function StudyPath({ onExplore }: { onExplore: () => void }) {
  const [active, setActive] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const lesson = studyLessons[active];
  const progress = studyProgress(completed);
  const correct = checked && choice === lesson.answer;
  function selectLesson(index: number) {
    setActive(index);
    setChoice(null);
    setChecked(false);
  }
  function check() {
    if (choice === null) return;
    setChecked(true);
    if (choice === lesson.answer)
      setCompleted((previous) =>
        previous.includes(lesson.id) ? previous : [...previous, lesson.id],
      );
  }
  return (
    <section className="studyGarden" aria-labelledby="study-title">
      <div className="studyIntro">
        <div className="studyEmblem">
          <Sprout size={27} aria-hidden="true" />
        </div>
        <div>
          <span className="eyebrow">THE LEARNING GARDEN</span>
          <h3 id="study-title">Small discoveries. Stronger foundations.</h3>
          <p>
            Build understanding at your own pace. No trades needed, no streak to
            protect.
          </p>
        </div>
        <div className="studyProgress">
          <strong>
            {progress}
            <span> / 3</span>
          </strong>
          <span>ideas practiced</span>
          <progress
            value={progress}
            max={3}
            aria-label="Ideas practiced this visit"
          />
        </div>
      </div>
      <div className="studyMap" aria-label="Choose a study chapter">
        {studyLessons.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              aria-pressed={active === index}
              onClick={() => selectLesson(index)}
            >
              <span className="studyStep">
                {completed.includes(item.id) ? (
                  <Check size={18} aria-label="Practiced" />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <span>
                <small>{item.label}</small>
                <b>{item.title}</b>
              </span>
              <Icon size={20} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div className="studyActivity">
        <div className="studyIdea">
          <span className="eyebrow">ONE IDEA TO KEEP</span>
          <h4>{lesson.title}</h4>
          <p>{lesson.idea}</p>
          <span className="studyNote">
            Practice only. Progress lasts for this visit and resets when you
            reload or leave this overview.
          </span>
        </div>
        <div className="studyQuestion">
          <fieldset>
            <legend>{lesson.question}</legend>
            {lesson.options.map((option, index) => (
              <label
                key={option}
                className={choice === index ? "selected" : ""}
              >
                <input
                  type="radio"
                  name="study-answer"
                  checked={choice === index}
                  onChange={() => {
                    setChoice(index);
                    setChecked(false);
                  }}
                />
                <span>{option}</span>
              </label>
            ))}
          </fieldset>
          <div className="studyActions">
            <button
              className="studyCheck"
              disabled={choice === null}
              onClick={check}
            >
              Check understanding
            </button>
            {correct && (
              <button
                onClick={() =>
                  active < 2 ? selectLesson(active + 1) : onExplore()
                }
              >
                {active < 2 ? "Next discovery" : "Explore the learning library"}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="studyFeedback" role="status" aria-live="polite">
            {checked && (
              <>
                <strong>
                  {correct
                    ? "That’s the distinction."
                    : "A useful place to pause."}
                </strong>
                <p>{lesson.explanation}</p>
                {!correct && (
                  <span>Try another answer. There is no penalty.</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {progress === 3 && (
        <div className="studyComplete">
          <Sprout size={22} aria-hidden="true" />
          <div>
            <strong>A thoughtful session is enough.</strong>
            <p>
              You practiced three research habits. Take a break, or explore a
              topic that made you curious.
            </p>
          </div>
          <button onClick={onExplore}>
            Explore lessons <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
      <p className="studyDisclaimer">
        Learning progress measures practice, not investment skill, financial
        readiness or future returns. It never changes TradeOS safeguards.
      </p>
    </section>
  );
}
