export const notion = (id: string) => `https://app.notion.com/p/${id}`;
export const sources = {
  root: notion("3afbe780ce1a83b883d18111ca195c69"),
  home: notion("3f1be780ce1a81ccbd9ce0331175706f"),
  tasks: notion("5a5be780ce1a83409023815e44656150"),
} as const;
