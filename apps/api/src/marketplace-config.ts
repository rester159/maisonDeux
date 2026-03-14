import { prisma } from "./prisma";

const DEFAULT_MARKETPLACES = [
  "ebay",
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
  const existing = await prisma.marketplaceConfig.count();
  if (existing > 0) return;

  await prisma.marketplaceConfig.createMany({
    data: DEFAULT_MARKETPLACES.map((platform) => ({
      platform,
      isActive: true,
      apiType: platform === "ebay" ? "public_rest" : "partner_rest",
      baseUrl: null,
      rateLimitPerMinute: 60
    }))
  });
}
