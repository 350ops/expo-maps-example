export type WindSource = 'era5' | 'gfs';

export type Wind = {
  speedKn: number;
  directionDeg: number;
  gustsKn?: number;
  source: WindSource;
  sampledAt: number;
};
