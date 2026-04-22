export type Resort = {
  id: string;
  name: string;
  atoll: string;
  coord: { latitude: number; longitude: number };
  approachRadiusNm: number;
};

export const RESORTS: Resort[] = [
  {
    id: 'raaya-atmosphere',
    name: 'RAAYA by Atmosphere',
    atoll: 'Raa Atoll',
    coord: { latitude: 5.58411, longitude: 73.04270 },
    approachRadiusNm: 30,
  },
  {
    id: 'soneva-fushi',
    name: 'Soneva Fushi',
    atoll: 'Baa Atoll',
    coord: { latitude: 5.11180, longitude: 73.07866 },
    approachRadiusNm: 30,
  },
  {
    id: 'soneva-jani',
    name: 'Soneva Jani',
    atoll: 'Noonu Atoll',
    coord: { latitude: 5.71403, longitude: 73.41569 },
    approachRadiusNm: 30,
  },
  {
    id: 'soneva-secret',
    name: 'Soneva Secret',
    atoll: 'Haa Dhaalu Atoll',
    coord: { latitude: 6.31894, longitude: 72.63802 },
    approachRadiusNm: 30,
  },
  {
    id: 'niyama-private-islands',
    name: 'Niyama Private Islands Maldives',
    atoll: 'Dhaalu Atoll',
    coord: { latitude: 2.68166, longitude: 72.93295 },
    approachRadiusNm: 30,
  }
];