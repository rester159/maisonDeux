/**
 * @file routes/extension-settings.ts
 * @description Persists Chrome extension API keys and preferences in Neon DB
 * so they survive extension reinstalls. No auth required — keyed by device ID.
 */

import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma";

export default async function extensionSettingsRoutes(app: FastifyInstance) {
  // GET /api/extension-settings/:deviceId
  app.get<{ Params: { deviceId: string } }>(
    "/api/extension-settings/:deviceId",
    async (request, reply) => {
      const { deviceId } = request.params;
      if (!deviceId || deviceId.length < 8) {
        return reply.status(400).send({ error: "Invalid device ID" });
      }

      try {
        const result = await prisma.$queryRawUnsafe(
          `SELECT ebay_app_id, ebay_cert_id, serpapi_key, anthropic_key, openai_key, ai_provider, ai_model, preferences
           FROM user_settings WHERE id = $1`,
          deviceId
        ) as any[];

        if (!result || result.length === 0) {
          return reply.send({ found: false, settings: {} });
        }

        const row = result[0];
        return reply.send({
          found: true,
          settings: {
            ebayAppId: row.ebay_app_id || "",
            ebayCertId: row.ebay_cert_id || "",
            serpapiKey: row.serpapi_key || "",
            anthropicKey: row.anthropic_key || "",
            openaiKey: row.openai_key || "",
            aiProvider: row.ai_provider || "openai",
            aiModel: row.ai_model || "gpt-4o",
            preferences: row.preferences || {},
          },
        });
      } catch (err: any) {
        app.log.error(err, "Failed to read extension settings");
        return reply.status(500).send({ error: "DB read failed" });
      }
    }
  );

  // PUT /api/extension-settings/:deviceId
  app.put<{ Params: { deviceId: string }; Body: any }>(
    "/api/extension-settings/:deviceId",
    async (request, reply) => {
      const { deviceId } = request.params;
      if (!deviceId || deviceId.length < 8) {
        return reply.status(400).send({ error: "Invalid device ID" });
      }

      const body = request.body as any;

      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO user_settings (id, ebay_app_id, ebay_cert_id, serpapi_key, anthropic_key, openai_key, ai_provider, ai_model, preferences)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
           ON CONFLICT (id) DO UPDATE SET
             ebay_app_id = COALESCE(NULLIF($2, ''), user_settings.ebay_app_id),
             ebay_cert_id = COALESCE(NULLIF($3, ''), user_settings.ebay_cert_id),
             serpapi_key = COALESCE(NULLIF($4, ''), user_settings.serpapi_key),
             anthropic_key = COALESCE(NULLIF($5, ''), user_settings.anthropic_key),
             openai_key = COALESCE(NULLIF($6, ''), user_settings.openai_key),
             ai_provider = COALESCE(NULLIF($7, ''), user_settings.ai_provider),
             ai_model = COALESCE(NULLIF($8, ''), user_settings.ai_model),
             preferences = COALESCE($9::jsonb, user_settings.preferences),
             updated_at = NOW()`,
          deviceId,
          body.ebayAppId || "",
          body.ebayCertId || "",
          body.serpapiKey || "",
          body.anthropicKey || "",
          body.openaiKey || "",
          body.aiProvider || "",
          body.aiModel || "",
          JSON.stringify(body.preferences || {})
        );

        return reply.send({ ok: true });
      } catch (err: any) {
        app.log.error(err, "Failed to save extension settings");
        return reply.status(500).send({ error: "DB write failed" });
      }
    }
  );
}
