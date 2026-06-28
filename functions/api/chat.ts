interface Env {
  GEMINI_API_KEY: string;
}

interface ChatRequest {
  prompt: string;
  source: string;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const apiKey = ctx.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "APIキーが設定されていません" }, { status: 500 });
  }

  let body: ChatRequest;
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const { prompt, source } = body;
  if (!prompt || !source) {
    return Response.json({ error: "prompt と source は必須です" }, { status: 400 });
  }

  const combinedText = `【参照資料: sample.json】\n${source}\n\n【質問】\n${prompt}`;

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: "あなたは提供された資料に基づいてのみ回答するアシスタントです。資料に記載のない情報については「資料に記載がありません」と答え、推測で答えないでください。" }]
        },
        contents: [{
          parts: [{ text: combinedText }]
        }]
      })
    }
  );

  const data: any = await geminiRes.json();

  if (!geminiRes.ok) {
    return Response.json(
      { error: data.error?.message || `Gemini API error: ${geminiRes.status}` },
      { status: geminiRes.status }
    );
  }

  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "（回答なし）";
  return Response.json({ reply });
};
