import { describe, expect, it } from 'vitest';
import {
  type Address,
  type Hex,
  bytesToString,
  decodeFunctionData,
  encodeFunctionResult,
  getAddress,
  hexToBytes,
  namehash,
  zeroAddress,
} from 'viem';

import {
  COIN_TYPE_DEFAULT,
  COIN_TYPE_ETH,
  COIN_TYPE_PULSECHAIN,
  type Call,
  type CallResult,
  type Chain,
  ETHEREUM,
  PULSECHAIN,
  SERVICES,
  addrAbi,
  addrCoinAbi,
  dnsEncode,
  lookupAddress,
  nameAbi,
  normalizedName,
  registryAbi,
  resolveName,
  universalResolverAbi,
} from './names';

// The real deployments' addresses, so the tests also check SERVICES is wired to them.
const HEX_UR_PULSECHAIN = '0x774822450c94A9fdD82febb3aF528C8e6e192bae';
const HEX_UR_ETHEREUM = '0xccDB62C6133E761B4B6ffE597205e377aF612BDF';
const PDAI_UR = '0x394363Dfbb7A2FFE2C8b0B70DB53157653E0be8A';
const PNS_REGISTRY = '0xbd5133993FCDED5945c5539D9f032261F0d13170';
const PNS_RESOLVER = '0x2FDBb906b4FE68e31D928C1ED0b6a3bD1f204374';
const A = getAddress('0x102785e63dcd7c2ba1146e96da7fe429155602c6');
const B = getAddress('0x87f91997f19d793bdd2ffe030694af3e6a5e87a6');
const C = getAddress('0x08c46c5e3a23fac2b1786ca2e782d1db29f66ed0');

/** Decodes a DNS wire-format name back to dotted text. */
function dnsDecode(hex: Hex): string {
  const bytes = hexToBytes(hex);
  const labels: string[] = [];
  for (let i = 0; bytes[i] !== 0; i += bytes[i] + 1) labels.push(bytesToString(bytes.slice(i + 1, i + 1 + bytes[i])));
  return labels.join('.');
}

type Universal = {
  chain: Chain;
  /** name -> coin type -> address ('' for an answer with no address). */
  records: Record<string, Record<string, Address | ''>>;
  /** Names with no resolver at all: the universal resolver reverts. */
  noResolver?: string[];
  /** address -> primary name, for reverse lookups; addresses not listed revert. */
  primary?: Record<string, string>;
};

/** A pretend chain with the three services' contracts, answering only what each would. */
function fakeChain(o: {
  universal: Record<string, Universal>;
  pls?: { addr: Record<string, Address>; reverse?: Record<string, string> };
}) {
  const calls: { chain: Chain; to: Address; fn: string }[] = [];
  const ok = (data: Hex): CallResult => ({ reverted: false, data });
  const call: Call = async (chain, to, data) => {
    const contract = Object.keys(o.universal).find((a) => a.toLowerCase() === to.toLowerCase());
    if (contract) {
      const ur = o.universal[contract];
      const { functionName, args } = decodeFunctionData({ abi: universalResolverAbi, data });
      calls.push({ chain, to, fn: functionName });
      if (chain !== ur.chain) return ok('0x'); // no contract at this address on this chain
      if (functionName === 'resolve') {
        const [dnsName, inner] = args as [Hex, Hex];
        const name = dnsDecode(dnsName);
        if (ur.noResolver?.includes(name)) return { reverted: true };
        const { args: innerArgs } = decodeFunctionData({ abi: addrCoinAbi, data: inner });
        const [node, coinType] = innerArgs as [Hex, bigint];
        expect(node).toBe(namehash(name));
        const answer = ur.records[name]?.[coinType.toString()] ?? '';
        const encoded = encodeFunctionResult({ abi: addrCoinAbi, functionName: 'addr', result: answer === '' ? '0x' : answer });
        return ok(encodeFunctionResult({ abi: universalResolverAbi, functionName: 'resolve', result: [encoded, zeroAddress] }));
      }
      const [lookup] = args as [Hex, bigint];
      const primary = ur.primary?.[getAddress(lookup)];
      if (primary === undefined) return { reverted: true };
      return ok(encodeFunctionResult({ abi: universalResolverAbi, functionName: 'reverse', result: [primary, zeroAddress, zeroAddress] }));
    }
    if (to.toLowerCase() === PNS_REGISTRY.toLowerCase()) {
      const { args } = decodeFunctionData({ abi: registryAbi, data });
      calls.push({ chain, to, fn: 'resolver' });
      if (chain !== PULSECHAIN) return ok('0x');
      const [node] = args as [Hex];
      const known = [...Object.keys(o.pls?.addr ?? {}), ...Object.keys(o.pls?.reverse ?? {}).map((a) => `${a.slice(2).toLowerCase()}.addr.reverse`)];
      const resolver = known.some((n) => namehash(n) === node) ? PNS_RESOLVER : zeroAddress;
      return ok(encodeFunctionResult({ abi: registryAbi, functionName: 'resolver', result: resolver }));
    }
    if (to.toLowerCase() === PNS_RESOLVER.toLowerCase()) {
      if (data.startsWith('0x691f3431')) {
        const { args } = decodeFunctionData({ abi: nameAbi, data });
        calls.push({ chain, to, fn: 'name' });
        const entry = Object.entries(o.pls?.reverse ?? {}).find(([a]) => namehash(`${a.slice(2).toLowerCase()}.addr.reverse`) === args[0]);
        return ok(encodeFunctionResult({ abi: nameAbi, functionName: 'name', result: entry?.[1] ?? '' }));
      }
      const { args } = decodeFunctionData({ abi: addrAbi, data });
      calls.push({ chain, to, fn: 'addr' });
      const entry = Object.entries(o.pls?.addr ?? {}).find(([n]) => namehash(n) === args[0]);
      return ok(encodeFunctionResult({ abi: addrAbi, functionName: 'addr', result: entry?.[1] ?? zeroAddress }));
    }
    throw new Error(`Unexpected call to ${to}`);
  };
  return { call, calls };
}

