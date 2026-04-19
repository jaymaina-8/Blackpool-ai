type LtxErrorJson = {
  type?: string;
  error?: { type?: string; message?: string };
};

export function parseLtxErrorBody(text: string): string | null {
  try {
    const j = JSON.parse(text) as LtxErrorJson;
    const msg = j.error?.message?.trim();
    if (msg) return msg;
  } catch {
    /* ignore */
  }
  return null;
}

export function mapLtxHttpError(status: number, bodyText: string): string {
  const parsed = parseLtxErrorBody(bodyText);
  if (parsed) return parsed;

  switch (status) {
    case 400:
      return "LTX rejected the request (invalid input).";
    case 401:
      return "LTX authentication failed (check server API key).";
    case 422:
      return "LTX rejected the content (safety filters).";
    case 429:
      return "LTX rate limit exceeded. Try again later.";
    case 504:
      return "LTX request timed out at the provider.";
    default:
      return `LTX request failed (${status}).`;
  }
}
