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

const REALTIME_SCRAPE_PLATFORMS = new Set([
  "shopgoodwill",
  "1stdibs",
  "rebag",
  "grailed",
  "fashionphile",
  "watchbox",
  "chronext"
]);

export async function ensureMarketplaceConfigs() {
  for (const platform of DEFAULT_MARKETPLACES) {
    const apiType = platform === "ebay" ? "public_rest" : REALTIME_SCRAPE_PLATFORMS.has(platform) ? "realtime_scrape" : "partner_rest";
    const rateLimitPerMinute = REALTIME_SCRAPE_PLATFORMS.has(platform) ? 20 : 60;
    await prisma.marketplaceConfig.upsert({
      where: { platform },
      create: {
        platform,
        isActive: true,
        apiType,
        baseUrl: null,
        rateLimitPerMinute
      },
      update: {
        apiType,
        rateLimitPerMinute
      }
    });
  }
}
