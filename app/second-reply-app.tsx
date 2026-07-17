"use client";

import { FormEvent, useMemo, useState } from "react";

type Tone = "温和真诚" | "直接坦率" | "坚定有边界" | "平静克制";
type ReplyLength = "简短" | "适中" | "详细";

type MemoryForm = {
  relationship: string;
  context: string;
  counterpartWords: string;
  isApproximate: boolean;
  originalReply: string;
  feelings: string;
  coreIntent: string;
  desiredOutcome: string;
  boundary: string;
  tone: Tone;
  length: ReplyLength;
};

type ReplyResult = {
  primaryReply: string;
  gentleReply: string;
  firmReply: string;
  reflection: string;
  assumptions: string[];
  mode: "ai" | "demo";
  notice?: string;
};

const initialForm: MemoryForm = {
  relationship: "",
  context: "",
  counterpartWords: "",
  isApproximate: true,
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
const adjustments = ["更像日常说话", "再短一点", "更温和", "更坚定"];
const totalSteps = 8;

export function SecondReplyApp() {
  const [view, setView] = useState<"intro" | "questions" | "result">("intro");
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<MemoryForm>(initialForm);
  const [result, setResult] = useState<ReplyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customAdjustment, setCustomAdjustment] = useState("");
  const [copied, setCopied] = useState("");

  const progress = Math.round(((step + 1) / totalSteps) * 100);

  const canContinue = useMemo(() => {
    switch (step) {
      case 0:
        return form.relationship.trim().length > 0;
      case 1:
        return form.context.trim().length > 0;
      case 2:
        return form.counterpartWords.trim().length > 0;
      case 3:
        return true;
      case 4:
        return form.feelings.trim().length > 0;
      case 5:
        return form.coreIntent.trim().length > 0;
      case 6:
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

  async function generate(adjustment = "") {
    setLoading(true);
    setError("");
    setCopied("");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, adjustment }),
      });
      const payload = (await response.json()) as ReplyResult & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "暂时没能生成回答，请稍后再试。");
      }
      setResult(payload);
      setView("result");
      setCustomAdjustment("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "暂时没能生成回答，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }

  async function copyReply(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("");
    }
  }

  function reset() {
    setForm(initialForm);
    setResult(null);
    setStep(0);
    setView("intro");
    setError("");
    setCustomAdjustment("");
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
              不改变已经发生的事。只是重新听见当时的自己，找到这一次真正想说的话。
            </p>
            <button className="primary-button intro-button" onClick={() => setView("questions")}>
              回到那一刻 <span aria-hidden="true">→</span>
            </button>
            <p className="microcopy">大约 5 分钟 · 8 个问题 · 随时可以清空</p>
          </div>

          <div className="moment-card" aria-label="产品流程预览">
            <span className="moment-number">02</span>
            <div className="moment-line" />
            <p>“当时没说出口的，<br />这次可以慢慢说。”</p>
            <div className="moment-steps" aria-hidden="true">
              <span className="active">记起</span>
              <i />
              <span>理解</span>
              <i />
              <span>回答</span>
            </div>
          </div>
        </section>

        <footer className="intro-footer">
          <span>你的记忆属于你</span>
          <span>不是心理治疗或专业建议</span>
        </footer>
      </main>
    );
  }

  if (view === "result" && result) {
    const cards = [
      { key: "最像你", title: "最像你的回答", text: result.primaryReply, featured: true },
      { key: "更温和", title: "更温和的说法", text: result.gentleReply, featured: false },
      { key: "更坚定", title: "边界更清楚的说法", text: result.firmReply, featured: false },
    ];

    return (
      <main className="app-shell result-shell">
        <header className="site-header compact-header">
          <button className="brand brand-button" onClick={reset} aria-label="清空并返回首页">
            <span className="brand-mark" aria-hidden="true">Ⅱ</span>
            <span>第二次回答</span>
          </button>
          <button className="text-button" onClick={() => { setView("questions"); setStep(7); }}>修改记忆</button>
        </header>

        <section className="result-hero">
          <p className="eyebrow">YOUR SECOND REPLY · 你的第二次回答</p>
          <h1>这一次，你可以这样说。</h1>
          <p>{result.reflection}</p>
          {result.mode === "demo" && (
            <div className="demo-notice" role="status">
              当前显示可测试的本地草稿。配置服务端 AI Key 后会自动切换为 AI 生成。
            </div>
          )}
        </section>

        <section className="reply-grid" aria-label="回答候选">
          {cards.map((card) => (
            <article className={`reply-card ${card.featured ? "featured" : ""}`} key={card.key}>
              <div className="reply-card-header">
                <span>{card.title}</span>
                {card.featured && <span className="recommended">推荐</span>}
              </div>
              <p>{card.text}</p>
              <button className="copy-button" onClick={() => copyReply(card.key, card.text)}>
                {copied === card.key ? "已复制" : "复制这段话"}
              </button>
            </article>
          ))}
        </section>

        {result.assumptions.length > 0 && (
          <section className="assumption-note">
            <strong>我没有把这些当成事实：</strong>
            <span>{result.assumptions.join("；")}</span>
          </section>
        )}

        <section className="refine-panel">
          <div>
            <p className="section-kicker">还不像你？</p>
            <h2>再调整一点</h2>
          </div>
          <div className="adjustment-chips">
            {adjustments.map((item) => (
              <button key={item} disabled={loading} onClick={() => generate(item)}>{item}</button>
            ))}
          </div>
          <form
            className="custom-adjustment"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              if (customAdjustment.trim()) generate(customAdjustment.trim());
            }}
          >
            <label htmlFor="custom-adjustment">或者告诉我，你想怎么改</label>
            <div>
              <input
                id="custom-adjustment"
                value={customAdjustment}
                onChange={(event) => setCustomAdjustment(event.target.value)}
                placeholder="例如：不要说‘我理解你’，更像我平时的语气"
                maxLength={240}
              />
              <button disabled={loading || !customAdjustment.trim()}>{loading ? "生成中…" : "重新生成"}</button>
            </div>
          </form>
          {error && <p className="error-message" role="alert">{error}</p>}
        </section>

        <footer className="result-footer">
          <button className="danger-text" onClick={reset}>清空这次记忆</button>
          <p>这些文字只是一个起点。真正的回答，仍然由你决定。</p>
        </footer>
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
              <button className="primary-button generate-button" onClick={() => generate()} disabled={loading}>
                {loading ? "正在组织语言…" : "生成我的第二次回答"}
              </button>
            )}
          </div>
        </div>
      </section>

      <footer className="question-footer">
        <span>只在点击生成时发送问卷内容</span>
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
        <QuestionFrame number="01" title="当时，你在和谁说话？" hint="写关系就可以，不需要真实姓名。">
          <label className="field-label" htmlFor="relationship">你们的关系</label>
          <input id="relationship" className="large-input" autoFocus value={form.relationship} onChange={(event) => update("relationship", event.target.value)} placeholder="例如：伴侣、朋友、同事、家人" maxLength={120} />
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
        <QuestionFrame number="03" title="对方说了什么？" hint="不记得原话也没关系，可以只写大意。">
          <label className="field-label" htmlFor="counterpartWords">你记得的话</label>
          <textarea id="counterpartWords" className="large-textarea" autoFocus value={form.counterpartWords} onChange={(event) => update("counterpartWords", event.target.value)} placeholder="例如：对方觉得我没有认真对待这件事……" maxLength={1600} />
          <label className="check-row">
            <input type="checkbox" checked={form.isApproximate} onChange={(event) => update("isApproximate", event.target.checked)} />
            <span>这是大意，不一定是对方的原话</span>
          </label>
        </QuestionFrame>
      );
    case 3:
      return (
        <QuestionFrame number="04" title="你当时怎么回答的？" hint="如果当时沉默了，可以写“没有回答”。这题也可以跳过。">
          <label className="field-label" htmlFor="originalReply">当时的回答（选填）</label>
          <textarea id="originalReply" className="large-textarea" autoFocus value={form.originalReply} onChange={(event) => update("originalReply", event.target.value)} placeholder="例如：我只说了“随便你”，然后离开了。" maxLength={1200} />
        </QuestionFrame>
      );
    case 4:
      return (
        <QuestionFrame number="05" title="当时，什么让你没能说出口？" hint="可以是感受、担心，也可以是来不及整理好的想法。">
          <label className="field-label" htmlFor="feelings">当时的你</label>
          <textarea id="feelings" className="large-textarea" autoFocus value={form.feelings} onChange={(event) => update("feelings", event.target.value)} placeholder="例如：我很委屈，也怕一开口就会让关系更糟……" maxLength={1600} />
        </QuestionFrame>
      );
    case 5:
      return (
        <QuestionFrame number="06" title="如果再来一次，你最想让对方明白什么？" hint="先不用考虑怎么说，只写最核心的意思。">
          <label className="field-label" htmlFor="coreIntent">真正想表达的</label>
          <textarea id="coreIntent" className="large-textarea" autoFocus value={form.coreIntent} onChange={(event) => update("coreIntent", event.target.value)} placeholder="例如：我不是不在乎，我愿意继续，但需要重新商量分工。" maxLength={1600} />
        </QuestionFrame>
      );
    case 6:
      return (
        <QuestionFrame number="07" title="你希望这次回答带来什么？" hint="结果不完全由你控制，但你可以说清自己的愿望和边界。">
          <label className="field-label" htmlFor="desiredOutcome">你希望发生的改变</label>
          <textarea id="desiredOutcome" className="medium-textarea" autoFocus value={form.desiredOutcome} onChange={(event) => update("desiredOutcome", event.target.value)} placeholder="例如：继续合作，但彼此把分工说清楚。" maxLength={1000} />
          <label className="field-label second-label" htmlFor="boundary">不能退让的边界（选填）</label>
          <textarea id="boundary" className="medium-textarea" value={form.boundary} onChange={(event) => update("boundary", event.target.value)} placeholder="例如：我不能再独自承担大部分工作。" maxLength={1000} />
        </QuestionFrame>
      );
    default:
      return (
        <QuestionFrame number="08" title="这次，你想用怎样的声音说？" hint="AI 会保留你的意思，只调整表达方式。">
          <fieldset className="choice-fieldset">
            <legend>语气</legend>
            <div className="choice-grid tone-grid">
              {toneOptions.map((tone) => (
                <button type="button" key={tone} className={form.tone === tone ? "selected" : ""} onClick={() => update("tone", tone)} aria-pressed={form.tone === tone}>{tone}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="choice-fieldset length-fieldset">
            <legend>长度</legend>
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