const P = COIN_TYPE_PULSECHAIN.toString();
const D = COIN_TYPE_DEFAULT.toString();
const E = COIN_TYPE_ETH.toString();

function standard() {
  return fakeChain({
    universal: {
      [HEX_UR_PULSECHAIN]: {
        chain: PULSECHAIN,
        records: {
          'mick.hex': { [P]: A, [D]: A, [E]: A },
          'ethonly.hex': { [E]: B },
          'free.hex': {},
        },
        noResolver: ['broken.hex'],
        primary: { [B]: 'ethonly.hex' },
      },
      [HEX_UR_ETHEREUM]: { chain: ETHEREUM, records: { 'mick.hex': { [E]: A } } },
      [PDAI_UR]: { chain: PULSECHAIN, records: { 'testname.pdai': { [P]: B, [D]: B, [E]: B } } },
    },
    pls: { addr: { 'pdai.pls': C }, reverse: { [C]: 'pdai.pls' } },
  });
}

describe('SERVICES', () => {
  it('points at the live contracts', () => {
    const [hex, pdai, pls] = SERVICES;
    expect(hex).toMatchObject({ tld: 'hex', protocol: 'HexNS', universalResolvers: { [PULSECHAIN]: HEX_UR_PULSECHAIN, [ETHEREUM]: HEX_UR_ETHEREUM } });
    expect(pdai).toMatchObject({ tld: 'pdai', protocol: 'pDAI Name Service', universalResolvers: { [PULSECHAIN]: PDAI_UR } });
    expect(pdai.kind === 'universal' && pdai.universalResolvers[ETHEREUM]).toBeFalsy();
    expect(pls).toMatchObject({ tld: 'pls', protocol: 'Pulse Domains', chain: PULSECHAIN, registry: PNS_REGISTRY });
  });
});

describe('names', () => {
  it('normalizes names, and turns away ones that are not names with an ending', () => {
    expect(normalizedName('  MiCk.HEX ')).toBe('mick.hex');
    expect(normalizedName('mick')).toBeNull();
    expect(normalizedName('mick..hex')).toBeNull();
    expect(normalizedName('.hex')).toBeNull();
    expect(normalizedName('')).toBeNull();
    expect(normalizedName('mi ck.hex')).toBeNull();
  });

  it('writes names in DNS wire format', () => {
    expect(dnsEncode('mick.hex')).toBe('0x046d69636b0368657800');
  });
});

