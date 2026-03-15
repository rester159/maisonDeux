type TokenState = {
  value: string | null;
  expiresAtEpochMs: number;
};

const tokenState: TokenState = {
  value: null,
  expiresAtEpochMs: 0
};

function fromEnvToken(): string | null {
  return process.env.EBAY_OAUTH_TOKEN ?? null;
}

function ebayEnvironment(): "production" | "sandbox" {
  return String(process.env.EBAY_ENVIRONMENT ?? "production").toLowerCase() === "sandbox"
    ? "sandbox"
    : "production";
}

function ebayIdentityBaseUrl(): string {
  return ebayEnvironment() === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

export async function getEbayAccessToken(): Promise<string | undefined> {
  const envToken = fromEnvToken();
  if (envToken) return envToken;

  if (tokenState.value && tokenState.expiresAtEpochMs > Date.now() + 60_000) {
    return tokenState.value;
  }

  const clientId = process.env.EBAY_APP_ID;
  const clientSecret = process.env.EBAY_CERT_ID;
  if (!clientId || !clientSecret) return undefined;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "https://api.ebay.com/oauth/api_scope"
  });

  const response = await fetch(`${ebayIdentityBaseUrl()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  if (!response.ok) return undefined;
  const json = (await response.json()) as { access_token: string; expires_in: number };
  tokenState.value = json.access_token;
  tokenState.expiresAtEpochMs = Date.now() + json.expires_in * 1000;
  return tokenState.value;
}
