import type { AddressResolution, DomainResolution, OnNameLookupHandler } from '@metamask/snaps-sdk';

import { type Chain, ETHEREUM, PULSECHAIN, lookupAddress, resolveName } from './names';
import { makeCall } from './rpc';

const call = makeCall(async (url, init) => fetch(url, init));

/**
 * Called by MetaMask when someone types a .hex, .pdai or .pls name as a recipient (name to address),
 * and when it shows an address (address to name). Answers on PulseChain for all three endings, and
 * on Ethereum for .hex, whose names are copied there. Says nothing (null) when there's no answer,
 * or when the chains can't be reached.
 */
export const onNameLookup: OnNameLookupHandler = async ({ chainId, domain, address }) => {
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
