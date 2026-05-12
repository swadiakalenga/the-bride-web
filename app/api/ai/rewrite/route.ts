import { NextRequest, NextResponse } from "next/server";

const ACTIONS: Record<string, string> = {
  improve:
    "Improve the writing clarity and tone of this text for a faith-based community platform. Keep the meaning and faith focus intact. Return only the improved text.",
  shorter:
    "Make this text shorter while keeping the core faith-based message. Return only the shortened text.",
  encouraging:
    "Rewrite this text to be more encouraging, uplifting, and faith-centered. Return only the rewritten text.",
  french: "Translate this text to French. Return only the translated text.",
  english: "Translate this text to English. Return only the translated text.",
  announcement:
    "Rewrite this as a clear, formal church announcement suitable for a congregation bulletin. Return only the rewritten text.",
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI assistant is not configured." }, { status: 503 });
  }

  let body: { text?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { text, action } = body;

  if (!text?.trim() || !action || !ACTIONS[action]) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: ACTIONS[action] },
        { role: "user", content: text.trim() },
      ],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 502 });
  }

  const data = await response.json() as {
    choices?: { message?: { content?: string } }[];
  };
  const result = data.choices?.[0]?.message?.content?.trim();

  if (!result) {
    return NextResponse.json({ error: "AI returned an empty response." }, { status: 502 });
  }

  return NextResponse.json({ result });
}
