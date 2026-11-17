import { describe, expect, it } from 'vitest';
import { PULSECHAIN } from './names';
import { RPC_URLS, isRevert, makeCall } from './rpc';

const URLS = { 'eip155:369': ['https://one', 'https://two'], 'eip155:1': ['https://eth'] } as const;
const TO = '0x774822450c94A9fdD82febb3aF528C8e6e192bae';

function reply(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('makeCall', () => {
  it('sends an eth_call and returns its result', async () => {
    const seen: { url: string; body: unknown }[] = [];
    const call = makeCall(async (url, init) => {
      seen.push({ url, body: JSON.parse(init.body) });
      return reply({ jsonrpc: '2.0', id: 1, result: '0x1234' });
    }, URLS);
    await expect(call(PULSECHAIN, TO, '0xabcd')).resolves.toStrictEqual({ reverted: false, data: '0x1234' });
    expect(seen).toStrictEqual([
      { url: 'https://one', body: { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: TO, data: '0xabcd' }, 'latest'] } },
    ]);
  });

  it('reports a revert as an answer, without trying the next server', async () => {
    const urls: string[] = [];
    const call = makeCall(async (url) => {
      urls.push(url);
      return reply({ jsonrpc: '2.0', id: 1, error: { code: 3, message: 'execution reverted', data: '0x77209fe8' } });
    }, URLS);
    await expect(call(PULSECHAIN, TO, '0x')).resolves.toStrictEqual({ reverted: true });
    expect(urls).toStrictEqual(['https://one']);
  });

  it('tries the next server when one is down, errs, or answers nonsense', async () => {
    for (const first of [
      async () => {
        throw new Error('offline');
      },
      async () => reply({}, false, 503),
      async () => reply({ jsonrpc: '2.0', id: 1, error: { code: -32005, message: 'rate limited' } }),
      async () => reply({ jsonrpc: '2.0', id: 1, result: 'nonsense' }),
    ]) {
      const call = makeCall(async (url) => (url === 'https://one' ? first() : reply({ jsonrpc: '2.0', id: 1, result: '0x01' })), URLS);
      await expect(call(PULSECHAIN, TO, '0x')).resolves.toStrictEqual({ reverted: false, data: '0x01' });
    }
  });

  it('gives up on a server that does not answer in time', async () => {
    const call = makeCall(
      async (url) => (url === 'https://one' ? new Promise(() => undefined) : reply({ jsonrpc: '2.0', id: 1, result: '0x02' })),
      URLS,
      50,
    );
    await expect(call(PULSECHAIN, TO, '0x')).resolves.toStrictEqual({ reverted: false, data: '0x02' });
  });

  it('throws when every server fails', async () => {
    const call = makeCall(async () => {
      throw new Error('offline');
    }, URLS);
    await expect(call(PULSECHAIN, TO, '0x')).rejects.toThrow('offline');
  });

  it('tells a revert from other errors', () => {
    expect(isRevert({ code: 3, message: 'execution reverted' })).toBe(true);
    expect(isRevert({ code: -32000, message: 'execution reverted: ResolverNotFound' })).toBe(true);
    expect(isRevert({ code: -32005, message: 'limit exceeded' })).toBe(false);
  });
});

// Each server in the list, on its own, so one that stops working shows up here rather than only
// making lookups slower. A server gets three tries, so one slow moment isn't a failure.
describe.runIf(Boolean(process.env.LIVE))('the RPC servers', () => {
  const CHAIN_IDS = { 'eip155:369': '0x171', 'eip155:1': '0x1' } as const;
  for (const [chain, urls] of Object.entries(RPC_URLS) as [keyof typeof CHAIN_IDS, readonly string[]][]) {
    for (const url of urls) {
      it(`${url} answers for ${chain}`, async () => {
        let answer: unknown;
        for (let attempt = 0; attempt < 3 && answer !== CHAIN_IDS[chain]; attempt++) {
          try {
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
              signal: AbortSignal.timeout(10_000),
            });
            answer = ((await response.json()) as { result?: unknown }).result;
          } catch (error) {
            answer = error instanceof Error ? error.message : error;
          }
        }
        expect(answer).toBe(CHAIN_IDS[chain]);
      }, 40_000);
    }
  }
});
