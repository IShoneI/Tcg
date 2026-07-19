const DEFAULT_DEMO_WALLET = "BmFUGjWXwM1qbXfm8RDaqYDVkb6aDJmHbpXAvhRQav9Z";

export const demoWalletAddress =
  process.env.NEXT_PUBLIC_DEMO_WALLET_ADDRESS ?? DEFAULT_DEMO_WALLET;

export const isDemoWalletEnabled = demoWalletAddress.length > 0;
