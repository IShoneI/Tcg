/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "arweave.net" },
      { protocol: "https", hostname: "*.arweave.net" },
      { protocol: "https", hostname: "nftstorage.link" },
      { protocol: "https", hostname: "*.ipfs.nftstorage.link" },
      { protocol: "https", hostname: "ipfs.io" },
      { protocol: "https", hostname: "img.fotofolio.xyz" },
    ],
  },
  webpack: (config) => {
    // Fix for @solana/web3.js and wallet-adapter in Next.js
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      os: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

module.exports = nextConfig;
