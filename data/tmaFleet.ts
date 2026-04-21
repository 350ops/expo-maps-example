export type FleetEntry = {
  registration: string;
  icao24: string | null;
};

export const TMA_FLEET: FleetEntry[] = [
  { registration: '8Q-RAA', icao24: null },
  { registration: '8Q-RAB', icao24: null },
  { registration: '8Q-RAC', icao24: null },
  { registration: '8Q-RAD', icao24: null },
  { registration: '8Q-RAE', icao24: null },
  { registration: '8Q-RAF', icao24: null },
  { registration: '8Q-RAG', icao24: null },
  { registration: '8Q-RAH', icao24: null },
  { registration: '8Q-RAI', icao24: null },
  { registration: '8Q-RAJ', icao24: null },
  { registration: '8Q-RAK', icao24: null },
  { registration: '8Q-RAL', icao24: null },
  { registration: '8Q-RAM', icao24: null },
  { registration: '8Q-RAN', icao24: null },
  { registration: '8Q-RAO', icao24: null },
  { registration: '8Q-RAP', icao24: null },
  { registration: '8Q-RAQ', icao24: null },
  { registration: '8Q-RAR', icao24: null },
  { registration: '8Q-RAS', icao24: null },
  { registration: '8Q-RAT', icao24: null },
  { registration: '8Q-RAU', icao24: null },
  { registration: '8Q-RAV', icao24: null },
  { registration: '8Q-RAW', icao24: null },
  { registration: '8Q-RAX', icao24: null },
  { registration: '8Q-RAY', icao24: null },
  { registration: '8Q-RAZ', icao24: null },
];

export const TMA_FLEET_HEX: string[] = TMA_FLEET.map((e) => e.icao24).filter(
  (hex): hex is string => hex !== null,
);
