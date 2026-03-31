const storiesFixture = [
  {
    id: 'story-001',
    title: 'The Day the Harbor Fell Silent',
    narrative: [
      'By dusk, the harbor had stopped sounding like work and started sounding like memory. Dockworkers stood shoulder to shoulder, watching the final coal freighter disappear beyond the lighthouse while gulls traced circles overhead.',
      'Years later, elders still describe how the waterfront smelled that evening: salt, iron, wet rope, and the last heat of summer. The closure of the port scattered livelihoods, but it also pushed families inland, where neighborhood markets and new workshops reshaped the district.',
      'Today, the old quay is a promenade. Children race along the stones where cranes once swung, and every bench holds some version of the same sentence: this place used to hum.'
    ],
    status: 'published' as const,
    location: {
      name: 'Golden Horn Docklands',
      latitude: 41.0284,
      longitude: 28.9647,
    },
    timePeriod: 'Late 1970s',
    contributorName: 'Aylin Demir',
    submittedAt: '2026-03-18',
    mediaUrl: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80',
    likeCount: 27,
    likedByViewer: false,
    comments: [
      {
        id: 'comment-001',
        authorName: 'Mert Kaya',
        body: 'My grandfather worked here for thirty years. The promenade still feels strange to him.',
        createdAt: '2026-03-20',
      },
      {
        id: 'comment-002',
        authorName: 'Selin Aras',
        body: 'The sensory details in this story are wonderful. You can almost hear the harbor.',
        createdAt: '2026-03-21',
      },
    ],
  },
  {
    id: 'story-002',
    title: 'Lanterns Above the Hill Market',
    narrative: [
      'Every winter festival, residents climbed the hill before sunset and tied paper lanterns from one shuttered storefront to the next. The market below would glow in bands of red, amber, and blue until midnight.',
      'Shopkeepers used the light to keep their stalls open longer, and children competed to spot the first lantern reflected in the fountain. The tradition lasted decades before municipal wiring made the ceremony unnecessary, but the route is still walked every December.'
    ],
    status: 'published' as const,
    location: {
      name: 'Cibali Hill Market',
      latitude: 41.0249,
      longitude: 28.9548,
    },
    timePeriod: '1950s to 1980s',
    contributorName: 'Emre Yildiz',
    submittedAt: '2026-03-12',
    likeCount: 11,
    likedByViewer: true,
    comments: [
      {
        id: 'comment-003',
        authorName: 'Zeynep Polat',
        body: 'My mother still calls it the lantern walk.',
        createdAt: '2026-03-14',
      },
    ],
  },
];

export const storiesRemoteSource = {
  async getStory(id: string) {
    return storiesFixture.find((story) => story.id === id) ?? null;
  },
};

export const storiesLocalSource = {
  getStories() {
    return storiesFixture;
  },
};
