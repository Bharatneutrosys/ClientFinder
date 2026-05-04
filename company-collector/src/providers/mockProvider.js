export function createMockProvider({ enabled = false } = {}) {
  return {
    id: "mock_provider",
    isEnabled() {
      return enabled;
    },
    async search(input) {
      return [
        {
          id: "mock-001",
          name: `${input.city} TalentForge Consulting`,
          address: `100 Main St, ${input.city}, ${input.state}`,
          city: input.city,
          state: input.state,
          phone: "(555) 010-1000",
          website: "https://talentforge.example.com",
          source: "mock_provider",
          source_url: "https://mock-provider.local/company/mock-001",
          keyword: input.keyword,
          confidence_score: 0.78,
        },
      ];
    },
  };
}
