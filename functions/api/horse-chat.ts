interface Env {
  GEMINI_API_KEY: string;
}

interface HorseChatRequest {
  prompt: string;
  context: string;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const apiKey = ctx.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "APIキーが設定されていません" }, { status: 500 });
  }

  let body: HorseChatRequest;
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }

  const { prompt, context } = body;
  if (!prompt || !context) {
    return Response.json({ error: "prompt・context はすべて必須です" }, { status: 400 });
  }

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `あなたは競馬AI予想アシスタントです。**必ず以下の「提供データ」の範囲内のみで回答してください。**データに記載のない情報（他のレース、他の馬、推測・予測など）は一切使用せず、「提供データには記載がありません」と答えてください。競馬初心者にもわかりやすく、簡潔な日本語で答えてください。\n\n【提供データ】\n${context}` }]
        },
        contents: [{
          parts: [{ text: prompt }]
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
