import { Prisma } from "@prisma/client";
import { buildSearchQuery, computeTrustScore, type CanonicalListing, type ListingCategory } from "@luxefinder/shared";
import { getTierOneAdapters, type RuntimeCredentials } from "../adapters";
import { prisma } from "../prisma";
import { analyzeImage, defaultTextAnalysis } from "./vision";
import { getEbayAccessToken } from "./ebay-token";
import { waitForRateLimitSlot, parseRateLimitWaitMs } from "./rate-limit";
import { withRetry } from "./retry";
import { incrementMetric, setGauge } from "./metrics";

export function scoreRelevance(query: string, listing: CanonicalListing): number {
  const q = query.toLowerCase();
  const title = listing.title.toLowerCase();
  const brand = listing.brand.toLowerCase();
  let score = 0;
  if (title.includes(q)) score += 0.55;
  if (q.split(" ").some((part) => part.length > 2 && title.includes(part))) score += 0.2;
  if (q.includes(brand) || brand.includes(q.split(" ")[0] ?? "")) score += 0.15;
  score += (listing.trust_score / 100) * 0.1;
  return Math.min(1, score);
}

export function getMarketAveragePrice(listings: CanonicalListing[]): number {
  if (!listings.length) return 0;
  return listings.reduce((acc, current) => acc + current.price_usd, 0) / listings.length;
}

export function shouldRetryAdapter(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (parseRateLimitWaitMs(error) !== null) return true;
  return (
    error.message.includes("429") ||
    error.message.includes("502") ||
    error.message.includes("503") ||
    error.message.includes("504") ||
    error.message.toLowerCase().includes("timeout")
  );
}

export function resolveSearchPrecision(runtimeCredentials?: RuntimeCredentials): number {
  const raw = runtimeCredentials?.search?.precision;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 75;
  return Math.min(100, Math.max(10, Math.round(raw)));
}

export function buildQueryCandidates(query: string, precision: number): string[] {
  const clean = query.trim().replace(/\s+/g, " ");
  if (!clean) return [];
  const candidates = new Set<string>([clean]);
  const normalized = clean
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized && normalized !== clean.toLowerCase()) candidates.add(normalized);

  const tokens = normalized.split(" ").filter(Boolean);
  const softWords = new Set([
    "small",
    "mini",
    "medium",
    "large",
    "authentic",
    "vintage",
    "preowned",
    "pre-owned",
    "used",
    "excellent",
    "good",
    "condition"
  ]);
  const categoryHints = new Set(["bag", "tote", "watch", "jewelry", "shoe", "heels", "wallet", "belt"]);
  const coreTokens = tokens.filter((token) => !softWords.has(token));
  const brand = coreTokens[0];
  const categoryToken = [...coreTokens].reverse().find((token) => categoryHints.has(token));

  if (precision <= 85 && coreTokens.length >= 2) {
    candidates.add(coreTokens.slice(0, 4).join(" "));
  }
  if (precision <= 70 && coreTokens.length >= 2) {
    candidates.add(coreTokens.slice(0, 2).join(" "));
    if (brand && categoryToken) candidates.add(`${brand} ${categoryToken}`);
  }
  if (precision <= 55 && brand) {
    candidates.add(brand);
  }
  return Array.from(candidates).filter(Boolean).slice(0, 5);
}

