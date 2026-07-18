import assert from "node:assert/strict";
import test from "node:test";

const memory = {
  relationship: "An old friend",
  context: "We argued after a missed plan.",
  counterpartWords: "They said I simply don't care.",
  isApproximate: true,
  counterpartStyle: "Very short sentences; asks pointed questions directly when angry.",
  counterpartPhrases: "forget it",
  sampleProfile: "Prefers short sentences; pushes back directly first in conflict, and is usually clear when refusing.",
  counterpartEmotion: "Angry",
  counterpartOpenness: "Will listen but push back",
  counterpartReaction: "Pushes back immediately",
  originalReply: "I didn't explain at the time.",
  feelings: "I was afraid it would only get worse the more I said.",
  coreIntent: "It's not that I don't care.",
  desiredOutcome: "Clear up the misunderstanding.",
  boundary: "No shaming each other.",
  tone: "Warm & sincere",
  length: "Medium",
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

async function requestGenerate(worker, questionnaire) {
  return worker.fetch(
    new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(questionnaire),
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
  assert.match(html, /<title>Second Reply<\/title>/i);
  assert.match(html, /If you could go back/);
  assert.match(html, /Go back to that moment/);
  assert.match(html, /12 questions/);
  assert.match(html, /This session is not saved in your browser/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("generate extracts a compact profile from an optional chat sample", async () => {
  const worker = await loadWorker("generate-sample-profile");
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  let capturedBody;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    if (String(input) === "https://api.openai.com/v1/responses") {
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          primaryReply: "I want to clear up the misunderstanding from that day.",
          gentleReply: "If you're willing, I'd like to talk through that day again.",
          firmReply: "I'm willing to explain, but I can't accept us shaming each other.",
          reflection: "You want your words to land closer to who you really are.",
          assumptions: ["What the other person said is the gist as you remember it"],
          sampleProfile: "Often uses short sentences and usually responds directly; when unsure, defers the decision, and is clear when refusing.",
        }),
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return originalFetch(input, init);
  };

  try {
    const response = await requestGenerate(worker, {
      ...memory,
      conversationSamples: "Me: Are you free Saturday?\nLin: Not sure yet, I'll decide later.\nMe: How about the afternoon?\nLin: Can't, I have plans.",
      sampleCounterpartName: "Lin",
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.mode, "ai");
    assert.match(payload.sampleProfile, /short sentence|refus/i);
    assert.match(capturedBody.input, /free Saturday/);
    assert.match(capturedBody.instructions, /analyze only the other person's messages/);
    assert.equal(capturedBody.text.format.schema.properties.sampleProfile.maxLength, 1200);
    assert.equal(capturedBody.store, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  }
});

test("conversation fallback uses the remembered personality instead of one generic reply", async () => {
  const worker = await loadWorker("conversation");
  const response = await requestConversation(worker, [
    { role: "user", text: "I wasn't uncaring back then, I just didn't know how to say it." },
  ]);

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.mode, "demo");
  assert.equal(payload.status, "continue");
  assert.equal(payload.endReason, "none");
  assert.equal(payload.goalState, "progressing");
  assert.ok(payload.turnAction);
  assert.match(payload.reply, /what you said back then|which version is true/);
});

test("conversation fallback can reach the desired outcome", async () => {
  const worker = await loadWorker("conversation-success");
  const messages = [
    { role: "user", text: "I want to explain what happened that day." },
    { role: "counterpart", text: "You go first." },
    { role: "user", text: "I was really scared at the time." },
    { role: "counterpart", text: "I see." },
    { role: "user", text: "Then can we sit down tomorrow and talk through this misunderstanding specifically?" },
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
    { role: "user", text: "I want to explain what happened that day." },
    { role: "counterpart", text: "I have nothing I want to say." },
    { role: "user", text: "At least let me finish the most important part." },
  ], { ...memory, counterpartOpenness: "Doesn't want to continue" });

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
    messages.push({ role: "user", text: `This is my explanation number ${turn}, and I'm still describing what I was thinking.` });
    if (turn < 12) messages.push({ role: "counterpart", text: `I heard explanation number ${turn}, but I haven't agreed yet.` });
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
            reply: "I hear part of it, but I don't want to keep this conversation going.",
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
            rewriteInstruction: "",
            evidence: "The candidate clearly ended the conversation, and the hoped-for outcome wasn't reached.",
          };
      return new Response(JSON.stringify({
        output_text: JSON.stringify(output),
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return originalFetch(input, init);
  };

  try {
    const response = await requestConversation(worker, [
      { role: "user", text: "I want to explain what happened that day." },
      { role: "counterpart", text: "Go ahead then." },
      { role: "user", text: "I left back then because I was too scared." },
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
    assert.match(capturedBodies[1].instructions, /independent semantic judge/);
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
            reply: "I still don't know whether I should believe what you're saying.",
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
              rewriteInstruction: "The candidate repeats the previous line with no new room to move; end naturally.",
              evidence: "The candidate repeated last turn's stance and produced no new progress.",
            }
          : {
            reply: "I hear your explanation, but I don't want to keep talking. Let's leave it here.",
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
      { role: "user", text: "I hope you can believe me." },
      { role: "counterpart", text: "I still don't know whether I should believe what you're saying." },
      { role: "user", text: "I can tell you exactly what happened at the time." },
    ]);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(requestCount, 3);
    assert.equal(payload.mode, "ai");
    assert.equal(payload.status, "ended");
    assert.equal(payload.endReason, "breakdown");
    assert.match(payload.reply, /don't want to keep|leave it here/);
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
        ? { reply: "So how are you planning to get there?", turnAction: "ask" }
        : requestCount === 2
          ? {
              candidateOutcome: "continue",
              finalOutcome: "success",
              userIntent: "continue",
              progress: "question_loop",
              counterpartDecision: "undecided",
              candidateVerdict: "regenerate",
              requiredAction: "accept",
              rewriteInstruction: "The user already gave the necessary details; decide whether to accept the invitation.",
              evidence: "The necessary details were completed in the last two turns, but the candidate keeps changing the question.",
            }
          : { reply: "Sure, Saturday at 3pm at the downtown cinema.", turnAction: "accept" };
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
      context: "I want to invite them out this weekend.",
      counterpartWords: "They mentioned wanting to see a movie recently.",
      counterpartEmotion: "Calm",
      counterpartReaction: "Presses for details",
      desiredOutcome: "They agree to see a movie with me on Saturday.",
    };
    const response = await requestConversation(worker, [
      { role: "user", text: "Want to watch a movie together Saturday?" },
      { role: "counterpart", text: "What movie?" },
      { role: "user", text: "The one you said you wanted to see." },
      { role: "counterpart", text: "Where?" },
      { role: "user", text: "The downtown cinema, 3pm, does that work?" },
    ], inviteMemory);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(requestCount, 3);
    assert.equal(payload.mode, "ai");
    assert.equal(payload.status, "ended");
    assert.equal(payload.endReason, "resolved");
    assert.equal(payload.goalState, "achieved");
    assert.match(payload.reply, /sure|saturday/i);
    assert.match(capturedBodies[2].instructions, /Required action: accept/);
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
        ? { reply: "Why are you suddenly saying this?", turnAction: "ask" }
        : requestCount === 2
          ? {
              candidateOutcome: "continue",
              finalOutcome: "breakdown",
              userIntent: "end",
              progress: "stalled",
              counterpartDecision: "undecided",
              candidateVerdict: "regenerate",
              requiredAction: "close",
              rewriteInstruction: "The user clearly asked to stop; just close naturally.",
              evidence: "The full meaning of the latest message is driving the other person away and ending the conversation.",
            }
          : { reply: "Okay, let's leave it here then.", turnAction: "close" };
      return new Response(JSON.stringify({ output_text: JSON.stringify(output) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input, init);
  };

  try {
    const response = await requestConversation(worker, [
      { role: "user", text: "Get lost, I don't want to talk to you anymore." },
    ]);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(requestCount, 3);
    assert.equal(payload.mode, "ai");
    assert.equal(payload.status, "ended");
    assert.equal(payload.endReason, "breakdown");
    assert.match(payload.reply, /leave it here/);
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
        ? { reply: "So how else do you want to explain it?", turnAction: "ask" }
        : requestCount === 2
          ? {
              candidateOutcome: "continue",
              finalOutcome: "continue",
              userIntent: "continue",
              progress: "forward",
              counterpartDecision: "undecided",
              candidateVerdict: "use",
              requiredAction: "keep",
              rewriteInstruction: "No rewrite needed.",
              evidence: "The candidate is still trying to keep clarifying, but the goal isn't reached yet.",
            }
          : { reply: "We still haven't met on this, so let's leave it here for today.", turnAction: "close" };
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
      messages.push({ role: "user", text: `This is turn ${turn}, and I still want to keep explaining.` });
      if (turn < 12) messages.push({ role: "counterpart", text: `I heard turn ${turn}, but I haven't agreed yet.` });
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
