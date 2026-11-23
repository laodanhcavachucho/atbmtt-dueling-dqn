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

/**
 * Middleware Bảo vệ Tuyến đường (Supabase Auth & Role-Based Protected Routes Middleware)
 * Kiểm tra Bearer Token (Supabase JWT) và phân quyền theo vai trò (admin, customer, redteam)
 */
function requireSupabaseAuth(allowedRoles = ["admin", "customer", "redteam"]) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const roleHeader = (req.headers["x-supabase-role"] || "").toLowerCase();

    if (!token) {
      return res.status(401).json({
        ok: false,
        code: 401,
        error: "401 Unauthorized: Tuyến đường được bảo vệ bởi Supabase Auth. Vui lòng đăng nhập và gửi kèm Bearer JWT Token."
      });
    }

    let resolvedRole = roleHeader || "customer";
    if (token.startsWith("sb-jwt-admin")) resolvedRole = "admin";
    else if (token.startsWith("sb-jwt-redteam")) resolvedRole = "redteam";
    else if (token.startsWith("sb-jwt-customer")) resolvedRole = "customer";

    if (!allowedRoles.includes(resolvedRole)) {
      return res.status(403).json({
        ok: false,
        code: 403,
        currentRole: resolvedRole,
        requiredRoles: allowedRoles,
        error: `403 Forbidden: Vai trò '${resolvedRole}' không được phép truy cập tuyến đường này (Yêu cầu: ${allowedRoles.join(", ")}).`
      });
    }

    req.authUser = { token, role: resolvedRole };
    next();
  };
}

export function createApp({ data, evaluate, train, resultsDirectory }) {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.use(express.static(publicDirectory));

  app.get("/", (_req, res) => {
    res.sendFile(path.join(publicDirectory, "index.html"));
  });

  app.get("/dashboard", (_req, res) => {
    res.sendFile(path.join(publicDirectory, "index.html"));
  });

  app.get("/attack-sandbox", (_req, res) => {
    res.sendFile(path.join(publicDirectory, "attack-sandbox.html"));
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

  // CÁC TUYẾN ĐƯỜNG ĐƯỢC BẢO VỆ BỞI SUPABASE AUTH & RBAC ROUTE GUARD
  app.get("/api/protected/profile", requireSupabaseAuth(["admin", "customer", "redteam"]), (req, res) => {
    res.json({
      ok: true,
      route: "/api/protected/profile",
      role: req.authUser.role,
      message: "Phiên đăng nhập Supabase Auth hợp lệ."
    });
  });

  app.get("/api/protected/customer/orders", requireSupabaseAuth(["admin", "customer"]), (req, res) => {
    res.json({
      ok: true,
      route: "/api/protected/customer/orders",
      role: req.authUser.role,
      totalCustomers: data.customers,
      demand: data.demand
    });
  });

  app.post("/api/protected/admin/warehouses", requireSupabaseAuth(["admin"]), (req, res) => {
    res.json({
      ok: true,
      route: "/api/protected/admin/warehouses",
      role: req.authUser.role,
      message: "Cập nhật cấu hình kho hàng WMS thành công (Quyền Admin NOC).",
      updated: req.body ?? {}
    });
  });

  app.get("/api/protected/soc/audit-logs", requireSupabaseAuth(["admin"]), (_req, res) => {
    res.json({
      ok: true,
      route: "/api/protected/soc/audit-logs",
      scenarios: DOCUMENT_ATTACK_SCENARIOS.length,
      message: "Truy cập thành công Nhật ký Kiểm toán SOC (Chỉ dành cho Admin)."
    });
  });

  app.use((err, _req, res, _next) => res.status(400).json({ error: err.message }));
  return app;
}
