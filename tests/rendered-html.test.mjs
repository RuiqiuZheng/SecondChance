import assert from "node:assert/strict";
import test from "node:test";

const memory = {
  relationship: "一位旧朋友",
  context: "我们因为一次失约争吵。",
  counterpartWords: "她说我根本不在乎。",
  isApproximate: true,
  counterpartStyle: "句子很短，生气时会直接反问。",
  counterpartPhrases: "算了",
  counterpartEmotion: "生气",
  counterpartOpenness: "愿意听但会反驳",
  counterpartReaction: "马上反驳",
  originalReply: "我当时没有解释。",
  feelings: "我怕越说越糟。",
  coreIntent: "我并不是不在乎。",
  desiredOutcome: "把误会说开。",
  boundary: "不能互相羞辱。",
  tone: "温和真诚",
  length: "适中",
};

async function loadWorker(suffix) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${suffix}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

async function requestConversation(worker, messages, conversationMemory = memory) {
  return worker.fetch(
    new Request("http://localhost/api/conversation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memory: conversationMemory, messages }),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the second reply questionnaire", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>第二次回答<\/title>/i);
  assert.match(html, /如果可以回到/);
  assert.match(html, /回到那一刻/);
  assert.match(html, /10 个问题/);
  assert.match(html, /本次内容不会保存在浏览器/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("conversation fallback uses the remembered personality instead of one generic reply", async () => {
  const worker = await loadWorker("conversation");
  const response = await requestConversation(worker, [
    { role: "user", text: "我当时不是不在乎，只是不知道怎么说。" },
  ]);

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.mode, "demo");
  assert.equal(payload.status, "continue");
  assert.equal(payload.endReason, "none");
  assert.equal(payload.goalState, "progressing");
  assert.ok(payload.turnAction);
  assert.match(payload.reply, /根本不是这么说的|哪句才是真的/);
});

test("conversation fallback can reach the desired outcome", async () => {
  const worker = await loadWorker("conversation-success");
  const messages = [
    { role: "user", text: "我想解释那天的事。" },
    { role: "counterpart", text: "你先说。" },
    { role: "user", text: "我当时很害怕。" },
    { role: "counterpart", text: "我知道了。" },
    { role: "user", text: "那我们明天把这次误会具体说开，可以吗？" },
  ];
  const response = await requestConversation(worker, messages);

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.mode, "demo");
  assert.equal(payload.status, "ended");
  assert.equal(payload.endReason, "resolved");
  assert.equal(payload.goalState, "achieved");
});

test("conversation fallback records an early breakdown as a bad ending", async () => {
  const worker = await loadWorker("conversation-breakdown");
  const response = await requestConversation(worker, [
    { role: "user", text: "我想解释那天的事。" },
    { role: "counterpart", text: "我没什么想说的。" },
    { role: "user", text: "至少让我把最重要的部分说完。" },
  ], { ...memory, counterpartOpenness: "不想继续" });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.mode, "demo");
  assert.equal(payload.status, "ended");
  assert.equal(payload.endReason, "breakdown");
  assert.equal(payload.goalState, "blocked");
});

test("conversation fallback records the twelfth turn as the limit ending", async () => {
  const worker = await loadWorker("conversation-max-turns");
  const messages = [];
  for (let turn = 1; turn <= 12; turn += 1) {
    messages.push({ role: "user", text: `这是我的第 ${turn} 次解释，我还在说明当时的想法。` });
    if (turn < 12) messages.push({ role: "counterpart", text: `我听见了第 ${turn} 次解释，但还没有答应。` });
  }
  const response = await requestConversation(worker, messages);

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.mode, "demo");
  assert.equal(payload.status, "ended");
  assert.equal(payload.endReason, "max_turns");
  assert.equal(payload.goalState, "blocked");
});

