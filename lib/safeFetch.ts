import dns from 'node:dns/promises';
import net from 'node:net';

export class UnsafeUrlError extends Error {}

const FETCH_TIMEOUT_MS = 6000;
const MAX_BYTES = 500_000;

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this" network
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 0 && parts[2] === 2) return true; // 192.0.2.0/24 (TEST-NET-1)
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a === 198 && b === 51 && parts[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && parts[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast + reserved (224.0.0.0/4, 240.0.0.0/4)
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // fe80::/10
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7 (unique local)
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // unrecognized, refuse
}

/**
 * Resolves and validates a URL an external agent handed us before we ever
 * make a request to it: https-or-http only, and every resolved address must
 * be public. Doesn't fully close a DNS-rebinding race (that needs pinning the
 * connection to the validated IP via a custom dispatcher), but blocks the
 * overwhelmingly common SSRF cases — localhost, private ranges, cloud
 * metadata — for what is otherwise an open "fetch any URL" tool.
 */
async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('not a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('only http/https URLs are allowed');
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new UnsafeUrlError('localhost is not allowed');
  }
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new UnsafeUrlError('that address is not allowed');
    return url;
  }
  let records: string[];
  try {
    const results = await dns.lookup(hostname, { all: true });
    records = results.map((r) => r.address);
  } catch {
    throw new UnsafeUrlError('could not resolve that host');
  }
  if (records.length === 0 || records.some(isPrivateIp)) {
    throw new UnsafeUrlError('that address is not allowed');
  }
  return url;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface PageFetch {
  url: string;
  title: string;
  snippet: string;
}

export async function fetchPageSummary(rawUrl: string): Promise<PageFetch> {
  const url = await assertSafeUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'GrokWorldSpark/1.0 (+https://grokworlds.xyz)' }
    });
    if (!res.ok) throw new UnsafeUrlError(`page responded with ${res.status}`);
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw new UnsafeUrlError('that page is not readable text/HTML');
    }
    const reader = res.body?.getReader();
    let received = 0;
    let text = '';
    const decoder = new TextDecoder();
    if (reader) {
      while (received < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        text += decoder.decode(value, { stream: true });
      }
      reader.cancel().catch(() => undefined);
    } else {
      text = await res.text();
    }

    const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? stripTags(titleMatch[1]).slice(0, 140) : url.hostname;
    const snippet = stripTags(text).slice(0, 400);
    return { url: url.toString(), title: title || url.hostname, snippet };
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw err;
    throw new UnsafeUrlError('could not fetch that page');
  } finally {
    clearTimeout(timeout);
  }
}
