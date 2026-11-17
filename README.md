# PulseChain Names, a MetaMask snap

Type a name instead of a `0x…` address in MetaMask's send screen:

| Ending | Name service | On PulseChain | On Ethereum |
|---|---|---|---|
| `.hex` | [HexNS](https://hexns.domains) | yes | yes, through its copy on Ethereum |
| `.pdai` | [pDAI Name Service](https://pdai.domains) | yes | no: `.pdai` lives on PulseChain only |
| `.pls` | [Pulse Domains](https://app.pulse.domains) | yes | no: `.pls` lives on PulseChain only |

It also works the other way: where MetaMask shows an address, it can show the name the address has
chosen as its own (a primary name), if that name points back to the same address. `.pls` names
have primary names today. `.hex` and `.pdai` don't yet; the snap already asks for them, so they'll
show as soon as those services add them.

**Using it?** The [FAQ](FAQ.md) covers installing and using it, and what it does and doesn't do. If
something isn't working, see [Troubleshooting](TROUBLESHOOTING.md), or
[ask for help](https://github.com/mitchrobertshaw/pulsechain-names-snap/issues/new/choose).

Built by [HexNS](https://hexns.domains). Building a wallet? [WALLETS.md](WALLETS.md) explains how to
look up all three kinds of name, with the contracts and code.

## How it looks names up

Only public records, read from the chains. The snap never signs or sends anything, and never sees
a key.

- **`.hex` and `.pdai`** are [ENSv2](https://github.com/ensdomains/contracts-v2) registries. Each has
  a `UniversalResolverV2`, which the snap asks for `addr(node, coinType)`: on PulseChain the
  PulseChain address first (ENSIP-11 coin type `0x80000171`), then the address for any EVM chain
  (ENSIP-19, `0x80000000`), then the Ethereum address (coin type 60). On Ethereum, only the
  Ethereum address.
- **`.pls`** is an ENS-style registry (as ENS was before ENSv2): the registry gives a name's
  resolver, and the resolver its `addr(node)`. Primary names come from the reverse records under
  `addr.reverse`, and are checked forward before they're shown.

| | Chain | Address |
|---|---|---|
| `.hex` UniversalResolverV2 | PulseChain | [`0x774822450c94A9fdD82febb3aF528C8e6e192bae`](https://scan.pulsechain.com/address/0x774822450c94A9fdD82febb3aF528C8e6e192bae) |
| `.hex` UniversalResolverV2 | Ethereum | [`0xccDB62C6133E761B4B6ffE597205e377aF612BDF`](https://etherscan.io/address/0xccDB62C6133E761B4B6ffE597205e377aF612BDF#code) |
| `.pdai` UniversalResolverV2 | PulseChain | [`0x394363Dfbb7A2FFE2C8b0B70DB53157653E0be8A`](https://scan.pulsechain.com/address/0x394363Dfbb7A2FFE2C8b0B70DB53157653E0be8A) |
| Pulse Domains registry (`.pls`) | PulseChain | [`0xbd5133993FCDED5945c5539D9f032261F0d13170`](https://scan.pulsechain.com/address/0xbd5133993FCDED5945c5539D9f032261F0d13170) |

All four are verified: their source code is published on PulseChain's explorer and Etherscan.

Names are normalized as ENS does (ENSIP-15), so `MICK.hex` finds `mick.hex`.

**Privacy.** The snap asks public RPC servers (PulseChain's and publicnode.com first, see
`src/rpc.ts`), trying the next if one is down or slow. Like any lookup, the server you ask sees the
name or address you looked up.

**Permissions.** `endowment:name-lookup`, for chains `eip155:369` (PulseChain) and `eip155:1`
(Ethereum) and the endings `hex`, `pdai` and `pls`; and `endowment:network-access`, to read the
chains.

**Icon.** PulseChain's logo, from pulsechain.com, on a very light grey background
(`images/icon.svg`).

## Try it

Until MetaMask approves it for everyone (below), the snap only installs in
[MetaMask Flask](https://metamask.io/flask/), MetaMask's edition for developers. Use Flask in a
browser profile of its own, with a new wallet: never your main recovery phrase. You also need
[Node.js](https://nodejs.org) 20 or newer.

```bash
npm ci
npm run sandbox
```

That builds the snap and starts MetaMask's Snaps Sandbox at http://localhost:8080. Open that page
in the browser with Flask, click **Install Snap**, and approve in Flask. The snap stays installed
after you stop the sandbox.

Then, in Flask, switch to PulseChain (chain 369; add it if Flask doesn't have it), start a send,
and type `mick.hex` as the recipient: Flask shows the address, found by HexNS. Try
`testname.pdai` and `pdai.pls` too, and `mick.hex` with Flask on Ethereum.

## Tests

```bash
npm run typecheck
npm run build
npm test
npm run test:live
```

`npm test` checks the lookup logic against pretend contracts, and installs the built snap in
MetaMask's snap simulator. `npm run test:live` also looks up real names on PulseChain and Ethereum
(`mick.hex`, `testname.pdai`, `pdai.pls`, and `pdai.pls`'s address), and checks that each RPC
server the snap uses still answers. CI runs both.

## Getting it into MetaMask

A snap that looks names up needs MetaMask's approval before regular MetaMask can install it. It
doesn't need an audit: that's only for snaps that handle keys.

1. **Public source code.** MetaMask asks that anyone can read the snap's source: this repository.
2. **Publish it to npm**, from GitHub, with no command line: it's
   [`pulsechain-names-snap`](https://www.npmjs.com/package/pulsechain-names-snap) on npm. npm's
   staged publishing puts each version on hold until a maintainer approves it, so nothing goes live
   without you. To publish a version:
   - The first time only: on npmjs.com, in the package's **Settings**, add a **Trusted Publisher**:
     GitHub Actions, with `mitchrobertshaw` as the user, `pulsechain-names-snap` as the repository
     and `publish.yml` as the workflow filename. This lets the workflow sign in without a token. Add
     it just before you publish: npm expires a new Trusted Publisher that isn't used within 2 days.
     Once used, it stays.
   - Open Actions, choose **Publish to npm**, and click **Run workflow**. It builds the snap,
     checks the manifest matches the build, runs every test, and stages `pulsechain-names-snap`
     with its source (`src/`) and the bundle, with provenance.
   - On npmjs.com, open **Staged Packages** in your account settings, check the version and its
     SHASUM, and click **Approve**, with your two-factor code. It's then public.

   Version 0.1.0 was staged with a short-lived "stage only" token instead, since deleted.
3. **Scan it** with [Snapper](https://github.com/sayfer-io/Snapper), which MetaMask asks for, and fix
   anything it reports. Snapper 0.19.1 reports one thing for version 0.1.1, a false alarm: it takes
   the text `application/json` in `src/rpc.ts`, the content type of every JSON-RPC request, for a
   possible secret, as it looks like base64.
4. **Ask for approval** with the
   [Snaps Directory Information form](https://go.metamask.io/snaps-directory-request): the name
   (`PulseChain Names`, which must match `proposedName` in the manifest, and can't contain
   "MetaMask", "Snap", "Meta" or "Mask"), the builder and website (hexns.domains), short and long
   descriptions, the version (`0.1.1`), a support contact, screenshots, and ideally a short demo
   video.
5. **Review.** MetaMask's Snaps team reviews it (two approvals). Once allowlisted, it appears in the
   [Snaps Directory](https://snaps.metamask.io), and the websites can offer an install button.
6. **Updates.** Raise `version` in both `package.json` and `snap.manifest.json`, run
   `npm run build` (it updates the manifest's checksum) and commit both. Then publish it as in
   step 2, and ask MetaMask to approve the new version with their update form: until they do,
   regular MetaMask keeps installing the version they approved.
