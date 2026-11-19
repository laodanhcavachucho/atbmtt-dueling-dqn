import express from "express";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectState } from "../defenses/input-sanitizer.js";
import { DOCUMENT_ATTACK_SCENARIOS, evaluateDocumentScenarios } from "../evaluation/document-scenarios.js";
import { WarehouseEnv } from "../environment/warehouse-env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(__dirname, "..", "..", "public");

function inspectImportedState(state, data) {
  const result = inspectState(state, { warehouses: data.warehouses, customers: data.customers });
  return { accepted: result.accepted, category: result.category, reasons: result.reasons };
}

export function createApp({ data, evaluate, train, resultsDirectory }) {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.use(express.static(publicDirectory));

  app.get("/", (_req, res) => {
    res.sendFile(path.join(publicDirectory, "index.html"));
  });

  app.get("/health", (_req, res) => res.json({ ok: true, service: "secure-cwlp-agent" }));
  app.get("/data", (_req, res) =>
    res.json({ warehouses: data.warehouses, customers: data.customers, source: data.source })
  );

  app.get("/api/scenarios", (_req, res) => {
    res.json({ scenarios: DOCUMENT_ATTACK_SCENARIOS });
  });

  app.post("/api/scenarios/evaluate", (req, res, next) => {
    try {
      const input = z
        .object({
          scenario: z.string().default("open_status_spoofing"),
          episodes: z.number().int().min(1).max(50).default(5),
          epsilon: z.number().min(0).max(1).default(0.15)
        })
        .parse(req.body ?? {});
      const result = evaluateDocumentScenarios(() => new WarehouseEnv(data), input);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/demo/junk-attack", async (_req, res, next) => {
    try {
      res
        .type("application/json")
        .send(await fs.readFile(`${resultsDirectory}/../data/junk-attack.json`, "utf8"));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/import", async (req, res, next) => {
    try {
      const input = z
        .object({
          filename: z.string().min(1).max(200),
          content: z.string().max(100000)
        })
        .parse(req.body ?? {});
      let payload;
      try {
        payload = JSON.parse(input.content);
      } catch {
        return res.status(400).json({ error: "Tệp không phải định dạng JSON hợp lệ" });
      }
      const states = Array.isArray(payload?.states) ? payload.states : [];
      const findings = states.map((entry, index) => ({
        id: entry?.id || `ban-ghi-${index + 1}`,
        ...inspectImportedState(entry?.state, data)
      }));
      const rejected = findings.filter((finding) => !finding.accepted);
      res.json({
        status: rejected.length ? "rejected" : "accepted",
        filename: input.filename,
        message: rejected.length
          ? `Đã chặn ${rejected.length}/${findings.length} bản ghi không an toàn.`
          : "Dữ liệu được chấp nhận.",
        findings
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/train", async (req, res, next) => {
    try {
      const { episodes = 20 } = z
        .object({ episodes: z.number().int().min(1).max(1000).optional() })
        .parse(req.body ?? {});
      res.json(await train(episodes));
    } catch (e) {
      next(e);
    }
  });

  app.post("/evaluate/:mode", async (req, res, next) => {
    try {
      if (!["baseline", "attack", "defense"].includes(req.params.mode))
        return res.status(400).json({ error: "Chế độ không được hỗ trợ" });
      res.json(await evaluate(req.params.mode));
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/run", async (req, res, next) => {
    try {
      const input = z
        .object({
          mode: z.enum(["baseline", "attack", "defense"]),
          episodes: z.number().int().min(1).max(100).default(5),
          epsilon: z.number().min(0).max(1).default(0.1)
        })
        .parse(req.body ?? {});
      res.json(await evaluate(input.mode, input));
    } catch (error) {
      next(error);
    }
  });

  app.get("/results", (_req, res) =>
    res.json({ message: "Hãy chạy đánh giá để tạo kết quả" })
  );

  app.get("/api/results", async (_req, res, next) => {
    try {
      res.json(JSON.parse(await fs.readFile(`${resultsDirectory}/metrics.json`, "utf8")));
    } catch (error) {
      next(error);
    }
  });

  app.use((err, _req, res, _next) => res.status(400).json({ error: err.message }));
  return app;
}
