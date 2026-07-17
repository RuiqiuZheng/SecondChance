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
  let capturedBody;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    if (String(input) === "https://api.openai.com/v1/responses") {
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          reply: "我听明白了一部分，但我不想再继续这段对话了。",
          status: "ended",
          endReason: "breakdown",
          goalState: "blocked",
          goalEvidence: "对方明确中止对话，目标尚未达成。",
          turnAction: "end",
        }),
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
    assert.deepEqual(capturedBody.input.map((item) => item.role), ["user", "assistant", "user"]);
    assert.match(capturedBody.input[0].content, /memory JSON/);
    assert.match(capturedBody.instructions, /desiredOutcome/);
    assert.deepEqual(capturedBody.text.format.schema.properties.goalState.enum, ["progressing", "achieved", "blocked"]);
    assert.equal(capturedBody.store, false);
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
            status: "continue",
            endReason: "none",
            goalState: "progressing",
            goalEvidence: "仍然可以继续澄清具体发生的事情。",
            turnAction: "respond",
          }
        : {
            reply: "我听见你的解释了，但我不想再继续说了。就到这里吧。",
            status: "ended",
            endReason: "breakdown",
            goalState: "blocked",
            goalEvidence: "对方结束对话，目标尚未达成。",
            turnAction: "end",
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
    assert.equal(requestCount, 2);
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
