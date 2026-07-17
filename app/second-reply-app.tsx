"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Tone = "温和真诚" | "直接坦率" | "坚定有边界" | "平静克制";
type ReplyLength = "简短" | "适中" | "详细";
type CounterpartEmotion = "不确定" | "平静" | "生气" | "难过" | "防备" | "冷淡" | "犹豫";
type CounterpartOpenness = "不确定" | "想说清楚" | "愿意听但会反驳" | "犹豫观望" | "倾向回避" | "不想继续";
type CounterpartReaction = "不确定" | "追问细节" | "马上反驳" | "沉默很久" | "转移话题" | "很快结束";

type MemoryForm = {
  relationship: string;
  context: string;
  counterpartWords: string;
  isApproximate: boolean;
  counterpartStyle: string;
  counterpartPhrases: string;
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
  counterpartEmotion: "不确定",
  counterpartOpenness: "不确定",
  counterpartReaction: "不确定",
  originalReply: "",
  feelings: "",
  coreIntent: "",
  desiredOutcome: "",
  boundary: "",
  tone: "温和真诚",
  length: "适中",
};

const toneOptions: Tone[] = ["温和真诚", "直接坦率", "坚定有边界", "平静克制"];
const lengthOptions: ReplyLength[] = ["简短", "适中", "详细"];
const emotionOptions: CounterpartEmotion[] = ["不确定", "平静", "生气", "难过", "防备", "冷淡", "犹豫"];
const opennessOptions: CounterpartOpenness[] = ["不确定", "想说清楚", "愿意听但会反驳", "犹豫观望", "倾向回避", "不想继续"];
const reactionOptions: CounterpartReaction[] = ["不确定", "追问细节", "马上反驳", "沉默很久", "转移话题", "很快结束"];
const totalSteps = 10;

