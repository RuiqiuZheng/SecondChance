import { NextResponse } from "next/server";

const maxTextLength = 800;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const text = typeof raw.text === "string" ? raw.text.trim().slice(0, maxTextLength) : "";
  if (!text) {
    return NextResponse.json({ error: "Missing text to speak." }, { status: 400 });
  }

  const apiKey = process.env.FISH_API_KEY;
  const referenceId = process.env.FISH_VOICE_ID;
  if (!apiKey || !referenceId) {
    return NextResponse.json({ error: "Voice playback isn't configured yet (missing FISH_API_KEY or FISH_VOICE_ID)." }, { status: 501 });
  }

  try {
    const response = await fetch("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        model: "s2.1-pro-free",
      },
      body: JSON.stringify({
        text,
        reference_id: referenceId,
        format: "mp3",
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[tts] Fish Audio request failed", { status: response.status, detail });
      return NextResponse.json({ error: "Voice generation failed." }, { status: 502 });
    }

    const audio = await response.arrayBuffer();
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[tts] Unexpected error", error);
    return NextResponse.json({ error: "Voice generation failed." }, { status: 502 });
  }
}
