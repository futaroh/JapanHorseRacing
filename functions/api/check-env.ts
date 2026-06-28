interface Env {
  GEMINI_API_KEY: string;
}

export const onRequestGet: PagesFunction<Env> = (ctx) => {
  const key = ctx.env.GEMINI_API_KEY;
  if (key) {
    return Response.json({
      status: "ok",
      message: "GEMINI_API_KEY is set",
      preview: key.slice(0, 6) + "..." + key.slice(-4),
    });
  } else {
    return Response.json({
      status: "error",
      message: "GEMINI_API_KEY is not set",
    }, { status: 500 });
  }
};
