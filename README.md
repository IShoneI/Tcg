# DinoWarz TCG

DinoWarz turns a collector's Claynosaurz herd into a public, playable TCG roster. The first working ruleset is the **Core Six** format: six species, three active fighters, three reserves and a short deterministic battle against AI.

## What is playable

- `/deck` — build a Core Six herd from the configured read-only wallet inventory, choose a public herd identity and opt in to local publication.
- `/battle` — select a published collector herd like a retro character, choose an opponent and play the full roster.
- `/gallery` — inspect the wallet's NFTs and generated card data.

The browser includes three sample herds so battles work before a collector publishes one.

## Fairness model

- Every species/class combination has the same 24-point combat-stat budget. Rarity never adds raw attack, health or speed.
- Trait rarity creates bounded **surprise**, changing the flavour of a signature card rather than its power budget.
- An NFT with an on-chain locked class is **Mastered** and receives an extra individual Mastery card plus a permanent public Mastered badge.
- An NFT without a locked class may choose a **Provisional** class, but does not receive that Mastery card.
- A complete qualifying locked-class lineup receives the team Mastery card, `Call of the Veterans`.
- Holding time, purchase price and PFP status do not alter combat stats.

## Skin Bonds

A herd whose members share a skin fights with that skin's battlefield twist. Each bond pairs a benefit with a limitation so no skin breaks the equal stat budget:

| Skin | Benefit | Limitation |
| --- | --- | --- |
| Apres | Strikes Chill the target; a second Chill freezes it solid, cancelling its next action | Strike damage −5% |
| Toxic | Strikes envenom: 4 guard-ignoring damage at end of round for 2 rounds | Healing received −20% |
| Elektra | First strike each round arcs 5 lightning into a second enemy | Guarding grants 20% instead of 25% |
| Coral | The tide restores 3 health to active dinos each round; first heal +6 | Mastery strikes −10% |
| Aqua | A substituted-in dino gains 10% damage reduction that round | Opening-round strikes −10% |
| Volcanic | Dinos below half health strike 10% harder | Vanguard starts round one with 5% less mitigation |
| Other skins / colour bonds | First substitution each match costs 0 Clay | Starting Vanguard −1 Speed in round one |

## Battle rules

- Three active members: Vanguard, Left Wing and Right Wing.
- The remaining herd members are reserves and may substitute during battle.
- Each round the player plans one action per active member: strike, guard, substitute or individual Mastery where eligible.
- Clay is the shared action resource and grows each round.
- Vanguard protects the wings from normal targeting; Soarers and Stalkers can reach wings directly.
- Fatigue and a format round cap stop defensive stalemates.
- The engine is deterministic for a given seed, herd pair and sequence of choices.

## Run locally

Requirements: Node.js 20 or newer and a Helius API key.

1. Copy `.env.example` to `.env.local`.
2. Set `HELIUS_API_KEY` to a valid server-side key.
3. Install dependencies with `npm install`.
4. Start the app with `npm run dev`.
5. Open `http://localhost:3000`.

The configured wallet is read-only. It is not used for signing, authentication or transactions. The browser first uses its wallet-scoped inventory cache; Helius is contacted only through the server route when the inventory is explicitly refreshed or no cache exists.

## Prototype boundary

Herd publication currently uses browser-local storage. This proves opt-in publishing, public herd selection and gameplay without requiring collectors to transfer assets. Production publication still needs wallet-signature authentication, a shared database, delisting and periodic ownership/class revalidation.

The data model includes Genesis Seven and Complete Nine format definitions, but this release intentionally exposes Core Six while the Call of Saga species, class mappings and exact collection trait tables are audited.

## Checks

```sh
npm run lint
npm run build
```