test("AI conversation requests preserve alternating user and assistant roles", async () => {
  const worker = await loadWorker("conversation-roles");
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const capturedBodies = [];
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    if (String(input) === "https://api.openai.com/v1/responses") {
      const body = JSON.parse(String(init?.body));
      capturedBodies.push(body);
      const output = capturedBodies.length === 1
        ? {
            reply: "我听明白了一部分，但我不想再继续这段对话了。",
            turnAction: "close",
          }
        : {
            candidateOutcome: "breakdown",
            finalOutcome: "breakdown",
            userIntent: "continue",
            progress: "stalled",
            counterpartDecision: "declined",
            candidateVerdict: "use",
            requiredAction: "keep",
            rewriteInstruction: "无需重写。",
            evidence: "候选明确结束了对话，期待结果尚未达成。",
          };
      return new Response(JSON.stringify({
        output_text: JSON.stringify(output),
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return originalFetch(input, init);
  };

  try {
    const response = await requestConversation(worker, [
      { role: "user", text: "我想解释那天的事。" },
      { role: "counterpart", text: "那你说吧。" },
      { role: "user", text: "我当时离开是因为太害怕了。" },
    ]);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.mode, "ai");
    assert.equal(payload.status, "ended");
    assert.equal(payload.endReason, "breakdown");
    assert.equal(capturedBodies.length, 2);
    assert.deepEqual(capturedBodies[0].input.map((item) => item.role), ["user", "assistant", "user"]);
    assert.match(capturedBodies[0].input[0].content, /memory JSON/);
    assert.equal(capturedBodies[0].reasoning.effort, "low");
    assert.equal(capturedBodies[1].reasoning.effort, "medium");
    assert.match(capturedBodies[1].instructions, /独立语义裁判/);
    assert.match(capturedBodies[1].instructions, /desiredOutcome/);
    assert.deepEqual(capturedBodies[1].text.format.schema.properties.progress.enum, ["forward", "stalled", "question_loop"]);
    assert.equal(capturedBodies[0].store, false);
    assert.equal(capturedBodies[1].store, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("repetitive AI replies are regenerated once", async () => {
  const worker = await loadWorker("conversation-retry");
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  let requestCount = 0;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    if (String(input) === "https://api.openai.com/v1/responses") {
      requestCount += 1;
      const turn = requestCount === 1
        ? {
            reply: "我还是不知道该不该相信你说的这些。",
            turnAction: "respond",
          }
        : requestCount === 2
          ? {
              candidateOutcome: "continue",
              finalOutcome: "breakdown",
              userIntent: "continue",
              progress: "stalled",
              counterpartDecision: "undecided",
              candidateVerdict: "regenerate",
              requiredAction: "close",
              rewriteInstruction: "候选与前文重复，已经没有新的推进空间，请自然结束。",
              evidence: "候选重复了上一轮立场，没有产生新进展。",
            }
          : {
            reply: "我听见你的解释了，但我不想再继续说了。就到这里吧。",
            turnAction: "close",
          };
      return new Response(JSON.stringify({ output_text: JSON.stringify(turn) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input, init);
  };

  try {
    const response = await requestConversation(worker, [
      { role: "user", text: "我希望你能相信我。" },
      { role: "counterpart", text: "我还是不知道该不该相信你说的这些。" },
      { role: "user", text: "我可以告诉你当时具体发生了什么。" },
    ]);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(requestCount, 3);
    assert.equal(payload.mode, "ai");
    assert.equal(payload.status, "ended");
    assert.equal(payload.endReason, "breakdown");
    assert.match(payload.reply, /不想再继续|到这里/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("the semantic judge rewrites a question loop into a clear successful decision", async () => {
  const worker = await loadWorker("conversation-question-loop");
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  let requestCount = 0;
  const capturedBodies = [];
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    if (String(input) === "https://api.openai.com/v1/responses") {
      requestCount += 1;
      capturedBodies.push(JSON.parse(String(init?.body)));
      const output = requestCount === 1
        ? { reply: "那你打算怎么过去？", turnAction: "ask" }
        : requestCount === 2
          ? {
              candidateOutcome: "continue",
              finalOutcome: "success",
              userIntent: "continue",
              progress: "question_loop",
              counterpartDecision: "undecided",
              candidateVerdict: "regenerate",
              requiredAction: "accept",
              rewriteInstruction: "用户已经回答了必要信息，直接决定是否接受邀请。",
              evidence: "最近两次必要信息已经补全，候选仍换题追问。",
            }
          : { reply: "可以，周六下午三点电影院见。", turnAction: "accept" };
      return new Response(JSON.stringify({ output_text: JSON.stringify(output) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input, init);
  };

  try {
    const inviteMemory = {
      ...memory,
      context: "我想约她周末出去。",
      counterpartWords: "她之前说最近想看一部电影。",
      counterpartEmotion: "平静",
      counterpartReaction: "追问细节",
      desiredOutcome: "她答应周六和我一起看电影。",
    };
    const response = await requestConversation(worker, [
      { role: "user", text: "周六一起看电影吗？" },
      { role: "counterpart", text: "看什么电影？" },
      { role: "user", text: "你之前说想看的那部。" },
      { role: "counterpart", text: "在哪里？" },
      { role: "user", text: "市中心电影院，下午三点，可以吗？" },
    ], inviteMemory);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(requestCount, 3);
    assert.equal(payload.mode, "ai");
    assert.equal(payload.status, "ended");
    assert.equal(payload.endReason, "resolved");
    assert.equal(payload.goalState, "achieved");
    assert.match(payload.reply, /可以|周六下午三点/);
    assert.match(capturedBodies[2].instructions, /必须完成的动作：accept/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("the semantic judge respects the user's meaning when they end the conversation", async () => {
  const worker = await loadWorker("conversation-user-end");
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  let requestCount = 0;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    if (String(input) === "https://api.openai.com/v1/responses") {
      requestCount += 1;
      const output = requestCount === 1
        ? { reply: "你为什么突然这么说？", turnAction: "ask" }
        : requestCount === 2
          ? {
              candidateOutcome: "continue",
              finalOutcome: "breakdown",
              userIntent: "end",
              progress: "stalled",
              counterpartDecision: "undecided",
              candidateVerdict: "regenerate",
              requiredAction: "close",
              rewriteInstruction: "用户明确要求终止交流，只自然收尾。",
              evidence: "最新发言的完整语义是在驱赶对方并结束对话。",
            }
          : { reply: "好，那就到这里。", turnAction: "close" };
      return new Response(JSON.stringify({ output_text: JSON.stringify(output) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input, init);
  };

  try {
    const response = await requestConversation(worker, [
      { role: "user", text: "滚，我不想再和你说了。" },
    ]);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(requestCount, 3);
    assert.equal(payload.mode, "ai");
    assert.equal(payload.status, "ended");
    assert.equal(payload.endReason, "breakdown");
    assert.match(payload.reply, /到这里/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("the AI path closes an unresolved twelfth turn as the limit ending", async () => {
  const worker = await loadWorker("conversation-ai-max-turns");
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  let requestCount = 0;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    if (String(input) === "https://api.openai.com/v1/responses") {
      requestCount += 1;
      const output = requestCount === 1
        ? { reply: "那你还想怎么解释？", turnAction: "ask" }
        : requestCount === 2
          ? {
              candidateOutcome: "continue",
              finalOutcome: "continue",
              userIntent: "continue",
              progress: "forward",
              counterpartDecision: "undecided",
              candidateVerdict: "use",
              requiredAction: "keep",
              rewriteInstruction: "无需重写。",
              evidence: "候选仍在尝试继续澄清，但目的尚未达成。",
            }
          : { reply: "我们还是没有说到一起，今天就到这里吧。", turnAction: "close" };
      return new Response(JSON.stringify({ output_text: JSON.stringify(output) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input, init);
  };

  try {
    const messages = [];
    for (let turn = 1; turn <= 12; turn += 1) {
      messages.push({ role: "user", text: `这是第 ${turn} 轮，我还想继续解释。` });
      if (turn < 12) messages.push({ role: "counterpart", text: `我听见了第 ${turn} 轮，但还没有答应。` });
    }
    const response = await requestConversation(worker, messages);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(requestCount, 3);
    assert.equal(payload.mode, "ai");
    assert.equal(payload.status, "ended");
    assert.equal(payload.endReason, "max_turns");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }
});
