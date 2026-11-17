// The built snap (dist/bundle.js), installed in MetaMask's snap simulator and asked what MetaMask
// would ask. Run `npm run build` first. The live lookups read the real chains: `npm run test:live`.

import { readFile } from 'node:fs/promises';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SnapId } from '@metamask/snaps-sdk';
import { installSnap } from '@metamask/snaps-simulation';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES: Record<string, string> = { '.json': 'application/json', '.js': 'application/javascript', '.svg': 'image/svg+xml' };

let server: Server;
let snap: Awaited<ReturnType<typeof installSnap>>;

beforeAll(async () => {
  // Serves the snap's folder, the way `mm-snap serve` does, so it installs as `local:`.
  server = createServer((request, response) => {
    const path = normalize(join(ROOT, decodeURIComponent((request.url ?? '/').split('?')[0])));
    if (!path.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
      response.writeHead(403).end();
      return;
    }
    readFile(path).then(
      (body) => response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body),
      () => response.writeHead(404).end(),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  snap = await installSnap(`local:http://localhost:${port}` as SnapId);
}, 120_000);

afterAll(async () => {
  await snap?.executionService.terminateAllSnaps();
  server?.close();
});

describe('the built snap', () => {
  it('says nothing on chains it does not cover', async () => {
    const { response } = await snap.onNameLookup({ chainId: 'eip155:56', domain: 'mick.hex' });
    expect(response).toStrictEqual({ result: null });
  });

  it('says nothing, without asking a chain, for names it does not handle', async () => {
    for (const domain of ['vitalik.eth', 'mick..hex', 'hex']) {
      const { response } = await snap.onNameLookup({ chainId: 'eip155:369', domain });
      expect(response).toStrictEqual({ result: null });
    }
  });
});

const LIVE = Boolean(process.env.LIVE);

describe.runIf(LIVE)('live lookups on PulseChain and Ethereum', () => {
  const PAYMENTS = '0x102785E63DCD7C2ba1146E96da7fE429155602C6'; // mick.hex
  const TEST_WALLET = '0x87f91997f19D793BDD2ffE030694aF3E6a5e87A6'; // testname.pdai
  const PDAI_PLS = '0x08C46C5e3a23Fac2b1786ca2E782d1db29F66ED0'; // pdai.pls

  async function lookup(chainId: string, domain: string) {
    const { response } = await snap.onNameLookup({ chainId: chainId as `${string}:${string}`, domain });
    return response;
  }

  it('finds mick.hex on PulseChain, typed in any case', async () => {
    const expected = { result: { resolvedAddresses: [{ resolvedAddress: PAYMENTS, protocol: 'HexNS', domainName: 'mick.hex' }] } };
    expect(await lookup('eip155:369', 'mick.hex')).toStrictEqual(expected);
    expect(await lookup('eip155:369', 'MICK.hex')).toStrictEqual(expected);
  });

  it('finds mick.hex on Ethereum, through its copy there', async () => {
    expect(await lookup('eip155:1', 'mick.hex')).toStrictEqual({
      result: { resolvedAddresses: [{ resolvedAddress: PAYMENTS, protocol: 'HexNS', domainName: 'mick.hex' }] },
    });
  });

  it('finds testname.pdai on PulseChain only', async () => {
    expect(await lookup('eip155:369', 'testname.pdai')).toStrictEqual({
      result: { resolvedAddresses: [{ resolvedAddress: TEST_WALLET, protocol: 'pDAI Name Service', domainName: 'testname.pdai' }] },
    });
    expect(await lookup('eip155:1', 'testname.pdai')).toStrictEqual({ result: null });
  });

  it('finds pdai.pls on PulseChain only', async () => {
    expect(await lookup('eip155:369', 'pdai.pls')).toStrictEqual({
      result: { resolvedAddresses: [{ resolvedAddress: PDAI_PLS, protocol: 'Pulse Domains', domainName: 'pdai.pls' }] },
    });
    expect(await lookup('eip155:1', 'pdai.pls')).toStrictEqual({ result: null });
  });

  it('says nothing for a held name, a free name, or an unregistered .pls name', async () => {
    for (const domain of ['richardheart.hex', `free${Date.now()}.hex`, `free${Date.now()}.pdai`, `free${Date.now()}.pls`]) {
      expect(await lookup('eip155:369', domain)).toStrictEqual({ result: null });
    }
  });

  it("shows pdai.pls for its address, and no name for an address that hasn't set one", async () => {
    const named = await snap.onNameLookup({ chainId: 'eip155:369', address: PDAI_PLS.toLowerCase() });
    expect(named.response).toStrictEqual({ result: { resolvedDomains: [{ resolvedDomain: 'pdai.pls', protocol: 'Pulse Domains' }] } });
    const unnamed = await snap.onNameLookup({ chainId: 'eip155:369', address: PAYMENTS });
    expect(unnamed.response).toStrictEqual({ result: null });
  });
});
