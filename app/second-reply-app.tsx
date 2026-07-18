"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Tone = "Warm & sincere" | "Direct & candid" | "Firm with boundaries" | "Calm & measured";
type ReplyLength = "Short" | "Medium" | "Detailed";
type ConversationStatus = "continue" | "ended";
type EndReason = "none" | "resolved" | "breakdown" | "max_turns" | "safety";
type GoalState = "progressing" | "achieved" | "blocked";
type TurnAction = "respond" | "ask" | "clarify" | "challenge" | "soften" | "set_boundary" | "accept" | "decline" | "offer_alternative" | "close" | "end";
type CounterpartEmotion = "Unsure" | "Calm" | "Angry" | "Sad" | "Guarded" | "Cold" | "Hesitant";
type CounterpartOpenness = "Unsure" | "Wants to clear things up" | "Will listen but push back" | "Hesitant and watchful" | "Tends to avoid" | "Doesn't want to continue";
type CounterpartReaction = "Unsure" | "Presses for details" | "Pushes back immediately" | "Goes quiet for a while" | "Changes the subject" | "Ends it quickly";

type MemoryForm = {
  relationship: string;
  context: string;
  counterpartWords: string;
  isApproximate: boolean;
  counterpartStyle: string;
  counterpartPhrases: string;
  conversationSamples: string;
  sampleCounterpartName: string;
  counterpartEmotion: CounterpartEmotion;
  counterpartOpenness: CounterpartOpenness;
  counterpartReaction: CounterpartReaction;
  originalReply: string;
  feelings: string;
  coreIntent: string;
  desiredOutcome: string;
  boundary: string;
  tone: Tone;
  length: ReplyLength;
};

type StarterResult = {
  primaryReply: string;
  gentleReply: string;
  firmReply: string;
  reflection: string;
  assumptions: string[];
  sampleProfile: string;
  mode: "ai" | "demo";
  notice?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "counterpart";
  text: string;
};

type ConversationResponse = {
  reply: string;
  status: ConversationStatus;
  endReason: EndReason;
  goalState: GoalState;
  goalEvidence: string;
  turnAction: TurnAction;
  mode: "ai" | "demo";
  notice?: string;
  error?: string;
};

const initialForm: MemoryForm = {
  relationship: "",
  context: "",
  counterpartWords: "",
  isApproximate: true,
  counterpartStyle: "",
  counterpartPhrases: "",
  conversationSamples: "",
  sampleCounterpartName: "",
  counterpartEmotion: "Unsure",
  counterpartOpenness: "Unsure",
  counterpartReaction: "Unsure",
  originalReply: "",
  feelings: "",
  coreIntent: "",
  desiredOutcome: "",
  boundary: "",
  tone: "Warm & sincere",
  length: "Medium",
};

const toneOptions: Tone[] = ["Warm & sincere", "Direct & candid", "Firm with boundaries", "Calm & measured"];
const lengthOptions: ReplyLength[] = ["Short", "Medium", "Detailed"];
const emotionOptions: CounterpartEmotion[] = ["Unsure", "Calm", "Angry", "Sad", "Guarded", "Cold", "Hesitant"];
const opennessOptions: CounterpartOpenness[] = ["Unsure", "Wants to clear things up", "Will listen but push back", "Hesitant and watchful", "Tends to avoid", "Doesn't want to continue"];
const reactionOptions: CounterpartReaction[] = ["Unsure", "Presses for details", "Pushes back immediately", "Goes quiet for a while", "Changes the subject", "Ends it quickly"];
// Regretful lines that surge in during the opening black screen.
// Placeholder copy for now — swap for the real phrases later.
const regretLines = ["aaaaaa", "bbbbb", "cccc", "ddd"];
const totalSteps = 11;
const maxSampleFileBytes = 200 * 1024;
const maxSampleCharacters = 16_000;

