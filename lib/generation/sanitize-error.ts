// Redact before truncation so no partial credential can survive a length cap.
export function sanitizeProviderError(value: unknown, apiKey: string): string {
  const message=value instanceof Error?value.message:typeof value==='string'?value:'Provider request failed';
  return (apiKey?message.split(apiKey).join('[REDACTED]'):message)
    .replace(/AIza[\w-]+/g,'[REDACTED]')
    .replace(/(Bearer\s+)[^\s"',}]+/gi,'$1[REDACTED]')
    .replace(/([?&](?:key|api_key|token)=)[^&\s"']+/gi,'$1[REDACTED]')
    .slice(0,8000);
}
