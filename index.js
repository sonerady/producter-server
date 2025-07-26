require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 4000;
const REPLICATE_API_TOKEN =
  process.env.REPLICATE_API_TOKEN || "your-token-here";

if (!process.env.REPLICATE_API_TOKEN) {
  console.warn(
    "⚠️  REPLICATE_API_TOKEN environment variable not set. Please set it before starting the server."
  );
}

console.log("REPLICATE_API_TOKEN", REPLICATE_API_TOKEN);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "20mb" }));

app.post("/replicate", async (req, res) => {
  try {
    console.log("📨 Request received:", {
      prompt: req.body.prompt?.substring(0, 100) + "...",
      hasImage: !!req.body.input_image,
    });

    const { prompt, input_image } = req.body;
    const input = {
      prompt,
      guidance: 2.5,
      megapixels: "1",
      input_image,
      aspect_ratio: "match_input_image",
      lora_strength: 1,
      output_format: "webp",
      output_quality: 100,
      num_inference_steps: 30,
      lora_weights:
        "https://replicate.delivery/xezq/9cGqCafl9wQMVS0WwkAAvFg0tT5hBTHOseO1YJCKFw3qRbEVA/flux-lora.tar",
    };

    console.log("🚀 Sending to Replicate API with model-specific endpoint...");

    // Model-specific endpoint ve Prefer: wait header kullan
    const response = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-dev-lora/predictions",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          input: input,
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("❌ Replicate API error details:", {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
      });
      throw new Error(`Replicate API error: ${response.status} - ${errorBody}`);
    }

    const result = await response.json();

    console.log("✅ Replicate response received:", {
      status: result.status,
      outputType: typeof result.output,
      outputValue: result.output,
    });

    if (
      result.status === "succeeded" ||
      (result.status === "processing" && result.output)
    ) {
      const responseData = { output: result.output };
      console.log("📤 Sending response:", responseData);
      res.json(responseData);
    } else if (result.status === "failed") {
      throw new Error(`Prediction failed: ${result.error || "Unknown error"}`);
    } else {
      throw new Error(
        `Prediction status: ${result.status} - ${
          result.error || "Waiting for completion"
        }`
      );
    }
  } catch (err) {
    console.error("❌ Proxy error:", err);
    res.status(500).json({ error: "Proxy error", detail: err.message });
  }
});

app.post("/background-remover", async (req, res) => {
  try {
    console.log("🖼️ Background remover request received:", {
      hasImageUrl: !!req.body.image_url,
    });

    const { image_url } = req.body;

    const input = {
      image: image_url,
      format: "png",
      reverse: false,
      threshold: 0,
      background_type: "rgba",
    };

    console.log("🚀 Sending to Replicate Background Remover API...");

    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        version:
          "851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc",
        input: input,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("❌ Background Remover API error details:", {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
      });
      throw new Error(
        `Background Remover API error: ${response.status} - ${errorBody}`
      );
    }

    const result = await response.json();

    console.log("✅ Background Remover response received:", {
      status: result.status,
      outputType: typeof result.output,
      outputValue: result.output,
    });

    if (
      result.status === "succeeded" ||
      (result.status === "processing" && result.output)
    ) {
      const responseData = { output: result.output };
      console.log("📤 Sending background remover response:", responseData);
      res.json(responseData);
    } else if (result.status === "failed") {
      throw new Error(
        `Background removal failed: ${result.error || "Unknown error"}`
      );
    } else {
      throw new Error(
        `Background removal status: ${result.status} - ${
          result.error || "Waiting for completion"
        }`
      );
    }
  } catch (err) {
    console.error("❌ Background remover proxy error:", err);
    res
      .status(500)
      .json({ error: "Background remover proxy error", detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🟢 Replicate proxy listening on http://localhost:${PORT}`);
  console.log(
    `🔑 Using API token: ${REPLICATE_API_TOKEN ? "***masked***" : "NOT SET"}`
  );
});
