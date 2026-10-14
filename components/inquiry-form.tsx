"use client";

import { FormEvent, useState } from "react";

type SpaceOption = { id: string; name: string };
type FormKind = "event" | "stay" | "lease" | "contact";

const submitCopy: Record<FormKind, string> = {
  event: "Send event inquiry",
  stay: "Request a group block",
  lease: "Ask about a suite",
  contact: "Send a message",
};

export function InquiryForm({
  kind,
  spaces = [],
  stayOptions = [],
  suiteOptions = [],
  initialSpaceIds = [],
  title,
  intro,
}: {
  kind: FormKind;
  spaces?: SpaceOption[];
  stayOptions?: string[];
  suiteOptions?: string[];
  initialSpaceIds?: string[];
  title: string;
  intro: string;
}) {
  const [selected, setSelected] = useState(initialSpaceIds);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  function toggleSpace(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <form className="inquiry-form" onSubmit={handleSubmit}>
      <div className="form-heading"><span className="eyebrow">Tell us a little</span><h2>{title}</h2><p>{intro}</p></div>
      <div className="form-grid">
        <label>Your name <input autoComplete="name" name="name" placeholder="Full name" required /></label>
        <label>Email address <input autoComplete="email" name="email" placeholder="you@example.com" required type="email" /></label>
        {(kind === "event" || kind === "stay" || kind === "lease") ? (
          <label>Organization <input autoComplete="organization" name="organization" placeholder="Company or group" /></label>
        ) : null}
        {kind === "event" ? (
          <>
            <label>Preferred date <input name="event-date" type="date" /></label>
            <label>Approximate guest count <input min="1" name="guest-count" placeholder="e.g. 80" type="number" /></label>
            {spaces.length ? (
              <fieldset className="space-options">
                <legend>Spaces you’re considering</legend>
                <div>
                  {spaces.map((space) => (
                    <label className="checkbox-option" key={space.id}>
                      <input
                        checked={selected.includes(space.id)}
                        onChange={() => toggleSpace(space.id)}
                        type="checkbox"
                        value={space.id}
                      />
                      {space.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
          </>
        ) : null}
        {kind === "stay" ? (
          <>
            <label>Preferred stay style
              <select defaultValue="" name="stay-style" required>
                <option disabled value="">Choose a style</option>
                {stayOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label>Check-in <input name="check-in" type="date" /></label>
            <label>Check-out <input name="check-out" type="date" /></label>
            <label>Rooms needed <input min="1" name="rooms-needed" placeholder="e.g. 12" type="number" /></label>
          </>
        ) : null}
        {kind === "lease" ? (
          <>
            <label>Suite of interest
              <select defaultValue="" name="suite">
                <option value="">Not sure yet</option>
                {suiteOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label>Move-in timing <input name="move-in" placeholder="e.g. Spring 2027" /></label>
          </>
        ) : null}
        <label className="form-full">What should we know? <textarea name="message" placeholder="Share any details that would help us get started." rows={4} /></label>
      </div>
      <div className="form-submit-row">
        <button className="button button-dark" type="submit">{submitCopy[kind]} <span aria-hidden="true">↗</span></button>
        <span className="form-privacy">No obligation. Your details stay with this preview and are not transmitted.</span>
      </div>
      {submitted ? (
        <p aria-live="polite" className="form-success">
          Thanks for getting in touch. This preview doesn’t transmit submissions yet; connect the form to the venue inbox before launch.
        </p>
      ) : null}
    </form>
  );
}
