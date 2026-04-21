export type FleetEntry = {
  registration: string;
  icao24: string;
};

export const TMA_FLEET: FleetEntry[] = [
  { registration: '8Q-RAA', icao24: '05A088' },
  { registration: '8Q-RAB', icao24: '05A087' },
  { registration: '8Q-RAC', icao24: '05A085' },
  { registration: '8Q-RAD', icao24: '05A086' },
  { registration: '8Q-RAE', icao24: '05A017' },
  { registration: '8Q-RAF', icao24: '05A08A' },
  { registration: '8Q-RAG', icao24: '05A089' },
  { registration: '8Q-RAH', icao24: '05A018' },
  { registration: '8Q-RAI', icao24: '05A090' },
  { registration: '8Q-RAJ', icao24: '05A095' },
  { registration: '8Q-RAK', icao24: '05A094' },
  { registration: '8Q-RAL', icao24: '05A093' },
  { registration: '8Q-RAM', icao24: '05A0A2' },
  { registration: '8Q-RAN', icao24: '05A0A0' },
  { registration: '8Q-RAO', icao24: '05A0AB' },
  { registration: '8Q-RAP', icao24: '05A0AE' },
  { registration: '8Q-RAQ', icao24: '05A0A5' },
  { registration: '8Q-RAR', icao24: '05A0B3' },
  { registration: '8Q-RAS', icao24: '05A0B4' },
  { registration: '8Q-RAW', icao24: '05A0A4' },
  { registration: '8Q-RAX', icao24: '05A082' },
  { registration: '8Q-RAY', icao24: '05A07E' },
  { registration: '8Q-RAZ', icao24: '05A080' },
];

export const TMA_FLEET_HEX: string[] = TMA_FLEET.map((e) => e.icao24);