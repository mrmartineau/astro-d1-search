declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}

declare module "virtual:astro-d1-search-config" {
  const config: {
    binding: string;
    types: string[];
    cors: boolean;
    cacheMaxAge: number;
    maxLimit: number;
    maxOffset: number;
    maxQueryLength: number;
    weights: {
      title: number;
      description: number;
      content: number;
      tags: number;
    };
    recency: { boost: number; windowDays: number };
    maxTerms: number;
    snippetTokens: number;
  };
  export default config;
}
