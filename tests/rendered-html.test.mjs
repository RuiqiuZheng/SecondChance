import assert from "node:assert/strict";
import test from "node:test";

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
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-conversation`);
  const { default: worker } = await import(workerUrl.href);
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
  const response = await worker.fetch(
    new Request("http://localhost/api/conversation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memory, messages: [{ role: "user", text: "我当时不是不在乎，只是不知道怎么说。" }] }),
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.mode, "demo");
  assert.match(payload.reply, /根本不是这么说的|哪句才是真的/);
});