function messageId(role: ChatMessage["role"]) {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildConversationMemory(form: MemoryForm, sampleProfile: string) {
  return {
    relationship: form.relationship,
    context: form.context,
    counterpartWords: form.counterpartWords,
    isApproximate: form.isApproximate,
    counterpartStyle: form.counterpartStyle,
    counterpartPhrases: form.counterpartPhrases,
    sampleProfile,
    counterpartEmotion: form.counterpartEmotion,
    counterpartOpenness: form.counterpartOpenness,
    counterpartReaction: form.counterpartReaction,
    originalReply: form.originalReply,
    feelings: form.feelings,
    coreIntent: form.coreIntent,
    desiredOutcome: form.desiredOutcome,
    boundary: form.boundary,
    tone: form.tone,
    length: form.length,
  };
}

export function SecondReplyApp() {
  const [view, setView] = useState<"intro" | "questions" | "chat">("intro");
  const [introPhase, setIntroPhase] = useState<"regret" | "reveal">("regret");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<MemoryForm>(initialForm);
  const [starter, setStarter] = useState<StarterResult | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [chatMode, setChatMode] = useState<"ai" | "demo" | null>(null);
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>("continue");
  const [endReason, setEndReason] = useState<EndReason>("none");
  const [chatNotice, setChatNotice] = useState("");
  const [sampleFileName, setSampleFileName] = useState("");
  const [sampleImportNotice, setSampleImportNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const progress = Math.round(((step + 1) / totalSteps) * 100);

  useEffect(() => {
    if (view === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, loading, view]);

  useEffect(() => {
    if (view === "intro" && introPhase === "regret") {
      const timer = setTimeout(() => setIntroPhase("reveal"), 4000);
      return () => clearTimeout(timer);
    }
  }, [view, introPhase]);

  const canContinue = useMemo(() => {
    switch (step) {
      case 0:
        return form.relationship.trim().length > 0;
      case 1:
        return form.context.trim().length > 0;
      case 2:
        return form.counterpartWords.trim().length > 0;
      case 3:
        return form.counterpartStyle.trim().length > 0;
      case 4:
        return true;
      case 5:
        return true;
      case 6:
        return true;
      case 7:
        return form.feelings.trim().length > 0;
      case 8:
        return form.coreIntent.trim().length > 0;
      case 9:
        return form.desiredOutcome.trim().length > 0;
      default:
        return true;
    }
  }, [form, step]);

  function update<K extends keyof MemoryForm>(key: K, value: MemoryForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function nextStep() {
    if (!canContinue) {
      setError("Write down a little of what you remember before moving on.");
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, totalSteps - 1));
  }

  function previousStep() {
    setError("");
    if (step === 0) {
      setView("intro");
      return;
    }
    setStep((current) => current - 1);
  }

  async function importConversationSample(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > maxSampleFileBytes) {
      setSampleImportNotice("The file is larger than 200 KB. Trim it down or keep only a representative excerpt.");
      event.target.value = "";
      return;
    }

    try {
      const text = (await file.text()).trim();
      if (!text) {
        setSampleImportNotice("This file has no readable text.");
        event.target.value = "";
        return;
      }

      const clipped = text.slice(0, maxSampleCharacters);
      update("conversationSamples", clipped);
      setSampleFileName(file.name);
      setSampleImportNotice(
        text.length > maxSampleCharacters
          ? `Imported ${file.name}. To protect privacy and keep it short, only the first ${maxSampleCharacters.toLocaleString()} characters were kept.`
          : `Imported ${file.name} — ${clipped.length.toLocaleString()} characters.`,
      );
    } catch {
      setSampleImportNotice("Couldn't read this file. Try a UTF-8 text file, or paste the chat log directly.");
    } finally {
      event.target.value = "";
    }
  }

  function clearConversationSample() {
    update("conversationSamples", "");
    update("sampleCounterpartName", "");
    setSampleFileName("");
    setSampleImportNotice("Removed the chat reference sample.");
  }

  async function beginConversation() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as StarterResult & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Couldn't prepare this conversation right now. Please try again later.");
      }
      setStarter(payload);
      setMessages([]);
      setDraft("");
      setChatMode(null);
      setConversationStatus("continue");
      setEndReason("none");
      setChatNotice("");
      setView("chat");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't prepare this conversation right now. Please try again later.");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || loading || conversationStatus !== "continue") return;

    const userMessage: ChatMessage = { id: messageId("user"), role: "user", text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memory: buildConversationMemory(form, starter.sampleProfile),
          messages: nextMessages.map(({ role, text: messageText }) => ({ role, text: messageText })),
        }),
      });
      const payload = (await response.json()) as ConversationResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Couldn't generate the other person's reply right now. Please try again later.");
      }
      setMessages((current) => [
        ...current,
        { id: messageId("counterpart"), role: "counterpart", text: payload.reply },
      ]);
      setChatMode(payload.mode);
      setConversationStatus(payload.status);
      setEndReason(payload.endReason);
      setChatNotice(payload.notice ?? "");
      if (payload.status !== "continue") setDraft("");
    } catch (caught) {
      setMessages((current) => current.filter((message) => message.id !== userMessage.id));
      setDraft(text);
      setError(caught instanceof Error ? caught.message : "Couldn't generate the other person's reply right now. Please try again later.");
    } finally {
      setLoading(false);
    }
  }

  function restartConversation() {
    setMessages([]);
    setDraft("");
    setChatMode(null);
    setConversationStatus("continue");
    setEndReason("none");
    setChatNotice("");
    setError("");
  }

  function reset() {
    setForm(initialForm);
    setStarter(null);
    setMessages([]);
    setDraft("");
    setChatMode(null);
    setConversationStatus("continue");
    setEndReason("none");
    setChatNotice("");
    setSampleFileName("");
    setSampleImportNotice("");
    setStep(0);
    setView("intro");
    setError("");
  }

  if (view === "intro") {
    return (
      <main className={`cinematic-intro ${introPhase}`}>
        <div className="regret-layer" aria-hidden={introPhase !== "regret"}>
          <RegretWall active={introPhase === "regret"} />
        </div>
        <div className="reveal-layer">
          <h1 className="reveal-headline">now you have a second chance</h1>
          <button className="primary-button reveal-button" onClick={() => setView("questions")}>
            Continue <span aria-hidden="true">→</span>
          </button>
        </div>
      </main>
    );
  }

  if (view === "chat" && starter) {
    const starterChoices = [
      { label: "Start from the core", text: starter.primaryReply },
      { label: "A gentler version", text: starter.gentleReply },
      { label: "State the boundary first", text: starter.firmReply },
    ];
    const counterpartInitial = form.relationship.trim().charAt(0).toUpperCase() || "•";
    const isDemo = starter.mode === "demo" || chatMode === "demo";
    const modeNotice = chatNotice || starter.notice || (isDemo ? "This includes local simulation. Once a valid AI key is configured, AI replies are used first." : "");
    const statusLabel = conversationStatus === "continue" ? "Practicing" : "This conversation has ended";
    const terminalCopy = endReason === "resolved"
      ? { kind: "success", eyebrow: "SUCCESS ENDING", title: "The outcome you hoped for was reached.", body: "The other person's response met the key conditions of your goal for this conversation. This is only one simulated possibility, but this practice path has come to a complete close." }
      : endReason === "breakdown"
        ? { kind: "breakdown", eyebrow: "BAD ENDING · Broke down midway", title: "This conversation broke down partway through.", body: "The other person ended it, refused, or lost any room to move forward, and the outcome you hoped for wasn't reached. You can try again with a different opening." }
        : endReason === "max_turns"
          ? { kind: "max-turns", eyebrow: "BAD ENDING · Out of turns", title: "12 turns are up, and the goal wasn't reached.", body: "This path didn't reach the outcome you hoped for within the practice limit. You can practice again, or adjust the desired outcome and the other person's state and retry." }
          : { kind: "safety", eyebrow: "SAFETY FIRST · Protect yourself", title: "This simulation has stopped.", body: "If there is an imminent danger in real life, please leave the situation and contact someone you trust or your local emergency services." };

    return (
      <main className="app-shell chat-page">
        <header className="site-header compact-header">
          <button className="brand brand-button" onClick={reset} aria-label="Clear and return home">
            <span className="brand-mark" aria-hidden="true">Ⅱ</span>
            <span>Second Reply</span>
          </button>
          <div className="chat-header-actions">
            <button className="text-button" onClick={() => { setView("questions"); setStep(0); }}>Edit memory</button>
            <button className="danger-text" onClick={reset}>End practice</button>
          </div>
        </header>

        <section className="chat-stage">
          <div className="chat-window">
            <header className="chat-person-header">
              <span className="chat-avatar" aria-hidden="true">{counterpartInitial}</span>
              <div>
                <strong>{form.relationship}</strong>
                <span className={conversationStatus === "continue" ? "" : "conversation-stopped"}><i /> {statusLabel}</span>
              </div>
              <span className="simulation-badge">Possible reply</span>
            </header>

            <div className="chat-disclaimer" role="note">
              The AI only simulates one possibility based on your memory and any optional reference sample. It is not how the real person would actually respond.
            </div>

            <div className="chat-scroll" aria-live="polite">
              {messages.length === 0 ? (
                <section className="conversation-opening">
                  <p className="eyebrow">YOUR TURN</p>
                  <h1>This time, what do you want to say first?</h1>
                  <p>{starter.reflection} You can write it entirely yourself, or pick a draft first and edit it.</p>
                  <div className="starter-choices">
                    {starterChoices.map((choice) => (
                      <button key={choice.label} onClick={() => setDraft(choice.text)}>
                        <span>{choice.label}</span>
                        <p>{choice.text}</p>
                      </button>
                    ))}
                  </div>
                </section>
              ) : (
                <div className="message-list">
                  <div className="scene-marker"><span>Back to that moment</span></div>
                  {messages.map((message) => (
                    <article className={`message-row ${message.role}`} key={message.id}>
                      {message.role === "counterpart" && <span className="message-avatar" aria-hidden="true">{counterpartInitial}</span>}
                      <div>
                        <span className="message-author">{message.role === "user" ? "You" : form.relationship}</span>
                        <p>{message.text}</p>
                      </div>
                    </article>
                  ))}
                  {loading && (
                    <article className="message-row counterpart" aria-label="The other person is replying">
                      <span className="message-avatar" aria-hidden="true">{counterpartInitial}</span>
                      <div>
                        <span className="message-author">{form.relationship}</span>
                        <p className="typing-indicator"><i /><i /><i /></p>
                      </div>
                    </article>
                  )}
                  {conversationStatus !== "continue" && (
                    <section className={`conversation-end-card ${terminalCopy.kind}`} role="status">
                      <p className="eyebrow">{terminalCopy.eyebrow}</p>
                      <h2>{terminalCopy.title}</h2>
                      <p>{terminalCopy.body}</p>
                      <small>The end of a simulation reflects only this one practice path, not how the real person would ultimately respond.</small>
                    </section>
                  )}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {conversationStatus === "continue" ? (
              <form className="chat-composer" onSubmit={sendMessage}>
                {modeNotice && <div className="demo-strip">{modeNotice}</div>}
                <label htmlFor="chat-draft">What you want to say</label>
                <div className="composer-box">
                  <textarea
                    id="chat-draft"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    placeholder="Write what you really want to say this time…"
                    maxLength={1200}
                    rows={3}
                  />
                  <div className="composer-footer">
                    <span>{draft.length} / 1200 · Shift + Enter for a new line</span>
                    <button disabled={loading || !draft.trim()}>
                      {loading ? "Waiting for their reply…" : "Say it to them"} <span aria-hidden="true">↑</span>
                    </button>
                  </div>
                </div>
                {error && <p className="error-message" role="alert">{error}</p>}
              </form>
            ) : (
              <section className="chat-terminal-actions" aria-label="Actions after practice ends">
                {modeNotice && <div className="demo-strip">{modeNotice}</div>}
                <div>
                  <button type="button" className="secondary-button" onClick={restartConversation}>Practice again with a different wording</button>
                  <button type="button" className="primary-button" onClick={() => { setView("questions"); setStep(0); }}>Edit memory</button>
                </div>
              </section>
            )}
          </div>

          <aside className="scene-sidebar">
            <p className="eyebrow">THE MEMORY</p>
            <dl>
              <div><dt>Who you&rsquo;re facing</dt><dd>{form.relationship}</dd></div>
              <div><dt>What happened then</dt><dd>{form.context}</dd></div>
              <div><dt>How they speak</dt><dd>{form.counterpartStyle}</dd></div>
              <div><dt>Their state at the time</dt><dd>{form.counterpartEmotion} · {form.counterpartOpenness}</dd></div>
              {form.conversationSamples && <div><dt>Chat reference sample</dt><dd>Imported {form.conversationSamples.length.toLocaleString()} characters</dd></div>}
              <div><dt>What you want this time</dt><dd>{form.desiredOutcome}</dd></div>
              {form.boundary && <div><dt>Your boundary</dt><dd>{form.boundary}</dd></div>}
            </dl>
            {starter.assumptions.length > 0 && (
              <p className="sidebar-note">What the other person said is treated as &ldquo;the gist as you remember it,&rdquo; not word-for-word quotes.</p>
            )}
            <p className="turn-count">Practiced {messages.filter((message) => message.role === "user").length} / 12 turns</p>
          </aside>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell question-shell">
      <header className="site-header compact-header">
        <button className="brand brand-button" onClick={() => setView("intro")} aria-label="Back to home">
          <span className="brand-mark" aria-hidden="true">Ⅱ</span>
          <span>Second Reply</span>
        </button>
        <span className="step-counter">{String(step + 1).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}</span>
      </header>

      <div className="progress-track" aria-label={`Questionnaire progress ${progress}%`}>
        <div style={{ width: `${progress}%` }} />
      </div>

      <section className="question-layout">
        <aside className="question-aside">
          <p className="eyebrow">REMEMBER</p>
          <p>You don&rsquo;t have to spell everything out. Writing down what you actually remember is enough.</p>
          <div className="memory-index" aria-hidden="true">
            {Array.from({ length: totalSteps }, (_, index) => (
              <span key={index} className={index === step ? "current" : index < step ? "done" : ""} />
            ))}
          </div>
        </aside>

        <div className="question-card">
          {renderQuestion(step, form, update, {
            importConversationSample,
            clearConversationSample,
            sampleFileName,
            sampleImportNotice,
          })}
          {error && <p className="error-message" role="alert">{error}</p>}

          <div className="question-actions">
            <button className="secondary-button" onClick={previousStep}>← Back</button>
            {step < totalSteps - 1 ? (
              <button className="primary-button" onClick={nextStep} disabled={!canContinue}>Continue <span aria-hidden="true">→</span></button>
            ) : (
              <button className="primary-button generate-button" onClick={beginConversation} disabled={loading}>
                {loading ? "Preparing this conversation…" : "Enter this conversation"}
              </button>
            )}
          </div>
        </div>
      </section>

      <footer className="question-footer">
        <span>Your answers are only sent once you enter practice</span>
        <button className="danger-text" onClick={reset}>Clear</button>
      </footer>
    </main>
  );
}

function renderQuestion(
  step: number,
  form: MemoryForm,
  update: <K extends keyof MemoryForm>(key: K, value: MemoryForm[K]) => void,
  sampleControls: {
    importConversationSample: (event: ChangeEvent<HTMLInputElement>) => void;
    clearConversationSample: () => void;
    sampleFileName: string;
    sampleImportNotice: string;
  },
) {
  switch (step) {
    case 0:
      return (
        <QuestionFrame number="01" title="Who is the other person?" hint="Write a name to call them and your relationship. You don't need to use a real name.">
          <label className="field-label" htmlFor="relationship">What you call them, or your relationship</label>
          <input id="relationship" className="large-input" autoFocus value={form.relationship} onChange={(event) => update("relationship", event.target.value)} placeholder="e.g. Lin, a former coworker" maxLength={120} />
        </QuestionFrame>
      );
    case 1:
      return (
        <QuestionFrame number="02" title="What happened in that moment?" hint="Write only what you're sure happened. You don't need to explain who was right or wrong.">
          <label className="field-label" htmlFor="context">The situation</label>
          <textarea id="context" className="large-textarea" autoFocus value={form.context} onChange={(event) => update("context", event.target.value)} placeholder="e.g. After work, we argued about whether to keep working together…" maxLength={1600} />
        </QuestionFrame>
      );
    case 2:
      return (
        <QuestionFrame number="03" title="What did they say at the time?" hint="It's fine if you don't remember the exact words — the gist is enough.">
          <label className="field-label" htmlFor="counterpartWords">What you remember them saying</label>
          <textarea id="counterpartWords" className="large-textarea" autoFocus value={form.counterpartWords} onChange={(event) => update("counterpartWords", event.target.value)} placeholder="e.g. They felt I wasn't taking this seriously…" maxLength={1600} />
          <label className="check-row">
            <input type="checkbox" checked={form.isApproximate} onChange={(event) => update("isApproximate", event.target.checked)} />
            <span>This is the gist, not necessarily their exact words</span>
          </label>
        </QuestionFrame>
      );
    case 3:
      return (
        <QuestionFrame number="04" title="How does the other person usually speak?" hint="Describe how they actually express themselves, not how you wish they'd respond. If you can't recall, write &ldquo;Unsure.&rdquo;">
          <label className="field-label" htmlFor="counterpartStyle">How they speak</label>
          <textarea id="counterpartStyle" className="large-textarea" autoFocus value={form.counterpartStyle} onChange={(event) => update("counterpartStyle", event.target.value)} placeholder="e.g. Few words, short sentences; dislikes naming feelings directly; asks pointed questions when angry, sometimes just replies 'fine.'" maxLength={1400} />
          <label className="field-label second-label" htmlFor="counterpartPhrases">Words or catchphrases they often use (optional)</label>
          <textarea id="counterpartPhrases" className="medium-textarea" value={form.counterpartPhrases} onChange={(event) => update("counterpartPhrases", event.target.value)} placeholder="e.g. They often say 'forget it,' 'you go first,' 'I don't know'…" maxLength={800} />
        </QuestionFrame>
      );
    case 4:
      return (
        <QuestionFrame number="05" title="Import a chat reference sample (optional)" hint="Paste a chat log or import a text file, and the AI will distill the other person's ways of expressing and reacting when you enter practice. No sample? Just continue.">
          <label className="field-label" htmlFor="sampleCounterpartName">The other person&rsquo;s display name in the chat log (optional)</label>
          <input id="sampleCounterpartName" className="large-input compact-input" value={form.sampleCounterpartName} onChange={(event) => update("sampleCounterpartName", event.target.value)} placeholder="e.g. Lin; used to tell the two sides apart" maxLength={120} />
          <label className="field-label second-label" htmlFor="conversationSamples">Chat log</label>
          <textarea id="conversationSamples" className="large-textarea sample-textarea" value={form.conversationSamples} onChange={(event) => update("conversationSamples", event.target.value.slice(0, maxSampleCharacters))} placeholder={"e.g.\nMe: Are you free Saturday?\nLin: Might have to work, I'll let you know later."} maxLength={maxSampleCharacters} />
          <div className="sample-import-row">
            <label className="file-picker" htmlFor="conversationSampleFile">Import a text file</label>
            <input id="conversationSampleFile" className="visually-hidden" type="file" accept=".txt,.md,.json,.csv,.log,text/plain,text/csv,application/json" onChange={sampleControls.importConversationSample} />
            <span>Supports TXT, MD, JSON, CSV, LOG, up to 200 KB</span>
            {form.conversationSamples && <button type="button" className="sample-clear" onClick={sampleControls.clearConversationSample}>Remove sample</button>}
          </div>
          {(sampleControls.sampleImportNotice || sampleControls.sampleFileName) && (
            <p className="sample-status" role="status">{sampleControls.sampleImportNotice || `Imported ${sampleControls.sampleFileName}`}</p>
          )}
          <p className="sample-privacy-note">Please remove real names, phone numbers, addresses, account numbers, ID documents, and any other unnecessary private details first. The raw sample is not written to any database, and is not re-sent with every turn.</p>
        </QuestionFrame>
      );
    case 5:
      return (
        <QuestionFrame number="06" title="In that moment, what state was the other person in?" hint="This is your read from memory. It won't be treated as their definite inner state.">
          <fieldset className="choice-fieldset">
            <legend>The emotion they showed</legend>
            <div className="choice-grid persona-grid">
              {emotionOptions.map((emotion) => (
                <button type="button" key={emotion} className={form.counterpartEmotion === emotion ? "selected" : ""} onClick={() => update("counterpartEmotion", emotion)} aria-pressed={form.counterpartEmotion === emotion}>{emotion}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="choice-fieldset persona-fieldset">
            <legend>Whether they&rsquo;re willing to keep talking</legend>
            <div className="choice-grid persona-grid">
              {opennessOptions.map((openness) => (
                <button type="button" key={openness} className={form.counterpartOpenness === openness ? "selected" : ""} onClick={() => update("counterpartOpenness", openness)} aria-pressed={form.counterpartOpenness === openness}>{openness}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="choice-fieldset persona-fieldset">
            <legend>When conflict arises, they usually</legend>
            <div className="choice-grid persona-grid">
              {reactionOptions.map((reaction) => (
                <button type="button" key={reaction} className={form.counterpartReaction === reaction ? "selected" : ""} onClick={() => update("counterpartReaction", reaction)} aria-pressed={form.counterpartReaction === reaction}>{reaction}</button>
              ))}
            </div>
          </fieldset>
        </QuestionFrame>
      );
    case 6:
      return (
        <QuestionFrame number="07" title="How did you answer at the time?" hint="If you fell silent, write &ldquo;I didn't answer.&rdquo; You can also skip this one.">
          <label className="field-label" htmlFor="originalReply">Your answer at the time (optional)</label>
          <textarea id="originalReply" className="large-textarea" autoFocus value={form.originalReply} onChange={(event) => update("originalReply", event.target.value)} placeholder="e.g. I only said 'whatever you want,' then left." maxLength={1200} />
        </QuestionFrame>
      );
    case 7:
      return (
        <QuestionFrame number="08" title="At the time, what kept you from speaking?" hint="It can be a feeling, a worry, or a thought you couldn't put together in time.">
          <label className="field-label" htmlFor="feelings">You, back then</label>
          <textarea id="feelings" className="large-textarea" autoFocus value={form.feelings} onChange={(event) => update("feelings", event.target.value)} placeholder="e.g. I felt wronged, and was afraid that speaking up would make things worse…" maxLength={1600} />
        </QuestionFrame>
      );
    case 8:
      return (
        <QuestionFrame number="09" title="If you had another chance, what would you most want them to understand?" hint="Don't worry yet about how to say it — just the core meaning.">
          <label className="field-label" htmlFor="coreIntent">What you really want to express</label>
          <textarea id="coreIntent" className="large-textarea" autoFocus value={form.coreIntent} onChange={(event) => update("coreIntent", event.target.value)} placeholder="e.g. It's not that I don't care. I'm willing to continue, but we need to rework how the work is split." maxLength={1600} />
        </QuestionFrame>
      );
    case 9:
      return (
        <QuestionFrame number="10" title="What do you hope this conversation brings?" hint="The outcome isn't fully in your control, but you can be clear about your wish and your boundary.">
          <label className="field-label" htmlFor="desiredOutcome">The change you hope for</label>
          <textarea id="desiredOutcome" className="medium-textarea" autoFocus value={form.desiredOutcome} onChange={(event) => update("desiredOutcome", event.target.value)} placeholder="e.g. Keep working together, but with a clear split of responsibilities." maxLength={1000} />
          <label className="field-label second-label" htmlFor="boundary">A boundary you can&rsquo;t give up (optional)</label>
          <textarea id="boundary" className="medium-textarea" value={form.boundary} onChange={(event) => update("boundary", event.target.value)} placeholder="e.g. I can't keep carrying most of the work alone." maxLength={1000} />
        </QuestionFrame>
      );
    default:
      return (
        <QuestionFrame number="11" title="This time, how do you want to say it?" hint="These options only shape the opening drafts. Once you enter the conversation, every line is yours to decide.">
          <fieldset className="choice-fieldset">
            <legend>Your tone</legend>
            <div className="choice-grid tone-grid">
              {toneOptions.map((tone) => (
                <button type="button" key={tone} className={form.tone === tone ? "selected" : ""} onClick={() => update("tone", tone)} aria-pressed={form.tone === tone}>{tone}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="choice-fieldset length-fieldset">
            <legend>Opening length</legend>
            <div className="choice-grid length-grid">
              {lengthOptions.map((length) => (
                <button type="button" key={length} className={form.length === length ? "selected" : ""} onClick={() => update("length", length)} aria-pressed={form.length === length}>{length}</button>
              ))}
            </div>
          </fieldset>
        </QuestionFrame>
      );
  }
}

function QuestionFrame({ number, title, hint, children }: { number: string; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="question-content">
      <span className="question-number">{number}</span>
      <h1>{title}</h1>
      <p className="question-hint">{hint}</p>
      <div className="question-fields">{children}</div>
    </div>
  );
}

const wallRows = 6;

type RegretFlash = { sequence: number; text: string; top: string; left: string };

// One regret phrase placed on a brick-wall cell. Odd rows are indented so the
// rows stagger like bricks; every call reshuffles position and phrase.
function makeFlash(sequence: number): RegretFlash {
  const row = Math.floor(Math.random() * wallRows);
  const indent = row % 2 === 0 ? 8 : 22;
  return {
    sequence,
    text: regretLines[Math.floor(Math.random() * regretLines.length)],
    top: `${6 + row * 15}%`,
    left: `${indent + Math.floor(Math.random() * 16)}%`,
  };
}

function RegretWall({ active }: { active: boolean }) {
  // Start empty so server and client render the same markup; the random
  // placements are only generated on the client after mount to avoid a
  // hydration mismatch (Math.random() differs between server and client).
  const [flashes, setFlashes] = useState<RegretFlash[]>([]);

  useEffect(() => {
    if (!active) return;
    let sequence = 0;
    const timer = setInterval(() => {
      setFlashes((current) => {
        const next = [...current];
        if (next.length < 6) next.push(makeFlash(sequence));
        else next[sequence % next.length] = makeFlash(sequence);
        sequence += 1;
        return next;
      });
    }, 250);
    return () => clearInterval(timer);
  }, [active]);

  return (
    <div className="regret-wall" aria-hidden="true">
      {flashes.map((flash) => (
        <span key={flash.sequence} className="regret-flash" style={{ top: flash.top, left: flash.left }}>
          {flash.text}
        </span>
      ))}
    </div>
  );
}
