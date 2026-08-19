export const SITE = {
  name: "Aigarth Cloud",
  shortName: "Aigarth",
  domain: "aigarth.cloud",
  description:
    "The decentralized AI cloud. Stake QUBIC to reserve intelligent compute, launch AI products, and monetize infrastructure through Useful Proof of Work.",
  url: "https://aigarth.cloud",
  twitter: "@aigarthcloud",
  email: "hello@aigarth.cloud",
} as const;

export const NAV = {
  platform: {
    label: "Platform",
    items: [
      {
        title: "Useful Proof of Staking",
        href: "/useful-proof-of-staking",
        description: "How staking powers the network and earns revenue.",
      },
      {
        title: "AI Compute",
        href: "/ai-compute",
        description: "Reserve and run inference at global scale.",
      },
      {
        title: "Outsourced Computation",
        href: "/outsourced-computation",
        description: "Offload heavy work to a verified compute layer.",
      },
      {
        title: "Oracle Network",
        href: "/oracle-network",
        description: "Trust-minimized data feeds for any application.",
      },
    ],
  },
  products: {
    label: "Products",
    href: "/products",
    items: [
      { title: "AI Inference", href: "/inference" },
      { title: "Embeddings", href: "/embeddings" },
      { title: "Image Generation", href: "/image" },
      { title: "Video Generation", href: "/video" },
      { title: "Voice", href: "/voice" },
      { title: "Reasoning Models", href: "/reasoning" },
      { title: "Fine-Tuning", href: "/fine-tuning" },
      { title: "Agents", href: "/agents" },
      { title: "Batch Processing", href: "/batch" },
      { title: "Compute Clusters", href: "/clusters" },
      { title: "GPU Marketplace", href: "/gpu-marketplace" },
      { title: "Oracle Services", href: "/oracle" },
    ],
  },
  anns: { label: "ANNs", href: "/anns" },
  marketplace: { label: "Marketplace", href: "/marketplace" },
  pricing: { label: "Pricing", href: "/pricing" },
  developers: { label: "Developers", href: "/developers" },
  enterprise: { label: "Enterprise", href: "/enterprise" },
  security: { label: "Security", href: "/security" },
  company: {
    label: "Company",
    items: [
      { title: "About", href: "/about" },
      { title: "Customers", href: "/customers" },
      { title: "Case Studies", href: "/case-studies" },
      { title: "Ecosystem", href: "/ecosystem" },
      { title: "Careers", href: "/careers" },
      { title: "Blog", href: "/blog" },
      { title: "Roadmap", href: "/roadmap" },
    ],
  },
  ipo: { label: "IPO", href: "/ipo" },
  docs: { label: "Docs", href: "/docs" },
} as const;

export const FOOTER = {
  platform: [
    { label: "Useful Proof of Staking", href: "/useful-proof-of-staking" },
    { label: "AI Compute", href: "/ai-compute" },
    { label: "Outsourced Computation", href: "/outsourced-computation" },
    { label: "Oracle Network", href: "/oracle-network" },
    { label: "Pricing", href: "/pricing" },
  ],
  participate: [
    { label: "Genesis Offering", href: "/ipo" },
    { label: "Pioneer", href: "/ipo#participate" },
    { label: "Builder", href: "/ipo#participate" },
    { label: "Infrastructure Partner", href: "/ipo#participate" },
    { label: "Enterprise Partner", href: "/ipo#participate" },
  ],
  products: [
    { label: "AI Inference", href: "/inference" },
    { label: "Embeddings", href: "/embeddings" },
    { label: "Image Generation", href: "/image" },
    { label: "Voice", href: "/voice" },
    { label: "Reasoning Models", href: "/reasoning" },
    { label: "Fine-Tuning", href: "/fine-tuning" },
  ],
  developers: [
    { label: "Documentation", href: "/docs" },
    { label: "API Reference", href: "/docs/api" },
    { label: "SDKs", href: "/docs/sdks" },
    { label: "CLI", href: "/docs/cli" },
    { label: "Status", href: "/status" },
  ],
  company: [
    { label: "About", href: "/about" },
    { label: "Careers", href: "/careers" },
    { label: "Press", href: "/press" },
    { label: "Brand", href: "/brand" },
    { label: "Contact", href: "/contact" },
  ],
  legal: [
    { label: "Privacy", href: "/legal/privacy" },
    { label: "Terms", href: "/legal/terms" },
    { label: "Security", href: "/security" },
    { label: "Acceptable Use", href: "/legal/aup" },
  ],
} as const;