export async function processSearch(searchId: string): Promise<void> {
  const searchStarted = Date.now();
  await incrementMetric("search_jobs_started_total");
  const search = await prisma.search.findUnique({ where: { id: searchId } });
  if (!search) return;

  await prisma.search.update({
    where: { id: searchId },
    data: { status: "processing", errorMessage: null }
  });

  try {
    const imageInput =
      search.imageBase64 && search.imageMimeType
        ? `data:${search.imageMimeType};base64,${search.imageBase64}`
        : search.imageUrl;
    const analysis = imageInput
      ? await analyzeImage(imageInput)
      : defaultTextAnalysis(search.queryText ?? "", search.queryText ? undefined : ("accessory" as ListingCategory));

    const query = search.queryText ?? buildSearchQuery(analysis);
    const ebayToken = await getEbayAccessToken();
    const runtimeCredentials = (search.runtimeCredentials ?? undefined) as RuntimeCredentials | undefined;
    const searchPrecision = resolveSearchPrecision(runtimeCredentials);
    const queryCandidates = buildQueryCandidates(query, searchPrecision);
    const adapters = getTierOneAdapters({ ebayToken, runtimeCredentials });
    const activeConfigs = await prisma.marketplaceConfig.findMany({
      where: { isActive: true },
      select: { platform: true, rateLimitPerMinute: true }
    });
    const activeSet = new Set(activeConfigs.map((entry) => entry.platform));
    const rateLimits = new Map(activeConfigs.map((entry) => [entry.platform, entry.rateLimitPerMinute ?? 60]));
    const enabledAdapters = adapters.filter((adapter) => activeSet.has(adapter.platform));

    const responses = await Promise.allSettled(
      enabledAdapters.map(async (adapter) => {
        const adapterStarted = Date.now();
        const perMinute = rateLimits.get(adapter.platform) ?? 60;
        const collected: CanonicalListing[] = [];
        let successfulCalls = 0;
        let lastError: unknown = null;
        for (const candidate of queryCandidates) {
          try {
            const batch = await withRetry(
              async () => {
                await waitForRateLimitSlot(adapter.platform, perMinute);
                return adapter.search(candidate, analysis.category);
              },
              { maxAttempts: 3, baseDelayMs: 350, maxDelayMs: 3500 },
              shouldRetryAdapter
            );
            successfulCalls += 1;
            if (batch.length) collected.push(...batch);
            if (collected.length >= 20) break;
            if (searchPrecision >= 90 && collected.length > 0) break;
          } catch (error) {
            lastError = error;
          }
        }
        if (successfulCalls === 0 && lastError) throw lastError;
        const deduped = new Map<string, CanonicalListing>();
        for (const listing of collected) {
          const key = `${listing.platform}:${listing.platform_listing_id}`;
          if (!deduped.has(key)) deduped.set(key, listing);
        }
        const listings = Array.from(deduped.values()).slice(0, 20);
        await prisma.marketplaceConfig.updateMany({
          where: { platform: adapter.platform },
          data: { lastSuccessfulCall: new Date() }
        });
        await incrementMetric(`adapter_${adapter.platform}_success_total`);
        await setGauge(`adapter_${adapter.platform}_latency_ms`, Date.now() - adapterStarted);
        return { platform: adapter.platform, listings };
      })
    );
    const listings = responses.flatMap((result) => {
      if (result.status === "fulfilled") return result.value.listings;
      return [];
    });
    await Promise.all(
      responses.map(async (result, index) => {
        if (result.status === "fulfilled") return;
        const platform = enabledAdapters[index]?.platform;
        if (!platform) return;
        await incrementMetric(`adapter_${platform}_failure_total`);
        await prisma.marketplaceConfig.updateMany({
          where: { platform },
          data: { errorCount24h: { increment: 1 } }
        });
      })
    );
    const marketAverage = getMarketAveragePrice(listings);
    listings.forEach((listing) => {
      listing.trust_score = computeTrustScore(listing, marketAverage);
    });

    const ranked = listings
      .map((listing) => ({ listing, relevance: scoreRelevance(query, listing) }))
      .sort((a, b) => b.relevance - a.relevance);

    await prisma.$transaction(async (tx) => {
      await tx.searchResult.deleteMany({ where: { searchId } });
      for (let i = 0; i < ranked.length; i += 1) {
        const entry = ranked[i];
        const listing = await tx.listing.upsert({
          where: {
            platform_platformListingId: {
              platform: entry.listing.platform,
              platformListingId: entry.listing.platform_listing_id
            }
          },
          create: {
            platform: entry.listing.platform,
            platformListingId: entry.listing.platform_listing_id,
            platformListingUrl: entry.listing.platform_listing_url,
            brand: entry.listing.brand,
            category: entry.listing.category,
            subcategory: entry.listing.subcategory,
            title: entry.listing.title,
            description: entry.listing.description,
            priceUsd: new Prisma.Decimal(entry.listing.price_usd),
            originalCurrency: entry.listing.original_currency,
            originalPrice: new Prisma.Decimal(entry.listing.original_price),
            condition: entry.listing.condition,
            conditionRaw: entry.listing.condition_raw,
            images: entry.listing.images,
            size: entry.listing.size,
            color: entry.listing.color,
            material: entry.listing.material,
            sellerRating:
              entry.listing.seller_rating !== null ? new Prisma.Decimal(entry.listing.seller_rating) : null,
            sellerSalesCount: entry.listing.seller_sales_count,
            sellerVerified: entry.listing.seller_verified,
            authenticationStatus: entry.listing.authentication_status,
            authenticationBadge: entry.listing.authentication_badge,
            listedAt: new Date(entry.listing.listed_at),
            scrapedAt: new Date(entry.listing.scraped_at),
            isAvailable: entry.listing.is_available,
            shippingAvailableUs: entry.listing.shipping_available_us,
            locationCountry: entry.listing.location_country,
            platformFeesBuyerPct:
              entry.listing.platform_fees_buyer_pct !== null
                ? new Prisma.Decimal(entry.listing.platform_fees_buyer_pct)
                : null,
            trustScore: entry.listing.trust_score
          },
          update: {
            platformListingUrl: entry.listing.platform_listing_url,
            brand: entry.listing.brand,
            category: entry.listing.category,
            subcategory: entry.listing.subcategory,
            title: entry.listing.title,
            description: entry.listing.description,
            priceUsd: new Prisma.Decimal(entry.listing.price_usd),
            originalCurrency: entry.listing.original_currency,
            originalPrice: new Prisma.Decimal(entry.listing.original_price),
            condition: entry.listing.condition,
            conditionRaw: entry.listing.condition_raw,
            images: entry.listing.images,
            size: entry.listing.size,
            color: entry.listing.color,
            material: entry.listing.material,
            sellerRating:
              entry.listing.seller_rating !== null ? new Prisma.Decimal(entry.listing.seller_rating) : null,
            sellerSalesCount: entry.listing.seller_sales_count,
            sellerVerified: entry.listing.seller_verified,
            authenticationStatus: entry.listing.authentication_status,
            authenticationBadge: entry.listing.authentication_badge,
            listedAt: new Date(entry.listing.listed_at),
            scrapedAt: new Date(entry.listing.scraped_at),
            isAvailable: entry.listing.is_available,
            shippingAvailableUs: entry.listing.shipping_available_us,
            locationCountry: entry.listing.location_country,
            platformFeesBuyerPct:
              entry.listing.platform_fees_buyer_pct !== null
                ? new Prisma.Decimal(entry.listing.platform_fees_buyer_pct)
                : null,
            trustScore: entry.listing.trust_score
          }
        });

        await tx.searchResult.create({
          data: {
            searchId,
            listingId: listing.id,
            relevanceScore: new Prisma.Decimal(entry.relevance.toFixed(4)),
            rankPosition: i + 1
          }
        });
      }

      await tx.search.update({
        where: { id: searchId },
        data: {
          imageAnalysis: analysis as unknown as Prisma.InputJsonValue,
          constructedQuery: query,
          resultCount: ranked.length,
          status: "completed",
          imageBase64: null,
          processedAt: new Date()
        }
      });
    });
    await incrementMetric("search_jobs_completed_total");
    await setGauge("last_search_duration_ms", Date.now() - searchStarted);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown search processing error";
    await prisma.search.update({
      where: { id: searchId },
      data: { status: "failed", errorMessage: message, processedAt: new Date() }
    });
    await incrementMetric("search_jobs_failed_total");
    throw error;
  }
}
