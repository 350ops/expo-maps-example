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
];