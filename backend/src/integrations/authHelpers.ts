export function buildAuthHeaders(config: {
  authType?: string | null;
  authHeader?: string | null;
  authValue?: string | null;
}): Record<string, string> {
  const headers: Record<string, string> = {};

  if (!config.authType || config.authType === 'none' || !config.authValue) {
    return headers;
  }

  if (config.authType === 'basic') {
    headers['Authorization'] = `Basic ${Buffer.from(config.authValue).toString('base64')}`;
  } else if (config.authType === 'bearer') {
    headers['Authorization'] = `Bearer ${config.authValue}`;
  } else if (config.authType === 'api_key' && config.authHeader) {
    headers[config.authHeader] = config.authValue;
  }

  return headers;
}
