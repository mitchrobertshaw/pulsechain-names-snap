// Read-only calls to PulseChain and Ethereum over public RPC servers, trying the next server when one
// is down or slow. Lookups only read public records: nothing is signed or sent.

import type { Address, Hex } from 'viem';

import type { Call, CallResult, Chain } from './names';

/**
 * Public RPC servers for each chain, tried in order. Each must accept requests from any web page
 * (Access-Control-Allow-Origin: *), as the snap runs inside MetaMask, in the browser; all six did on
 * 17 November 2026. `npm run test:live` checks that each one still answers.
 */
export const RPC_URLS: Record<Chain, readonly string[]> = {
  'eip155:369': ['https://rpc.pulsechain.com', 'https://pulsechain-rpc.publicnode.com', 'https://rpc-pulsechain.g4mm4.io'],
  'eip155:1': ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org', 'https://cloudflare-eth.com'],
};

/** How long to wait for one server before trying the next, in milliseconds. */
export const TIMEOUT_MS = 6000;

type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

type RpcReply = { result?: unknown; error?: { code?: number; message?: string } };

/** Whether a JSON-RPC error means the contract reverted (as opposed to the server failing). */
export function isRevert(error: { code?: number; message?: string }): boolean {
  return error.code === 3 || /revert/iu.test(error.message ?? '');
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No answer within ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** An `eth_call` function over `fetch`, for `names.ts`. */
export function makeCall(fetchFn: Fetch, urls: Record<Chain, readonly string[]> = RPC_URLS, timeoutMs = TIMEOUT_MS): Call {
  return async (chain: Chain, to: Address, data: Hex): Promise<CallResult> => {
    let lastError: unknown = new Error(`No RPC server for ${chain}`);
    for (const url of urls[chain]) {
      try {
        const response = await withTimeout(
          fetchFn(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
          }),
          timeoutMs,
        );
        if (!response.ok) throw new Error(`${url} answered HTTP ${response.status}`);
        const reply = (await withTimeout(response.json(), timeoutMs)) as RpcReply;
        if (reply.error) {
          if (isRevert(reply.error)) return { reverted: true };
          throw new Error(`${url}: ${reply.error.message ?? 'error'}`);
        }
        if (typeof reply.result !== 'string' || !/^0x[0-9a-f]*$/iu.test(reply.result)) {
          throw new Error(`${url} gave no result`);
        }
        return { reverted: false, data: reply.result as Hex };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  };
}
