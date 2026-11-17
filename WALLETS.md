# Looking up .hex, .pdai and .pls names in a wallet

Everything a wallet needs to let people send to `.hex`, `.pdai` and `.pls` names instead of `0x…`
addresses, and to show those names next to addresses. All three are read straight from public
contracts: no API, no key, no fee.

| Ending | Name service | Chains | How it's looked up |
|---|---|---|---|
| `.hex` | [HexNS](https://hexns.domains) | PulseChain (369) and Ethereum (1) | ENSv2 `UniversalResolverV2`, one on each chain |
| `.pdai` | [pDAI Name Service](https://pdai.domains) | PulseChain (369) | ENSv2 `UniversalResolverV2` |
| `.pls` | [Pulse Domains](https://app.pulse.domains) | PulseChain (369) | ENS-style registry and resolvers |

HexNS and the pDAI Name Service are built on [ENSv2](https://github.com/ensdomains/contracts-v2),
the next version of the Ethereum Name Service. Pulse Domains is a separate project, an ENS-style
registry on PulseChain; it's included so a wallet can support all three PulseChain name services at
once.

## The contracts

| What | Chain | Address |
|---|---|---|
| `.hex` UniversalResolverV2 | PulseChain | [`0x774822450c94A9fdD82febb3aF528C8e6e192bae`](https://scan.pulsechain.com/address/0x774822450c94A9fdD82febb3aF528C8e6e192bae) |
| `.hex` UniversalResolverV2 | Ethereum | [`0xccDB62C6133E761B4B6ffE597205e377aF612BDF`](https://etherscan.io/address/0xccDB62C6133E761B4B6ffE597205e377aF612BDF#code) |
| `.pdai` UniversalResolverV2 | PulseChain | [`0x394363Dfbb7A2FFE2C8b0B70DB53157653E0be8A`](https://scan.pulsechain.com/address/0x394363Dfbb7A2FFE2C8b0B70DB53157653E0be8A) |
| Pulse Domains registry (`.pls`) | PulseChain | [`0xbd5133993FCDED5945c5539D9f032261F0d13170`](https://scan.pulsechain.com/address/0xbd5133993FCDED5945c5539D9f032261F0d13170) |

Every HexNS and pDAI Name Service contract is verified: its source code is published on its
chain's explorer (PulseChain's, or Etherscan for Ethereum), which checked that the code compiles to
exactly what's on the chain. Pulse Domains' contracts are verified too.

A wallet only needs the Pulse Domains registry; it leads to everything else. Its other contracts,
from Pulse Domains' app, for reference:

| Pulse Domains contract | Address |
|---|---|
| Public Resolver (the resolver its app gives names) | `0x2FDBb906b4FE68e31D928C1ED0b6a3bD1f204374` |
| Reverse Registrar (sets primary names) | `0x9E0406b8a7831B6056A52938B103e48D7E5A9F69` |
| Base Registrar (`.pls` names as NFTs) | `0x65Cf7f7aa5A4a2c20120B445cA4F05F63E2628C4` |
| Registrar Controller (registers and renews names) | `0xEDE92828a143cFC966a47d60604825655f7c79e8` |
| Name Wrapper | `0x4feFb26934705C1661aC04aF8303548b850d562F` |
| Universal Resolver | `0x6644e794F5aFfb8abcfea0e71d5624D013BA2dBA` |

viem's `getEnsAddress` reverts when pointed at that universal resolver, so look `.pls` names up
through the registry, as below.

## Name to address

First normalize the name as ENS does ([ENSIP-15](https://docs.ens.domains/ensip/15)), for example
with `normalize` from `viem/ens`, so `MICK.hex` becomes `mick.hex`. Pick the service by the name's
ending.

### `.hex` and `.pdai`

Ask the ending's `UniversalResolverV2` on the chain you're sending on for `addr(node, coinType)`.
Wallets that already look up ENS names through a universal resolver only need the address and the
coin type:

| Sending on | Coin type to ask for | Fall back to |
|---|---|---|
| PulseChain | `0x80000171` (PulseChain, [ENSIP-11](https://docs.ens.domains/ensip/11)) | `0x80000000` (any EVM chain, [ENSIP-19](https://docs.ens.domains/ensip/19)), then `60` |
| Ethereum (`.hex` only) | `60` | none |

With [viem](https://viem.sh), it's its standard ENS lookup:

```ts
import { createPublicClient, http } from 'viem';
import { pulsechain } from 'viem/chains';
import { normalize } from 'viem/ens';

const client = createPublicClient({ chain: pulsechain, transport: http() });

const address = await client.getEnsAddress({
  name: normalize('mick.hex'),
  coinType: 0x80000171n,
  universalResolverAddress: '0x774822450c94A9fdD82febb3aF528C8e6e192bae', // .pdai: 0x394363Dfbb7A2FFE2C8b0B70DB53157653E0be8A
});
// '0x102785e63dcd7c2ba1146e96da7fe429155602c6', or null if the name has no address
```

Without viem, it's one `eth_call`: `resolve(bytes name, bytes data)` on the universal resolver,
with the name in DNS wire format and `data` the ABI-encoded `addr(bytes32 node, uint256 coinType)`
call. It returns `(bytes result, address resolver)`, where `result` ABI-encodes `bytes`: 20 bytes
are the address, and empty means none. A revert also means none.

A name has no address while it's free, after it expires, and while it's reserved but not yet handed
to its owner (for example `richardheart.hex`).

### `.pls`

Pulse Domains works as ENS did before ENSv2. With `node = namehash(name)`:

1. `resolver(node)` on the registry, `0xbd5133993FCDED5945c5539D9f032261F0d13170`. The zero address
   means the name has no records.
2. `addr(node)` on that resolver. The zero address means no address.

```ts
import { namehash, parseAbi, zeroAddress } from 'viem';

const node = namehash(normalize('pdai.pls'));
const resolver = await client.readContract({
  address: '0xbd5133993FCDED5945c5539D9f032261F0d13170',
  abi: parseAbi(['function resolver(bytes32) view returns (address)']),
  functionName: 'resolver',
  args: [node],
});
const address =
  resolver === zeroAddress
    ? null
    : await client.readContract({
        address: resolver,
        abi: parseAbi(['function addr(bytes32) view returns (address)']),
        functionName: 'addr',
        args: [node],
      });
// '0x08C46C5e3a23Fac2b1786ca2E782d1db29F66ED0'
```

## Address to name

To show a name where the wallet shows an address:

- **`.pls`:** the address's reverse record. With `node = namehash('<address in lower case, without
  0x>.addr.reverse')`, ask the registry for `resolver(node)`, then that resolver for `name(node)`.
  Only show the name if it ends in `.pls` and looking it up forward gives the same address.
- **`.hex` and `.pdai`:** primary names aren't live yet. When they are, `reverse(bytes address,
  uint256 coinType)` on the universal resolver (ENSIP-19), or viem's `getEnsName` with the same
  `universalResolverAddress` and `coinType`, will return them. Today both return nothing, so a
  wallet can add the call now and the names will appear by themselves.

## Names to test with

| Look up | Chain | Answer |
|---|---|---|
| `mick.hex` | PulseChain and Ethereum | `0x102785E63DCD7C2ba1146E96da7fE429155602C6` |
| `testname.pdai` | PulseChain | `0x87f91997f19D793BDD2ffE030694aF3E6a5e87A6` |
| `pdai.pls` | PulseChain | `0x08C46C5e3a23Fac2b1786ca2E782d1db29F66ED0` |
| `richardheart.hex` | PulseChain | none (reserved, not yet claimed) |
| address `0x08C46C5e3a23Fac2b1786ca2E782d1db29F66ED0` | PulseChain | `pdai.pls` |

## Good practice

- **Show the name and the address together** before the user confirms a send, so they can check it.
- **Look the name up again just before sending.** Names expire and change owners; don't keep an
  answer for long.
- **Send only on the chains a name covers:** `.hex` on PulseChain and Ethereum, `.pdai` and `.pls`
  on PulseChain.
- **Smart-contract wallets.** By default a `.hex` or `.pdai` name points to its owner's address on
  every EVM chain. An ordinary wallet has the same address everywhere, but a smart-contract wallet
  might not exist on another chain. Owners using one can point their name at their own resolver.
- **`.pdai` and `.hex` names never end in `.eth`.** `alice.hex` and `alice.hex.eth` are different
  names.

## Reference implementation

This repository is a MetaMask snap that does all of the above:
[`src/names.ts`](src/names.ts) is about 250 lines of TypeScript, tested against real names on both
chains.
