/**
 * Looks up .hex, .pdai and .pls names: name to address, and address to name. Pure logic over an
 * `eth_call` function, so it can be tested without a network (see names.test.ts).
 *
 * .hex (HexNS) and .pdai (pDAI Name Service) are ENSv2 registries: their UniversalResolverV2 answers
 * `addr(node, coinType)` for any name, through whatever resolver the owner chose (by default one that
 * answers with the owner). .hex is on PulseChain and copied to Ethereum; .pdai is on PulseChain only.
 * .pls (Pulse Domains) is an ENS v1-style registry on PulseChain: registry.resolver(node), then
 * resolver.addr(node), and reverse records under addr.reverse.
 */

import {
  type Abi,
  type Address,
  type Hex,
  bytesToHex,
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  isAddress,
  namehash,
  parseAbi,
  stringToBytes,
  zeroAddress,
} from 'viem';
import { normalize } from 'viem/ens';

export const PULSECHAIN = 'eip155:369';
export const ETHEREUM = 'eip155:1';
export type Chain = typeof PULSECHAIN | typeof ETHEREUM;

/** ENSIP-9 coin type for Ethereum. */
export const COIN_TYPE_ETH = 60n;
/** ENSIP-19 default coin type: the same address on any EVM chain. */
export const COIN_TYPE_DEFAULT = 0x80000000n;
/** ENSIP-11 coin type for PulseChain (chain 369). */
export const COIN_TYPE_PULSECHAIN = COIN_TYPE_DEFAULT | 369n;

/** A name service whose UniversalResolverV2 answers lookups (ENSv2). */
export type UniversalService = {
  kind: 'universal';
  tld: string;
  protocol: string;
  /** Its UniversalResolverV2 on each chain it answers on. */
  universalResolvers: Partial<Record<Chain, Address>>;
};

/** A name service with an ENS v1-style registry and resolvers. */
export type RegistryService = {
  kind: 'registry';
  tld: string;
  protocol: string;
  chain: Chain;
  registry: Address;
};

export type Service = UniversalService | RegistryService;

export const SERVICES: readonly Service[] = [
  {
    kind: 'universal',
    tld: 'hex',
    protocol: 'HexNS',
    universalResolvers: {
      [PULSECHAIN]: '0x774822450c94A9fdD82febb3aF528C8e6e192bae',
      [ETHEREUM]: '0xccDB62C6133E761B4B6ffE597205e377aF612BDF',
    },
  },
  {
    kind: 'universal',
    tld: 'pdai',
    protocol: 'pDAI Name Service',
    universalResolvers: {
      [PULSECHAIN]: '0x394363Dfbb7A2FFE2C8b0B70DB53157653E0be8A',
    },
  },
  {
    kind: 'registry',
    tld: 'pls',
    protocol: 'Pulse Domains',
    chain: PULSECHAIN,
    registry: '0xbd5133993FCDED5945c5539D9f032261F0d13170',
  },
];

/** What an `eth_call` came back with. A call that couldn't be made at all throws instead. */
export type CallResult = { reverted: false; data: Hex } | { reverted: true };
export type Call = (chain: Chain, to: Address, data: Hex) => Promise<CallResult>;

export const universalResolverAbi = parseAbi([
  'function resolve(bytes name, bytes data) view returns (bytes, address)',
  'function reverse(bytes lookupAddress, uint256 coinType) view returns (string, address, address)',
]);
export const addrCoinAbi = parseAbi(['function addr(bytes32 node, uint256 coinType) view returns (bytes)']);
export const addrAbi = parseAbi(['function addr(bytes32 node) view returns (address)']);
export const nameAbi = parseAbi(['function name(bytes32 node) view returns (string)']);
export const registryAbi = parseAbi(['function resolver(bytes32 node) view returns (address)']);

/**
 * A name in its normalized form (ENSIP-15), so `MICK.hex` becomes `mick.hex`.
 * @param input - The name as typed.
 * @returns The normalized name, or null if it isn't a valid name with an ending.
 */
export function normalizedName(input: string): string | null {
  let name: string;
  try {
    name = normalize(input.trim());
  } catch {
    return null;
  }
  const labels = name.split('.');
  if (labels.length < 2 || labels.some((label) => label.length === 0)) return null;
  return name;
}

/**
 * The service a name belongs to, by its ending.
 * @param name - A normalized name.
 * @returns The service for its ending, or undefined for an ending the snap doesn't look up.
 */
