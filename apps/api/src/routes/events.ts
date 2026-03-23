/**
 * @file routes/events.ts
 * @description Stores user clickstream events for recommendation engine and analytics.
 */

import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma";

interface EventPayload {
  userId?: string;
  sessionId?: string;
  events: Array<{
    category: string;
    action: string;
    label?: string;
    value?: number;
    productTitle?: string;
    productBrand?: string;
    productPrice?: number;
    productPlatform?: string;
    productUrl?: string;
    metadata?: Record<string, any>;
    ts?: number;
  }>;
}

export default async function eventsRoutes(app: FastifyInstance) {
  // POST /api/events — batch insert user events
  app.post<{ Body: EventPayload }>("/api/events", async (request, reply) => {
    const body = request.body;
    if (!body?.events?.length) {
      return reply.status(400).send({ error: "No events provided" });
    }

    const userId = body.userId || "anonymous";
    const sessionId = body.sessionId || null;

    try {
      // Batch insert using a transaction.
      const values: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      for (const evt of body.events.slice(0, 100)) {
        values.push(
          `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}::jsonb, $${paramIdx++}::timestamptz)`
        );
        params.push(
          userId,
          sessionId,
          evt.category || "",
          evt.action || "",
          evt.label || null,
          evt.value ?? null,
          evt.productTitle || null,
          evt.productBrand || null,
          evt.productPrice ?? null,
          evt.productPlatform || null,
          JSON.stringify(evt.metadata || {}),
          evt.ts ? new Date(evt.ts).toISOString() : new Date().toISOString()
        );
      }

      const sql = `INSERT INTO user_events (user_id, session_id, event_category, event_action, event_label, event_value, product_title, product_brand, product_price, product_platform, metadata, created_at) VALUES ${values.join(", ")}`;

      await prisma.$executeRawUnsafe(sql, ...params);

      return reply.send({ ok: true, inserted: body.events.length });
    } catch (err: any) {
      app.log.error(err, "Failed to insert events");
      return reply.status(500).send({ error: "DB insert failed" });
    }
  });

  // GET /api/events/analytics — aggregate analytics for dev dashboard
  app.get("/api/events/analytics", async (request, reply) => {
    try {
      // Daily active users (last 30 days).
      const dau = await prisma.$queryRawUnsafe(`
        SELECT DATE(created_at) as day, COUNT(DISTINCT user_id) as users, COUNT(*) as events
        FROM user_events
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY day DESC
      `) as any[];

      // Event breakdown.
      const breakdown = await prisma.$queryRawUnsafe(`
        SELECT event_category, event_action, COUNT(*) as count
        FROM user_events
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY event_category, event_action
        ORDER BY count DESC
        LIMIT 50
      `) as any[];

      // Favorites stats.
      const favStats = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as total_saves,
               COUNT(DISTINCT user_id) as users_who_saved,
               AVG(ct) as avg_per_user
        FROM (
          SELECT user_id, COUNT(*) as ct
          FROM user_events
          WHERE event_action = 'saved' AND event_category = 'favorite'
          GROUP BY user_id
        ) sub
      `) as any[];

      // Top platforms clicked.
      const topPlatforms = await prisma.$queryRawUnsafe(`
        SELECT product_platform, COUNT(*) as clicks
        FROM user_events
        WHERE product_platform IS NOT NULL AND product_platform != ''
        GROUP BY product_platform
        ORDER BY clicks DESC
        LIMIT 10
      `) as any[];

      // Funnel: product_detected → search_started → deal_clicked → favorite_saved
      const funnel = await prisma.$queryRawUnsafe(`
        SELECT
          SUM(CASE WHEN event_action = 'detected' THEN 1 ELSE 0 END) as products_detected,
          SUM(CASE WHEN event_action = 'search_started' THEN 1 ELSE 0 END) as searches,
          SUM(CASE WHEN event_action = 'save_clicked' THEN 1 ELSE 0 END) as deal_clicks,
          SUM(CASE WHEN event_action = 'saved' THEN 1 ELSE 0 END) as favorites_saved,
          SUM(CASE WHEN event_action = 'generated' AND event_category = 'condition_report' THEN 1 ELSE 0 END) as condition_reports
        FROM user_events
        WHERE created_at > NOW() - INTERVAL '30 days'
      `) as any[];

      return reply.send({
        dau,
        breakdown,
        favStats: favStats[0] || {},
        topPlatforms,
        funnel: funnel[0] || {},
      });
    } catch (err: any) {
      app.log.error(err, "Failed to read analytics");
      return reply.status(500).send({ error: "Analytics query failed" });
    }
  });
}