describe('resolveName', () => {
  it('finds a .hex name on PulseChain with one call, asking for PulseChain first', async () => {
    const { call, calls } = standard();
    await expect(resolveName(call, PULSECHAIN, 'mick.hex')).resolves.toStrictEqual({ address: A, name: 'mick.hex', protocol: 'HexNS' });
    expect(calls).toHaveLength(1);
  });

  it('reads a typed name normalized, and says which name it found', async () => {
    const { call } = standard();
    await expect(resolveName(call, PULSECHAIN, 'MICK.Hex')).resolves.toMatchObject({ address: A, name: 'mick.hex' });
  });

  it("falls back to any EVM chain's address, then Ethereum's, for names that only set those", async () => {
    const { call, calls } = standard();
    await expect(resolveName(call, PULSECHAIN, 'ethonly.hex')).resolves.toMatchObject({ address: B });
    expect(calls).toHaveLength(3);
  });

  it('finds a .hex name on Ethereum through its Ethereum copy, asking only for Ethereum', async () => {
    const { call, calls } = standard();
    await expect(resolveName(call, ETHEREUM, 'mick.hex')).resolves.toStrictEqual({ address: A, name: 'mick.hex', protocol: 'HexNS' });
    expect(calls).toStrictEqual([{ chain: ETHEREUM, to: HEX_UR_ETHEREUM, fn: 'resolve' }]);
  });

  it('finds a .pdai name on PulseChain, and nothing on Ethereum without asking', async () => {
    const { call, calls } = standard();
    await expect(resolveName(call, PULSECHAIN, 'testname.pdai')).resolves.toStrictEqual({ address: B, name: 'testname.pdai', protocol: 'pDAI Name Service' });
    await expect(resolveName(call, ETHEREUM, 'testname.pdai')).resolves.toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('finds a .pls name through its registry and resolver, on PulseChain only', async () => {
    const { call, calls } = standard();
    await expect(resolveName(call, PULSECHAIN, 'pdai.pls')).resolves.toStrictEqual({ address: C, name: 'pdai.pls', protocol: 'Pulse Domains' });
    expect(calls.map((c) => c.fn)).toStrictEqual(['resolver', 'addr']);
    await expect(resolveName(call, ETHEREUM, 'pdai.pls')).resolves.toBeNull();
    expect(calls).toHaveLength(2);
  });

  it('says nothing for free names, names with no resolver, and unregistered .pls names', async () => {
    const { call } = standard();
    await expect(resolveName(call, PULSECHAIN, 'free.hex')).resolves.toBeNull();
    await expect(resolveName(call, PULSECHAIN, 'broken.hex')).resolves.toBeNull();
    await expect(resolveName(call, PULSECHAIN, 'nobody.pls')).resolves.toBeNull();
  });

  it('never asks the chain about other endings or invalid names', async () => {
    const { call, calls } = standard();
    await expect(resolveName(call, PULSECHAIN, 'vitalik.eth')).resolves.toBeNull();
    await expect(resolveName(call, PULSECHAIN, 'mick..hex')).resolves.toBeNull();
    await expect(resolveName(call, PULSECHAIN, 'hex')).resolves.toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("passes on a network failure, so the snap can say nothing rather than 'no such name'", async () => {
    const failing: Call = async () => {
      throw new Error('down');
    };
    await expect(resolveName(failing, PULSECHAIN, 'mick.hex')).rejects.toThrow('down');
  });
});

describe('lookupAddress', () => {
  it('finds a .pls primary name that points back to the address', async () => {
    const { call } = standard();
    await expect(lookupAddress(call, PULSECHAIN, C.toLowerCase())).resolves.toStrictEqual([{ name: 'pdai.pls', protocol: 'Pulse Domains' }]);
  });

  it('finds a .hex primary name from the universal resolver, checked forward', async () => {
    const { call } = standard();
    await expect(lookupAddress(call, PULSECHAIN, B)).resolves.toStrictEqual([{ name: 'ethonly.hex', protocol: 'HexNS' }]);
  });

  it("drops a reverse record whose name points elsewhere, or isn't a .pls name", async () => {
    const { call } = fakeChain({
      universal: { [HEX_UR_PULSECHAIN]: { chain: PULSECHAIN, records: {} }, [PDAI_UR]: { chain: PULSECHAIN, records: {} } },
      // A's reverse record claims pdai.pls, which points to C; B's names a Pulse Domains internet ending.
      pls: { addr: { 'pdai.pls': C, 'alice.com': B }, reverse: { [A]: 'pdai.pls', [B]: 'alice.com' } },
    });
    await expect(lookupAddress(call, PULSECHAIN, A)).resolves.toStrictEqual([]);
    await expect(lookupAddress(call, PULSECHAIN, B)).resolves.toStrictEqual([]);
  });

  it('finds nothing for an address with no names, or a malformed address', async () => {
    const { call } = standard();
    await expect(lookupAddress(call, PULSECHAIN, '0x0000000000000000000000000000000000000001')).resolves.toStrictEqual([]);
    await expect(lookupAddress(call, PULSECHAIN, 'mick.hex')).resolves.toStrictEqual([]);
  });

  it('on Ethereum asks only the .hex copy, and not PulseChain', async () => {
    const { call, calls } = standard();
    await expect(lookupAddress(call, ETHEREUM, C)).resolves.toStrictEqual([]);
    expect(calls).toStrictEqual([{ chain: ETHEREUM, to: HEX_UR_ETHEREUM, fn: 'reverse' }]);
  });
});
