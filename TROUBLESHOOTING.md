# PulseChain Names: troubleshooting

Fixes for the most common problems. For what PulseChain Names is and how to install it, see the
[FAQ](FAQ.md).

- [MetaMask doesn't show an address when I type a name](#metamask-doesnt-show-an-address-when-i-type-a-name)
- [It says "No address resolution found for this name"](#it-says-no-address-resolution-found-for-this-name)
- [A name works on PulseChain but not on Ethereum](#a-name-works-on-pulsechain-but-not-on-ethereum)
- [The address isn't the one I expected](#the-address-isnt-the-one-i-expected)
- [MetaMask highlights a letter in the name](#metamask-highlights-a-letter-in-the-name)
- [I don't see names next to addresses](#i-dont-see-names-next-to-addresses)
- [Lookups are slow, or only work sometimes](#lookups-are-slow-or-only-work-sometimes)
- [How do I add PulseChain to MetaMask?](#how-do-i-add-pulsechain-to-metamask)
- [I still need help](#i-still-need-help)

## MetaMask doesn't show an address when I type a name

Check these, in order:

1. **The snap is installed and on.** In MetaMask, open the menu (⋮), choose **Snaps**, and check
   **PulseChain Names** is listed with **Enabled** switched on. If it isn't listed,
   [install it](FAQ.md#how-do-i-install-it).
2. **MetaMask is on the right network.** `.hex`, `.pdai` and `.pls` names work on **PulseChain**.
   On **Ethereum**, only `.hex` names work. On any other network, PulseChain Names isn't asked.
3. **The name is typed in full, with its ending,** such as `mick.hex`, not `mick`. Check the
   spelling. Capital letters don't matter.
4. **The name exists and points to an address.** Look it up on its name service's website:
   [hexns.domains](https://hexns.domains), [pdai.domains](https://pdai.domains) or
   [app.pulse.domains](https://app.pulse.domains).
5. **Give it a few seconds.** A lookup can take a moment, longer if a server is slow and the snap
   has to try another.

## It says "No address resolution found for this name"

No name service could give an address for that name on this network. Usually it's one of these:

- The name isn't registered, or it has expired.
- The name is registered, but its owner hasn't set an address for it.
- It's a `.pdai` or `.pls` name and MetaMask is on Ethereum. Switch to PulseChain.
- It's a `.hex` name that was registered very recently and MetaMask is on Ethereum: see
  [the next answer](#a-name-works-on-pulsechain-but-not-on-ethereum).

Check the name on its service's website. If it's registered there with an address set, and you're on
the right network, please [ask for help](#i-still-need-help).

## A name works on PulseChain but not on Ethereum

- `.pdai` and `.pls` names live on PulseChain only. That's how those services work.
- `.hex` names are registered on PulseChain and copied to Ethereum. A newly registered name works
  on Ethereum once its copy arrives there. The HexNS app,
  [app.hexns.domains](https://app.hexns.domains), shows each name's Ethereum copy on the name's
  page.

## The address isn't the one I expected

A name points wherever its owner has set it, and the owner can change that at any time. PulseChain
Names shows where the name points right now.

- Check the address with the person you're paying, another way, before you send.
- For large amounts, send a small test amount first.
- Check the name's spelling: a different name can look very similar.

If you think a name service is giving the wrong answer, please [ask for help](#i-still-need-help).

## MetaMask highlights a letter in the name

MetaMask marks letters that look like others, such as the `m` in `mick.hex` (`m` looks like `rn`),
to warn you about lookalike names. That's MetaMask's own safety check, not an error. Make sure the
name is exactly the one you meant.

## I don't see names next to addresses

PulseChain Names gives MetaMask a name for an address only if that address has chosen a primary
name, and the name points back to the same address.

- **`.pls`:** set your primary name on [app.pulse.domains](https://app.pulse.domains).
- **`.hex` and `.pdai`:** these services don't have primary names yet. PulseChain Names already asks
  for them, so they'll show as soon as the services add them.

## Lookups are slow, or only work sometimes

PulseChain Names reads the blockchains through public servers. If one is down or slow, it waits up
to 6 seconds, then tries the next. So a lookup can occasionally take a little longer, or fail if
every server is having trouble at once.

- Check your internet connection, and try again in a minute.
- Firewalls, VPNs and some browser extensions can block the servers it uses. Try without them.
- If it keeps happening, please [ask for help](#i-still-need-help) and say which network you were
  on.

## How do I add PulseChain to MetaMask?

In MetaMask, open the network menu, choose to add a network, add it manually, and enter:

| Field | Value |
|---|---|
| Network name | PulseChain |
| RPC URL | `https://rpc.pulsechain.com` |
| Chain ID | `369` |
| Currency symbol | `PLS` |
| Block explorer URL | `https://scan.pulsechain.com` |

## I still need help

Use the [support form](https://github.com/mitchrobertshaw/pulsechain-names-snap/issues/new/choose)
(it needs a free GitHub account). Tell us the name or address you looked up, which network MetaMask
was on, and what MetaMask showed. A screenshot helps.

**Never share your recovery phrase or private keys.** Nobody working on PulseChain Names will ever
ask for them, and anyone who does is trying to steal your funds.