function messageId(role: ChatMessage["role"]) {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function SecondReplyApp() {
  const [view, setView] = useState<"intro" | "questions" | "chat">("intro");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<MemoryForm>(initialForm);
  const [starter, setStarter] = useState<StarterResult | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [chatMode, setChatMode] = useState<"ai" | "demo" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const progress = Math.round(((step + 1) / totalSteps) * 100);

  useEffect(() => {
    if (view === "chat") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, loading, view]);

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
        return form.feelings.trim().length > 0;
      case 7:
        return form.coreIntent.trim().length > 0;
      case 8:
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
      setError("先写下一点你记得的内容，再继续。");
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
        throw new Error(payload.error || "暂时没能准备这段对话，请稍后再试。");
      }
      setStarter(payload);
      setMessages([]);
      setDraft("");
      setChatMode(null);
      setView("chat");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "暂时没能准备这段对话，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;

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
          memory: form,
          messages: nextMessages.map(({ role, text: messageText }) => ({ role, text: messageText })),
        }),
      });
      const payload = (await response.json()) as ConversationResponse;
      if (!response.ok) {
        throw new Error(payload.error || "暂时没能生成她的回复，请稍后再试。");
      }
      setMessages((current) => [
        ...current,
        { id: messageId("counterpart"), role: "counterpart", text: payload.reply },
      ]);
      setChatMode(payload.mode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "暂时没能生成她的回复，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setForm(initialForm);
    setStarter(null);
    setMessages([]);
    setDraft("");
    setChatMode(null);
    setStep(0);
    setView("intro");
    setError("");
  }

  if (view === "intro") {
    return (
      <main className="intro-shell">
        <header className="site-header">
          <a className="brand" href="#top" aria-label="第二次回答首页">
            <span className="brand-mark" aria-hidden="true">Ⅱ</span>
            <span>第二次回答</span>
          </a>
          <span className="privacy-chip"><span aria-hidden="true">●</span> 本次内容不会保存在浏览器</span>
        </header>

        <section className="intro" id="top">
          <div className="intro-copy">
            <p className="eyebrow">REPLAY THE MOMENT · 重新选择</p>
            <h1>如果可以回到<br />那段对话里。</h1>
            <p className="intro-lede">
              你重新选择要说的话，AI 模拟她的一种可能回应。不是改写过去，而是把这场对话继续下去。
            </p>
            <button className="primary-button intro-button" onClick={() => setView("questions")}>
              回到那一刻 <span aria-hidden="true">→</span>
            </button>
            <p className="microcopy">大约 6 分钟 · 10 个问题 · 连续对话练习</p>
          </div>

          <div className="moment-card" aria-label="产品流程预览">
            <span className="moment-number">02</span>
            <div className="moment-line" />
            <p>“这次由你先说，<br />然后听见一种可能。”</p>
            <div className="moment-steps" aria-hidden="true">
              <span className="active">记起</span>
              <i />
              <span>你说</span>
              <i />
              <span>她回应</span>
            </div>
          </div>
        </section>

        <footer className="intro-footer">
          <span>你的记忆属于你</span>
          <span>模拟回复不代表她真实的想法</span>
        </footer>
      </main>
    );
  }

  if (view === "chat" && starter) {
    const starterChoices = [
      { label: "从核心意思开始", text: starter.primaryReply },
      { label: "换一种温和说法", text: starter.gentleReply },
      { label: "先把边界说清楚", text: starter.firmReply },
    ];
    const isDemo = starter.mode === "demo" || chatMode === "demo";

    return (
      <main className="app-shell chat-page">
        <header className="site-header compact-header">
          <button className="brand brand-button" onClick={reset} aria-label="清空并返回首页">
            <span className="brand-mark" aria-hidden="true">Ⅱ</span>
            <span>第二次回答</span>
          </button>
          <div className="chat-header-actions">
            <button className="text-button" onClick={() => { setView("questions"); setStep(0); }}>修改记忆</button>
            <button className="danger-text" onClick={reset}>结束练习</button>
          </div>
        </header>

        <section className="chat-stage">
          <div className="chat-window">
            <header className="chat-person-header">
              <span className="chat-avatar" aria-hidden="true">她</span>
              <div>
                <strong>{form.relationship}</strong>
                <span><i /> 对话练习中</span>
              </div>
              <span className="simulation-badge">可能回复</span>
            </header>

            <div className="chat-disclaimer" role="note">
              AI 只根据你的回忆模拟一种可能，不代表她真实会这样说。
            </div>

            <div className="chat-scroll" aria-live="polite">
              {messages.length === 0 ? (
                <section className="conversation-opening">
                  <p className="eyebrow">YOUR TURN · 轮到你</p>
                  <h1>这一次，你想先说什么？</h1>
                  <p>{starter.reflection} 你可以完全自己写，也可以先选择一段草稿再修改。</p>
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
                  <div className="scene-marker"><span>重新回到那一刻</span></div>
                  {messages.map((message) => (
                    <article className={`message-row ${message.role}`} key={message.id}>
                      {message.role === "counterpart" && <span className="message-avatar" aria-hidden="true">她</span>}
                      <div>
                        <span className="message-author">{message.role === "user" ? "你" : form.relationship}</span>
                        <p>{message.text}</p>
                      </div>
                    </article>
                  ))}
                  {loading && (
                    <article className="message-row counterpart" aria-label="她正在回复">
                      <span className="message-avatar" aria-hidden="true">她</span>
                      <div>
                        <span className="message-author">{form.relationship}</span>
                        <p className="typing-indicator"><i /><i /><i /></p>
                      </div>
                    </article>
                  )}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form className="chat-composer" onSubmit={sendMessage}>
              {isDemo && (
                <div className="demo-strip">当前是本地草稿模式；配置 AI Key 后，她的回复会由 AI 生成。</div>
              )}
              <label htmlFor="chat-draft">你想说的话</label>
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
                  placeholder="写下这一次你真正想说的话……"
                  maxLength={1200}
                  rows={3}
                />
                <div className="composer-footer">
                  <span>{draft.length} / 1200 · Shift + Enter 换行</span>
                  <button disabled={loading || !draft.trim()}>
                    {loading ? "等待她回复…" : "说给她听"} <span aria-hidden="true">↑</span>
                  </button>
                </div>
              </div>
              {error && <p className="error-message" role="alert">{error}</p>}
            </form>
          </div>

          <aside className="scene-sidebar">
            <p className="eyebrow">THE MEMORY · 这段记忆</p>
            <dl>
              <div><dt>你面对的人</dt><dd>{form.relationship}</dd></div>
              <div><dt>当时发生的事</dt><dd>{form.context}</dd></div>
              <div><dt>她的说话方式</dt><dd>{form.counterpartStyle}</dd></div>
              <div><dt>她当时的状态</dt><dd>{form.counterpartEmotion} · {form.counterpartOpenness}</dd></div>
              <div><dt>这次你想做到</dt><dd>{form.desiredOutcome}</dd></div>
              {form.boundary && <div><dt>你的边界</dt><dd>{form.boundary}</dd></div>}
            </dl>
            {starter.assumptions.length > 0 && (
              <p className="sidebar-note">对方当时说的话按“记忆中的大意”处理，不会当成逐字原话。</p>
            )}
            <p className="turn-count">已经练习 {messages.filter((message) => message.role === "user").length} 轮</p>
          </aside>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell question-shell">
      <header className="site-header compact-header">
        <button className="brand brand-button" onClick={() => setView("intro")} aria-label="返回首页">
          <span className="brand-mark" aria-hidden="true">Ⅱ</span>
          <span>第二次回答</span>
        </button>
        <span className="step-counter">{String(step + 1).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}</span>
      </header>

      <div className="progress-track" aria-label={`问卷进度 ${progress}%`}>
        <div style={{ width: `${progress}%` }} />
      </div>

      <section className="question-layout">
        <aside className="question-aside">
          <p className="eyebrow">REMEMBER · 记起</p>
          <p>不必把一切都说得很完整。写下你确实记得的，就已经足够。</p>
          <div className="memory-index" aria-hidden="true">
            {Array.from({ length: totalSteps }, (_, index) => (
              <span key={index} className={index === step ? "current" : index < step ? "done" : ""} />
            ))}
          </div>
        </aside>

        <div className="question-card">
          {renderQuestion(step, form, update)}
          {error && <p className="error-message" role="alert">{error}</p>}

          <div className="question-actions">
            <button className="secondary-button" onClick={previousStep}>← 返回</button>
            {step < totalSteps - 1 ? (
              <button className="primary-button" onClick={nextStep} disabled={!canContinue}>继续 <span aria-hidden="true">→</span></button>
            ) : (
              <button className="primary-button generate-button" onClick={beginConversation} disabled={loading}>
                {loading ? "正在准备这段对话…" : "进入这段对话"}
              </button>
            )}
          </div>
        </div>
      </section>

      <footer className="question-footer">
        <span>只在进入练习后发送问卷内容</span>
        <button className="danger-text" onClick={reset}>清空</button>
      </footer>
    </main>
  );
}

function renderQuestion(
  step: number,
  form: MemoryForm,
  update: <K extends keyof MemoryForm>(key: K, value: MemoryForm[K]) => void,
) {
  switch (step) {
    case 0:
      return (
        <QuestionFrame number="01" title="她是谁？" hint="写一个称呼和你们的关系，不需要使用真实姓名。">
          <label className="field-label" htmlFor="relationship">她的称呼或你们的关系</label>
          <input id="relationship" className="large-input" autoFocus value={form.relationship} onChange={(event) => update("relationship", event.target.value)} placeholder="例如：小林，我的前同事" maxLength={120} />
        </QuestionFrame>
      );
    case 1:
      return (
        <QuestionFrame number="02" title="那一刻发生了什么？" hint="只写你确定发生的事情，不需要解释谁对谁错。">
          <label className="field-label" htmlFor="context">场景</label>
          <textarea id="context" className="large-textarea" autoFocus value={form.context} onChange={(event) => update("context", event.target.value)} placeholder="例如：下班后，我们因为是否继续合作发生了争执……" maxLength={1600} />
        </QuestionFrame>
      );
    case 2:
      return (
        <QuestionFrame number="03" title="她当时说了什么？" hint="不记得原话也没关系，可以只写大意。">
          <label className="field-label" htmlFor="counterpartWords">你记得的话</label>
          <textarea id="counterpartWords" className="large-textarea" autoFocus value={form.counterpartWords} onChange={(event) => update("counterpartWords", event.target.value)} placeholder="例如：她觉得我没有认真对待这件事……" maxLength={1600} />
          <label className="check-row">
            <input type="checkbox" checked={form.isApproximate} onChange={(event) => update("isApproximate", event.target.checked)} />
            <span>这是大意，不一定是她的原话</span>
          </label>
        </QuestionFrame>
      );
    case 3:
      return (
        <QuestionFrame number="04" title="她平时怎样说话？" hint="写她真实的表达习惯，而不是你希望她怎样回答。想不起来可以写“不确定”。">
          <label className="field-label" htmlFor="counterpartStyle">她的说话方式</label>
          <textarea id="counterpartStyle" className="large-textarea" autoFocus value={form.counterpartStyle} onChange={(event) => update("counterpartStyle", event.target.value)} placeholder="例如：话很少，句子短；不喜欢直接说情绪；生气时会反问，有时只回“行”。" maxLength={1400} />
          <label className="field-label second-label" htmlFor="counterpartPhrases">她常用的词或口头禅（选填）</label>
          <textarea id="counterpartPhrases" className="medium-textarea" value={form.counterpartPhrases} onChange={(event) => update("counterpartPhrases", event.target.value)} placeholder="例如：她常说“算了”“你先说”“我不知道”……" maxLength={800} />
        </QuestionFrame>
      );
    case 4:
      return (
        <QuestionFrame number="05" title="那一刻，她是什么状态？" hint="这是你记忆中的判断，不会被当成她确定的内心。">
          <fieldset className="choice-fieldset">
            <legend>她表现出来的情绪</legend>
            <div className="choice-grid persona-grid">
              {emotionOptions.map((emotion) => (
                <button type="button" key={emotion} className={form.counterpartEmotion === emotion ? "selected" : ""} onClick={() => update("counterpartEmotion", emotion)} aria-pressed={form.counterpartEmotion === emotion}>{emotion}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="choice-fieldset persona-fieldset">
            <legend>她愿不愿意继续谈</legend>
            <div className="choice-grid persona-grid">
              {opennessOptions.map((openness) => (
                <button type="button" key={openness} className={form.counterpartOpenness === openness ? "selected" : ""} onClick={() => update("counterpartOpenness", openness)} aria-pressed={form.counterpartOpenness === openness}>{openness}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="choice-fieldset persona-fieldset">
            <legend>发生冲突时，她通常会</legend>
            <div className="choice-grid persona-grid">
              {reactionOptions.map((reaction) => (
                <button type="button" key={reaction} className={form.counterpartReaction === reaction ? "selected" : ""} onClick={() => update("counterpartReaction", reaction)} aria-pressed={form.counterpartReaction === reaction}>{reaction}</button>
              ))}
            </div>
          </fieldset>
        </QuestionFrame>
      );
    case 5:
      return (
        <QuestionFrame number="06" title="你当时怎么回答的？" hint="如果当时沉默了，可以写“没有回答”。这题也可以跳过。">
          <label className="field-label" htmlFor="originalReply">当时的回答（选填）</label>
          <textarea id="originalReply" className="large-textarea" autoFocus value={form.originalReply} onChange={(event) => update("originalReply", event.target.value)} placeholder="例如：我只说了“随便你”，然后离开了。" maxLength={1200} />
        </QuestionFrame>
      );
    case 6:
      return (
        <QuestionFrame number="07" title="当时，什么让你没能说出口？" hint="可以是感受、担心，也可以是来不及整理好的想法。">
          <label className="field-label" htmlFor="feelings">当时的你</label>
          <textarea id="feelings" className="large-textarea" autoFocus value={form.feelings} onChange={(event) => update("feelings", event.target.value)} placeholder="例如：我很委屈，也怕一开口就会让关系更糟……" maxLength={1600} />
        </QuestionFrame>
      );
    case 7:
      return (
        <QuestionFrame number="08" title="如果再来一次，你最想让她明白什么？" hint="先不用考虑怎么说，只写最核心的意思。">
          <label className="field-label" htmlFor="coreIntent">真正想表达的</label>
          <textarea id="coreIntent" className="large-textarea" autoFocus value={form.coreIntent} onChange={(event) => update("coreIntent", event.target.value)} placeholder="例如：我不是不在乎，我愿意继续，但需要重新商量分工。" maxLength={1600} />
        </QuestionFrame>
      );
    case 8:
      return (
        <QuestionFrame number="09" title="你希望这次对话带来什么？" hint="结果不完全由你控制，但你可以说清自己的愿望和边界。">
          <label className="field-label" htmlFor="desiredOutcome">你希望发生的改变</label>
          <textarea id="desiredOutcome" className="medium-textarea" autoFocus value={form.desiredOutcome} onChange={(event) => update("desiredOutcome", event.target.value)} placeholder="例如：继续合作，但彼此把分工说清楚。" maxLength={1000} />
          <label className="field-label second-label" htmlFor="boundary">不能退让的边界（选填）</label>
          <textarea id="boundary" className="medium-textarea" value={form.boundary} onChange={(event) => update("boundary", event.target.value)} placeholder="例如：我不能再独自承担大部分工作。" maxLength={1000} />
        </QuestionFrame>
      );
    default:
      return (
        <QuestionFrame number="10" title="这次，你想怎样说？" hint="这些选项只用于提供开场草稿；进入对话后，每一句都由你自己决定。">
          <fieldset className="choice-fieldset">
            <legend>你的语气</legend>
            <div className="choice-grid tone-grid">
              {toneOptions.map((tone) => (
                <button type="button" key={tone} className={form.tone === tone ? "selected" : ""} onClick={() => update("tone", tone)} aria-pressed={form.tone === tone}>{tone}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="choice-fieldset length-fieldset">
            <legend>开场长度</legend>
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