export function serviceFor(name: string): Service | undefined {
  const tld = name.slice(name.lastIndexOf('.') + 1);
  return SERVICES.find((service) => service.tld === tld);
}

/**
 * A name in DNS wire format, as UniversalResolverV2 takes it.
 * @param name - A normalized name.
 * @returns The name in DNS wire format.
 * @throws If a label is empty or longer than 255 bytes.
 */
export function dnsEncode(name: string): Hex {
  const out: number[] = [];
  for (const label of name.split('.')) {
    const bytes = stringToBytes(label);
    if (bytes.length === 0 || bytes.length > 255) throw new Error(`Bad label in ${name}`);
    out.push(bytes.length, ...bytes);
  }
  out.push(0);
  return bytesToHex(Uint8Array.from(out));
}

/**
 * The coin types to ask for, best first.
 * @param chain - The chain the address is for.
 * @returns On PulseChain: PulseChain's own, then any EVM chain's, then Ethereum's. On Ethereum:
 * Ethereum's.
 */
export function coinTypesFor(chain: Chain): bigint[] {
  return chain === PULSECHAIN ? [COIN_TYPE_PULSECHAIN, COIN_TYPE_DEFAULT, COIN_TYPE_ETH] : [COIN_TYPE_ETH];
}

/**
 * Decodes a call's result.
 * @param abi - The ABI with the function that was called.
 * @param functionName - The function that was called.
 * @param data - What the call returned.
 * @returns The decoded result, or null if it isn't what the function returns.
 */
function decode<Result>(abi: Abi, functionName: string, data: Hex): Result | null {
  try {
    return decodeFunctionResult({ abi, functionName, data }) as Result;
  } catch {
    return null;
  }
}

/**
 * An address as a resolver gives it.
 * @param raw - The resolver's answer: 20 bytes, or nothing.
 * @returns The address, checksummed, or null for none or the zero address.
 */
function addressFrom(raw: Hex | null | undefined): Address | null {
  if (!raw || !isAddress(raw, { strict: false })) return null;
  const address = getAddress(raw);
  return address === zeroAddress ? null : address;
}

/**
 * Name to address for an ENSv2 service, through its UniversalResolverV2.
 * @param call - Makes an `eth_call`.
 * @param chain - The chain to look on.
 * @param service - The service the name belongs to.
 * @param name - A normalized name.
 * @returns The first address the name gives for the chain's coin types, or null.
 */
async function universalAddress(call: Call, chain: Chain, service: UniversalService, name: string): Promise<Address | null> {
  const universalResolver = service.universalResolvers[chain];
  if (!universalResolver) return null;
  const node = namehash(name);
  const dnsName = dnsEncode(name);
  for (const coinType of coinTypesFor(chain)) {
    const data = encodeFunctionData({ abi: addrCoinAbi, functionName: 'addr', args: [node, coinType] });
    const result = await call(
      chain,
      universalResolver,
      encodeFunctionData({ abi: universalResolverAbi, functionName: 'resolve', args: [dnsName, data] }),
    );
    // A revert means no resolver, or one that doesn't answer this coin type: try the next.
    if (result.reverted) continue;
    const resolved = decode<readonly [Hex, Address]>(universalResolverAbi, 'resolve', result.data);
    const raw = resolved ? decode<Hex>(addrCoinAbi, 'addr', resolved[0]) : null;
    const address = addressFrom(raw);
    if (address) return address;
  }
  return null;
}

/**
 * Reads an address from a contract function that takes a name's node.
 * @param call - Makes an `eth_call`.
 * @param chain - The chain to read on.
 * @param to - The contract.
 * @param abi - The ABI with the function.
 * @param functionName - The function, `resolver` or `addr`.
 * @param node - The name's node (namehash).
 * @returns The address, or null for none, the zero address, or a revert.
 */
async function readAddress(call: Call, chain: Chain, to: Address, abi: Abi, functionName: string, node: Hex): Promise<Address | null> {
  const result = await call(chain, to, encodeFunctionData({ abi, functionName, args: [node] }));
  return result.reverted ? null : addressFrom(decode<Address>(abi, functionName, result.data));
}

/**
 * Name to address for an ENS v1-style service: the registry gives the resolver, and the resolver
 * the address.
 * @param call - Makes an `eth_call`.
 * @param chain - The chain to look on.
 * @param service - The service the name belongs to.
 * @param name - A normalized name.
 * @returns The address, or null.
 */
