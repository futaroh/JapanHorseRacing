interface Env {
  GEMINI_API_KEY: string;
}

interface HorseChatRequest {
  prompt: string;
  context: string; // JSON文字列
}

function jsonToText(raw: string): string {
  let d: any;
  try {
    d = JSON.parse(raw);
  } catch {
    return raw; // パース失敗時はそのまま返す
  }

  const lines: string[] = [];
  const r = d["レース"] ?? {};

  lines.push(`## レース概要`);
  lines.push(`${r["回次"] ?? ""}${r["レース名"] ?? ""} ${r["グレード"] ?? ""}`);
  lines.push(`開催日：${r["開催日"] ?? ""} / コース：${r["コース"] ?? ""} / 馬場：${r["天候馬場"] ?? ""}`);
  lines.push(`条件：${r["条件詳細"] ?? ""} / 類似レース分析件数：${r["類似レース数"] ?? ""}件`);
  lines.push("");

  // 注目馬
  const picks: any[] = d["総合まとめ"]?.["注目馬"] ?? [];
  if (picks.length) {
    lines.push(`## 注目馬`);
    for (const h of picks) {
      lines.push(`${h["記号"]} ${h["馬名"]}（${h["馬番"]}番）${h["性齢"]} / ${h["騎手"]} / ${h["人気"]}番人気 単勝${h["単勝オッズ"]}倍 複勝${h["複勝オッズ"]}倍`);
      lines.push(`  → ${h["コメント"]}`);
    }
    lines.push("");
  }

  // 出馬表
  const entries: any[] = d["出馬表"] ?? [];
  if (entries.length) {
    lines.push(`## 出馬表（人気順）`);
    const sorted = [...entries].sort((a, b) => (a["人気"] ?? 99) - (b["人気"] ?? 99));
    for (const h of sorted) {
      lines.push(`${h["人気"]}番人気 ⑤${h["馬番"]}番 ${h["馬名"]}（${h["性齢"]} ${h["斤量"]}kg）/ ${h["騎手"]} / 単勝${h["単勝オッズ"]}倍 複勝${h["複勝オッズ低"]}〜${h["複勝オッズ高"]}倍`);
    }
    lines.push("");
  }

  // 期待値分析
  const odds = d["オッズ分析"] ?? {};

  const tanshoPop: any[] = odds["単勝人気別期待値"] ?? [];
  if (tanshoPop.length) {
    lines.push(`## 単勝 人気別期待値`);
    for (const row of tanshoPop) {
      lines.push(`${row["人気"]}番人気 ${row["馬名"]} 単勝${row["単勝オッズ"]}倍 / 勝率${row["確率"]} / 期待値${row["期待値"]} ${row["評価"]}`);
    }
    lines.push("");
  }

  const fukshouPop: any[] = odds["複勝人気別期待値"] ?? [];
  if (fukshouPop.length) {
    lines.push(`## 複勝 人気別期待値`);
    for (const row of fukshouPop) {
      lines.push(`${row["人気"]}番人気 ${row["馬名"]} 複勝${row["複勝オッズ"]}倍 / 複勝率${row["確率"]} / 期待値${row["期待値"]} ${row["評価"]}`);
    }
    lines.push("");
  }

  // 馬連
  const umaren = d["馬連分析"] ?? {};
  const umarenOdds: any[] = umaren["馬連オッズ低い順"] ?? [];
  if (umarenOdds.length) {
    lines.push(`## 馬連オッズ上位`);
    for (const row of umarenOdds.slice(0, 10)) {
      lines.push(`${row["順位"]}位 ${row["馬名"]} ${row["オッズ"]}倍`);
    }
    lines.push("");
  }

  const umarenPlan: string = umaren["推奨購入プラン"] ?? "";
  if (umarenPlan) {
    lines.push(`## 馬連推奨プラン`);
    lines.push(umarenPlan);
    lines.push("");
  }

  // 三連複
  const sanren = d["三連複分析"] ?? {};
  const sanrenEV: any[] = sanren["期待値分析"] ?? [];
  if (sanrenEV.length) {
    lines.push(`## 三連複 期待値分析`);
    for (const row of sanrenEV) {
      lines.push(`${row["戦略"]} / 的中率${row["的中率"]} / 期待値${row["期待値"]} ${row["評価"]}`);
    }
    lines.push("");
  }

  // 推奨戦略
  const strategies: any[] = d["推奨購入戦略"] ?? [];
  if (strategies.length) {
    lines.push(`## 推奨購入戦略`);
    for (const s of strategies) {
      lines.push(`[${s["ランク"]}] ${s["タイトル"]}`);
      lines.push(`  ${s["詳細"]}`);
    }
    lines.push("");
  }

  // 総括
  const conclusion: string = d["総括"]?.["本文"] ?? d["総括"] ?? "";
  if (conclusion) {
    lines.push(`## 総括`);
    lines.push(typeof conclusion === "string" ? conclusion : JSON.stringify(conclusion));
    lines.push("");
  }

  // 過去10年同レース
  const history: any[] = d["過去10年同レース"]?.["結果一覧"] ?? [];
  if (history.length) {
    lines.push(`## 過去10年 同レース結果`);
    for (const h of history) {
      lines.push(`${h["開催年"]} 1着：${h["1着人気"]} ${h["1着馬名"]} 単勝${h["単勝"]}倍 馬連${h["馬連"]}倍 三連複${h["三連複"]}倍`);
    }
    lines.push("");
  }

  const text = lines.join("\n").trim();
  // フォールバック：変換後が短すぎる場合は生JSONを返す
  return text.length > 200 ? text : raw;
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
    return Response.json({ error: "prompt・context は必須です" }, { status: 400 });
  }

  const readableContext = jsonToText(context);

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `あなたは競馬AI予想アシスタントです。以下の【レースデータ】のみをもとに回答してください。データにない情報は「データに記載がありません」と答え、他のレースや推測を混ぜないでください。競馬初心者にもわかりやすく、簡潔な日本語で答えてください。\n\n【レースデータ】\n${readableContext}` }]
        },
        contents: [{ parts: [{ text: prompt }] }]
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
