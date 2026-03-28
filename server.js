import express from "express";
import cors from "cors";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);


const frontendPath = path.join(__dirname, "frontend");

console.log("Frontend path:", frontendPath);

// Serve static files
app.use(express.static(frontendPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

function hfHeaders() {
  return {
    Authorization: `Bearer ${process.env.HF_TOKEN}`,
    "Content-Type": "application/json",
  };
}


app.post("/api/story", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt?.trim()) {
    return res.status(400).json({ story: "Prompt is required." });
  }

  if (!prompt.toLowerCase().includes("story")) {
    return res.json({
      story: "This application only generates stories. Please include the word 'story' in your prompt.",
    });
  }

  try {
    const response = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        method: "POST",
        headers: hfHeaders(),
        body: JSON.stringify({
          model: "openai/gpt-oss-120b:cerebras",
          messages: [
            {
              role: "system",
              content:
                "You are a master storyteller. Write vivid, immersive short stories with strong narrative arcs. Use sensory details and emotional depth. Never use bullet points or asterisks.",
            },
            {
              role: "user",
              content: `Write an engaging short story (around 200 words) about: ${prompt}. Make it vivid and captivating.`,
            },
          ],
          temperature: 0.9,
          max_tokens: 600,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("HF Story Error:", data);
      return res.status(response.status).json({
        story: `API Error: ${data.error?.message || data.error || "Unknown error"}`,
      });
    }

    const story = data.choices?.[0]?.message?.content?.trim() || "No story generated.";
    res.json({ story });

  } catch (err) {
    console.error("Story server error:", err);
    res.status(500).json({ story: "Server error: " + err.message });
  }
});

// APi for image
app.post("/api/image", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt?.trim()) {
    return res.status(400).json({ image: null, error: "Prompt required" });
  }

  const enhancedPrompt = `cinematic fantasy illustration, ${prompt}, dramatic lighting, rich colors, detailed, 4k, award-winning art`;

  try {
    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0",
      {
        method: "POST",
        headers: hfHeaders(),
        body: JSON.stringify({
          inputs: enhancedPrompt,
          parameters: {
            num_inference_steps: 25,
            guidance_scale: 7.5,
          },
        }),
      }
    );

    console.log("Image API status:", response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error("HF Image Error:", text);
      return res.json({ image: null });
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    res.json({ image: `data:image/png;base64,${base64}` });

  } catch (err) {
    console.error("Image server error:", err);
    res.json({ image: null });
  }
});


app.use((req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BrainWare Tales running at http://localhost:${PORT}`);
});
