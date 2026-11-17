# PulseChain Names: questions and answers

PulseChain Names is a MetaMask snap: an add-on for MetaMask. For step-by-step guides and fixes for
common problems, see the [knowledge base](KNOWLEDGE_BASE.md). Still stuck?
[Ask for help](#how-do-i-get-support).

- [What does PulseChain Names do?](#what-does-pulsechain-names-do)
- [What doesn't it do?](#what-doesnt-it-do)
- [How do I install it?](#how-do-i-install-it)
- [How do I use it?](#how-do-i-use-it)
- [Which names does it work with?](#which-names-does-it-work-with)
- [How do I get a name?](#how-do-i-get-a-name)
- [Is it safe? What can it do?](#is-it-safe-what-can-it-do)
- [Does it cost anything?](#does-it-cost-anything)
- [How do I turn it off or remove it?](#how-do-i-turn-it-off-or-remove-it)
- [Who makes it?](#who-makes-it)
- [How do I get support?](#how-do-i-get-support)

## What does PulseChain Names do?

It lets you send to a name instead of a long `0x…` address. Type a `.hex`, `.pdai` or `.pls` name
in MetaMask's send screen, and MetaMask shows the address the name points to, and which name
service found it.

It also works the other way round: where MetaMask shows an address, it can show the name that
address has chosen as its own (its primary name), after checking that the name really points back
to that address.

## What doesn't it do?

- **It never sends, signs or approves anything.** You still review and confirm every transaction
  yourself, in MetaMask, as usual.
- **It never sees your recovery phrase or private keys,** and can't move your funds.
- **It doesn't register, renew or change names.** You do that on each name service's own website
  (see [How do I get a name?](#how-do-i-get-a-name)).
- **It only works on PulseChain and Ethereum,** and only for names ending in `.hex`, `.pdai` and
  `.pls`. `.pdai` and `.pls` names live on PulseChain only, so they don't work when MetaMask is on
  Ethereum. (`.eth` names are looked up by MetaMask itself.)
- **It can't tell you who is behind a name.** It shows where a name points right now. The name's
  owner can change that, so check the address with the person you're paying.

## How do I install it?

You need MetaMask's browser extension on a computer.

1. Open the [MetaMask Snaps Directory](https://snaps.metamask.io) and search for **PulseChain
   Names**.
2. Click **Add to MetaMask**.
3. MetaMask asks to connect: click **Connect**. It then shows what the snap can do: "Provide domain
   and address lookups" and "Access the internet" ([why](#is-it-safe-what-can-it-do)). Click
   **Confirm**, then **OK**.
4. For `.pdai` and `.pls` names, and `.hex` names on PulseChain, MetaMask needs the PulseChain
   network. If you don't have it yet, see
   [Add PulseChain to MetaMask](KNOWLEDGE_BASE.md#add-pulsechain-to-metamask).

PulseChain Names appears in the directory once MetaMask has reviewed and approved it. Until then,
it can only be installed in [MetaMask Flask](https://metamask.io/flask/), MetaMask's edition for
developers, by its npm name, `npm:pulsechain-names-snap`.

## How do I use it?

1. In MetaMask, choose the **PulseChain** network (or **Ethereum**, for `.hex` names).
2. Click **Send**.
3. In the **To** box, type a name, such as `mick.hex`. Capital letters don't matter: `MICK.hex`
   finds `mick.hex`.
4. After a moment, MetaMask shows the address under the name, with "Address resolved via HexNS"
   (or pDAI Name Service, or Pulse Domains) beneath it.
5. Check the address is the one you expect, then carry on as usual.

## Which names does it work with?

| Name ending | Name service | On PulseChain | On Ethereum |
|---|---|---|---|
| `.hex` | [HexNS](https://hexns.domains) | Yes | Yes |
| `.pdai` | [pDAI Name Service](https://pdai.domains) | Yes | No |
| `.pls` | [Pulse Domains](https://app.pulse.domains) | Yes | No |

A `.hex` name is registered on PulseChain and copied to Ethereum. A newly registered name works on
Ethereum once its copy arrives there.

Primary names (address to name) show for `.pls` names today. HexNS and pDAI Name Service don't have
primary names yet; PulseChain Names already asks for them, so they'll show as soon as those
services add them.

## How do I get a name?

From the name service itself:

- `.hex` names at [hexns.domains](https://hexns.domains)
- `.pdai` names at [pdai.domains](https://pdai.domains)
- `.pls` names at [app.pulse.domains](https://app.pulse.domains)

Each service sets its own prices and rules, and runs its own support for questions about buying,
renewing or changing a name.

## Is it safe? What can it do?

It asks MetaMask for two permissions, and nothing else:

- **Provide domain and address lookups:** MetaMask asks it about `.hex`, `.pdai` and `.pls` names
  on PulseChain and Ethereum, and about addresses on those two networks.
- **Access the internet:** it reads the names' public records from the PulseChain and Ethereum
  blockchains, through public RPC servers (PulseChain's own and publicnode.com first, with others
  as backups if one is down).

Lookups only read public records. Like any lookup, the server that answers sees the name or address
you looked up. The snap itself keeps no record of your lookups and sends nothing else anywhere.

Its code is public: [github.com/mitchrobertshaw/pulsechain-names-snap](https://github.com/mitchrobertshaw/pulsechain-names-snap).

## Does it cost anything?

No. PulseChain Names is free, and lookups cost no gas. Sending works exactly as before, with the
usual network fee.

## How do I turn it off or remove it?

In MetaMask, open the menu (⋮), choose **Snaps**, then **PulseChain Names**:

- To pause it, switch **Enabled** off.
- To remove it, click **Remove PulseChain Names**, then **Remove Snap**.

## Who makes it?

PulseChain Names is built by [HexNS](https://hexns.domains), the `.hex` name service. It's an
independent, open-source project (MIT license). It reads public records from HexNS, pDAI Name
Service and Pulse Domains.

## How do I get support?

Use the [support form](https://github.com/mitchrobertshaw/pulsechain-names-snap/issues/new/choose)
(it needs a free GitHub account). Tell us the name you typed, which network MetaMask was on, and
what MetaMask showed.

**Never share your recovery phrase or private keys.** Nobody working on PulseChain Names will ever
ask for them, and anyone who does is trying to steal your funds.

For questions about a name itself, such as buying it, renewing it or changing the address it points
to, contact its name service: [HexNS](https://hexns.domains),
[pDAI Name Service](https://pdai.domains) or [Pulse Domains](https://app.pulse.domains).
