import type { AddressResolution, DomainResolution, OnNameLookupHandler } from '@metamask/snaps-sdk';

import { type Chain, ETHEREUM, PULSECHAIN, lookupAddress, resolveName } from './names';
import { makeCall } from './rpc';

const call = makeCall(async (url, init) => fetch(url, init));

/**
 * Called by MetaMask when someone types a .hex, .pdai or .pls name as a recipient (name to address),
 * and when it shows an address (address to name). Answers on PulseChain for all three endings, and
 * on Ethereum for .hex, whose names are copied there.
 * @param request - MetaMask's lookup request.
 * @param request.chainId - The chain, as a CAIP-2 ID: `eip155:369` (PulseChain) or `eip155:1`
 * (Ethereum).
 * @param request.domain - The name to look up, when MetaMask asks for an address.
 * @param request.address - The address to look up, when MetaMask asks for a name.
 * @returns The address or names found, or null when there's no answer, or when the chains can't
 * be reached.
 */
export const onNameLookup: OnNameLookupHandler = async (request) => {
  const { chainId, domain, address } = request;
  if (chainId !== PULSECHAIN && chainId !== ETHEREUM) return null;
  const chain: Chain = chainId;
  try {
    if (domain) {
      const found = await resolveName(call, chain, domain);
      if (!found) return null;
      const resolution: AddressResolution = {
        resolvedAddress: found.address,
        protocol: found.protocol,
        domainName: found.name,
      };
      return { resolvedAddresses: [resolution] };
    }
    if (address) {
      const names = await lookupAddress(call, chain, address);
      const [first, ...rest] = names.map(
        (named): DomainResolution => ({ resolvedDomain: named.name, protocol: named.protocol }),
      );
      return first ? { resolvedDomains: [first, ...rest] } : null;
    }
  } catch {
    // The chains couldn't be reached: MetaMask shows no name rather than a wrong one.
    return null;
  }
  return null;
};
