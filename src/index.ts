import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { chat } from "@tanstack/ai";
import { geminiText } from "@tanstack/ai-gemini";
import { cors } from "hono/cors";

const app = new Hono();

app.use(cors({ origin: "*" }));

const fixSpellingSchema = z.object({
  text: z.string().min(1),
});

app.post(
  "/fix-my-spelling",
  zValidator("json", fixSpellingSchema),
  async (c) => {
    const { text } = c.req.valid("json");

    const result = await chat({
      adapter: geminiText("gemini-3-flash-preview"),
      messages: [
        {
          role: "user",
          content: `Fix the spelling and grammar in the following text. Only return the corrected text, nothing else:\n\n${text}`,
        },
      ],
      stream: false,
    });

    return c.json({ corrected: result });
  },
);

export default app;
