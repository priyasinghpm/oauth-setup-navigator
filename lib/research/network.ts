import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import ipaddr from 'ipaddr.js';
import { getDomain } from 'tldts';
import type { ResearchDependencies, ResolvedAddress, TransportOptions, WireResponse } from './types';
export const USER_AGENT = 'OAuthSetupNavigatorResearch/1.0';
export function publicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address);
    // Reject mapped IPv6, transition mechanisms, reserved, private and link-local ranges.
    if (parsed.kind() === 'ipv6') return parsed.range() === 'unicast' && /^([23])[0-9a-f]{0,3}:/i.test(address);
    return parsed.range() === 'unicast';
  } catch { return false; }
}
export function safeUrl(value: string, rootDomain?: string): URL {
  if (value.length > 2048) throw new Error('URL exceeds length limit');
  const url = new URL(value);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Only credential-free HTTPS on port 443 is permitted');
  if (isIP(host) || host.endsWith('.') || !/^[a-z0-9.-]+$/i.test(host)) throw new Error('Literal IPs and nonstandard hostnames are not permitted');
  const domain = getDomain(host, { allowPrivateDomains: true });
  if (!domain || !host.includes('.') || (rootDomain && domain !== rootDomain)) throw new Error('URL is outside the supplied official domain');
  if (url.search) throw new Error('Query URLs are excluded to bound crawling and avoid credential-bearing URLs');
  url.hash = '';
  return url;
}
export function domainOf(url: URL): string {
  const domain = getDomain(url.hostname, { allowPrivateDomains: true });
  if (!domain) throw new Error('Cannot establish website domain');
  return domain;
}
export async function bounded<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Request timed out')), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
export async function publicResolution(resolve: ResearchDependencies['resolve'], hostname: string, timeoutMs: number): Promise<ResolvedAddress> {
  const addresses = await bounded(resolve(hostname), timeoutMs);
  if (!addresses.length || addresses.some(item => !publicAddress(item.address) || isIP(item.address) !== item.family)) throw new Error('DNS includes a non-public or invalid destination');
  return addresses.find(item => item.family === 4) ?? addresses[0];
}
function wireRequest(url: URL, { address, timeoutMs, maxBytes }: TransportOptions): Promise<WireResponse> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => req.destroy(new Error('Request timed out')), timeoutMs);
    const req = httpsRequest(url, {
      agent: false, // Never reuse a socket from a previous DNS decision.
      family: address.family, // A fixed family disables automatic address selection.
      // Preserve original Host and TLS SNI, but connect only to the validated IP.
      lookup: (_host, _options, callback) => callback(null, address.address, address.family),
      headers: { 'User-Agent': USER_AGENT, Accept: /^\/(?:docs?|guides?|reference)(?:\/|$)/i.test(url.pathname)?'text/markdown,text/html,application/xhtml+xml,text/plain,application/xml,text/xml':'text/html,application/xhtml+xml,text/markdown;q=0.9,text/plain;q=0.8,application/xml;q=0.7,text/xml;q=0.7', 'Accept-Encoding': 'identity' },
      maxHeaderSize: 16384,
    }, response => {
      const headers: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(response.headers)) headers[key] = Array.isArray(value) ? value.join(', ') : value;
      const status = response.statusCode ?? 0;
      // Redirect and error bodies are unnecessary; no automatic redirects or retries.
      if (status < 200 || status >= 300) { response.destroy(); clearTimeout(timer); resolve({status,headers,body:''}); return; }
      if (Number(headers['content-length']) > maxBytes) { req.destroy(new Error(`Response exceeds byte limit (${headers['content-length']} > ${maxBytes})`)); return; }
      let rawBytes = 0;
      response.on('data', chunk => { rawBytes += chunk.length; if (rawBytes > maxBytes) req.destroy(new Error('Response exceeds byte limit')); });
      const encoding = headers['content-encoding']?.toLowerCase();
      const decoder = encoding === 'gzip' ? createGunzip() : encoding === 'deflate' ? createInflate() : encoding === 'br' ? createBrotliDecompress() : undefined;
      if (encoding && encoding !== 'identity' && !decoder) { req.destroy(new Error('Unsupported content encoding')); return; }
      const stream = decoder ? response.pipe(decoder) : response;
      const chunks: Buffer[] = []; let decodedBytes = 0;
      stream.on('data', (chunk: Buffer) => { decodedBytes += chunk.length; if (decodedBytes > maxBytes) { stream.destroy(new Error('Decoded response exceeds byte limit')); req.destroy(); } else chunks.push(chunk); });
      stream.on('error', error => { req.destroy(); clearTimeout(timer); reject(error); });
      response.on('error', error => { decoder?.destroy(); clearTimeout(timer); reject(error); });
      stream.on('end', () => { clearTimeout(timer); resolve({status,headers,body:Buffer.concat(chunks).toString('utf8')}); });
    });
    req.on('error', error => { clearTimeout(timer); reject(error); });
    req.end();
  });
}
export const productionDependencies: ResearchDependencies = {
  resolve: hostname => lookup(hostname, {all:true,verbatim:true}), request: wireRequest,
};
