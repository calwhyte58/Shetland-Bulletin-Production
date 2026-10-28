export enum BulletinType {
  DSP = 'DSP',
  PSP = 'PSP',
  ASP = 'ASP',
  AZA_YTX = 'AZA_YTX',
  SST = 'SST',
  SSC = 'SSC',
  KARENIA = 'KARENIA',
  CHLOROPHYLL = 'CHLOROPHYLL',
  WIND_ROSE = 'WIND_ROSE',
  SUMMARY = 'SUMMARY',
  FORECAST = 'FORECAST',
  ANALYSIS = 'ANALYSIS'
}

export interface WeeklyReport {
  id?: string;
  type: BulletinType;
  weekNumber: number;
  startDate: string;
  endDate: string;
  targetDate: string;
  manualWeekNumber?: number;
  manualDateRange?: string;
  toxinMapUrl: string;
  phytoMapUrl: string;
  additionalMapUrls?: string[];
  mapDates?: string[];
  forecastDates?: string[];
  commentary?: string;
  biotoxinReport?: string;
  biotoxins?: {
    asp: string;
    aza: string;
    dsp: string;
    psp: string;
    ytx: string;
  };
  harmfulAlgaeReport?: string;
  harmfulAlgae?: {
    alexandrium: string;
    dinophysis: string;
    karenia: string;
    prorocentrum: string;
    pseudoDelicatissima: string;
    pseudoSeriata: string;
  };
  trendsForecast?: string;
  trends?: {
    alexandriumPsp: string;
    dinophysisDsp: string;
    pseudoNitzschiaAsp: string;
    azaYtx: string;
    riskPsp: string;
    riskDsp: string;
    riskAsp: string;
    riskYtx: string;
    riskAza: string;
  };
  kareniaStatus?: string;
  kareniaDescription?: string;
  predictionRisk?: string;
  predictionWhy?: string;
  windRoseMonth?: string;
  createdAt: string;
}

export interface BulletinState {
  reports: WeeklyReport[];
  loading: boolean;
  error: string | null;
}
