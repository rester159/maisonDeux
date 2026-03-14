import { prisma } from "./prisma";

const DEFAULT_MARKETPLACES = [
  "ebay",
  "shopgoodwill",
  "therealreal",
  "vestiaire",
  "chrono24",
  "1stdibs",
  "rebag",
  "grailed",
  "fashionphile",
  "watchbox",
  "chronext"
] as const;

export async function ensureMarketplaceConfigs() {
  for (const platform of DEFAULT_MARKETPLACES) {
    await prisma.marketplaceConfig.upsert({
      where: { platform },
      create: {
        platform,
        isActive: true,
        apiType: platform === "ebay" ? "public_rest" : platform === "shopgoodwill" ? "realtime_scrape" : "partner_rest",
        baseUrl: null,
        rateLimitPerMinute: platform === "shopgoodwill" ? 20 : 60
      },
      update: {
        apiType: platform === "ebay" ? "public_rest" : platform === "shopgoodwill" ? "realtime_scrape" : "partner_rest",
        rateLimitPerMinute: platform === "shopgoodwill" ? 20 : 60
      }
    });
  }
}