async function registryAddress(call: Call, chain: Chain, service: RegistryService, name: string): Promise<Address | null> {
  if (chain !== service.chain) return null;
  const node = namehash(name);
  const resolver = await readAddress(call, chain, service.registry, registryAbi, 'resolver', node);
  return resolver ? readAddress(call, chain, resolver, addrAbi, 'addr', node) : null;
}

export type Resolved = { address: Address; name: string; protocol: string };

/**
 * Name to address.
 * @param call - Makes an `eth_call`.
 * @param chain - The chain to look on.
 * @param input - The name as typed.
 * @returns What the name points to on the chain, with its normalized form and service, or null.
 */
export async function resolveName(call: Call, chain: Chain, input: string): Promise<Resolved | null> {
  const name = normalizedName(input);
  const service = name ? serviceFor(name) : undefined;
  if (!name || !service) return null;
  const address =
    service.kind === 'universal'
      ? await universalAddress(call, chain, service, name)
      : await registryAddress(call, chain, service, name);
  return address ? { address, name, protocol: service.protocol } : null;
}

/**
 * Checks a primary name both ways.
 * @param call - Makes an `eth_call`.
 * @param chain - The chain to look on.
 * @param service - The service whose primary name it is.
 * @param address - The address the primary name was set for.
 * @param primary - The primary name, as the service gave it.
 * @returns The name, if it's a valid name of the service that really points back to the address;
 * otherwise null.
 */
async function verified(call: Call, chain: Chain, service: Service, address: Address, primary: string | null): Promise<string | null> {
  if (!primary) return null;
  const name = normalizedName(primary);
  if (!name || name !== primary || serviceFor(name) !== service) return null;
  const forward = await resolveName(call, chain, name);
  return forward?.address === address ? name : null;
}

/**
 * An address's primary name for an ENSv2 service, through its UniversalResolverV2.
 * @param call - Makes an `eth_call`.
 * @param chain - The chain to look on.
 * @param service - The service.
 * @param address - The address.
 * @returns The primary name, not yet checked forward, or null.
 */
async function universalPrimary(call: Call, chain: Chain, service: UniversalService, address: Address): Promise<string | null> {
  const universalResolver = service.universalResolvers[chain];
  if (!universalResolver) return null;
  const coinType = chain === PULSECHAIN ? COIN_TYPE_PULSECHAIN : COIN_TYPE_ETH;
  const result = await call(
    chain,
    universalResolver,
    encodeFunctionData({ abi: universalResolverAbi, functionName: 'reverse', args: [address, coinType] }),
  );
  if (result.reverted) return null;
  const primary = decode<readonly [string, Address, Address]>(universalResolverAbi, 'reverse', result.data);
  return primary ? primary[0] : null;
}

/**
 * An address's primary name for an ENS v1-style service, from its reverse record under
 * `addr.reverse`.
 * @param call - Makes an `eth_call`.
 * @param chain - The chain to look on.
 * @param service - The service.
 * @param address - The address.
 * @returns The primary name, not yet checked forward, or null.
 */
async function registryPrimary(call: Call, chain: Chain, service: RegistryService, address: Address): Promise<string | null> {
  if (chain !== service.chain) return null;
  const node = namehash(`${address.slice(2).toLowerCase()}.addr.reverse`);
  const resolver = await readAddress(call, chain, service.registry, registryAbi, 'resolver', node);
  if (!resolver) return null;
  const result = await call(chain, resolver, encodeFunctionData({ abi: nameAbi, functionName: 'name', args: [node] }));
  return result.reverted ? null : decode<string>(nameAbi, 'name', result.data);
}

export type Named = { name: string; protocol: string };

/**
 * Address to name.
 * @param call - Makes an `eth_call`.
 * @param chain - The chain to look on.
 * @param input - The address.
 * @returns Each service's primary name for the address on the chain, checked both ways.
 */
export async function lookupAddress(call: Call, chain: Chain, input: string): Promise<Named[]> {
  if (!isAddress(input, { strict: false })) return [];
  const address = getAddress(input);
  const found: Named[] = [];
  for (const service of SERVICES) {
    const primary =
      service.kind === 'universal'
        ? await universalPrimary(call, chain, service, address)
        : await registryPrimary(call, chain, service, address);
    const name = await verified(call, chain, service, address, primary);
    if (name) found.push({ name, protocol: service.protocol });
  }
  return found;
}
