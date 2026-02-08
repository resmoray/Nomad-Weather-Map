import type { SeasonLabel } from "../../types/season";
import type { Month } from "../../types/weather";

export interface FixedSeasonSource {
  name: string;
  url: string;
}

export interface FixedSeasonProfile {
  regionId: string;
  marketByMonth: Record<Month, SeasonLabel>;
  climateByMonth: Record<Month, SeasonLabel>;
  marketReason: string;
  climateReason: string;
  sources: FixedSeasonSource[];
  lastReviewed: string;
}

interface SeasonTemplate {
  marketByMonth: Record<Month, SeasonLabel>;
  climateByMonth: Record<Month, SeasonLabel>;
  marketReason: string;
  climateReason: string;
  sources: FixedSeasonSource[];
}

const REVIEWED_AT = "2026-02-07";
const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

function asMonths(values: number[]): Month[] {
  return values as Month[];
}

function buildByMonth(high: Month[], shoulder: Month[], off: Month[]): Record<Month, SeasonLabel> {
  const table: Partial<Record<Month, SeasonLabel>> = {};

  for (const month of high) {
    table[month] = "high";
  }

  for (const month of shoulder) {
    table[month] = "shoulder";
  }

  for (const month of off) {
    table[month] = "off";
  }

  for (const month of ALL_MONTHS) {
    if (!table[month]) {
      table[month] = "shoulder";
    }
  }

  return table as Record<Month, SeasonLabel>;
}

function makeTemplate(config: {
  marketHigh: Month[];
  marketShoulder: Month[];
  marketOff: Month[];
  climateHigh: Month[];
  climateShoulder: Month[];
  climateOff: Month[];
  marketReason: string;
  climateReason: string;
  sources: FixedSeasonSource[];
}): SeasonTemplate {
  return {
    marketByMonth: buildByMonth(config.marketHigh, config.marketShoulder, config.marketOff),
    climateByMonth: buildByMonth(config.climateHigh, config.climateShoulder, config.climateOff),
    marketReason: config.marketReason,
    climateReason: config.climateReason,
    sources: config.sources,
  };
}

const SOURCES_SHARED: FixedSeasonSource[] = [
  {
    name: "Open-Meteo climate datasets (monthly climate context)",
    url: "https://open-meteo.com/en/docs/climate-api",
  },
  {
    name: "UN Tourism seasonality context",
    url: "https://www.unwto.org/tourism-data",
  },
];

const SOURCES_VIETNAM: FixedSeasonSource[] = [
  {
    name: "Vietnam National Tourism weather guide by region",
    url: "https://vietnam.travel/things-to-do/weather-vietnam-when-and-where-go",
  },
  ...SOURCES_SHARED,
];

const SOURCES_DA_NANG: FixedSeasonSource[] = [
  {
    name: "Da Nang Tourism Portal: rainy season Sep-Dec, heaviest rain Oct-Dec",
    url: "https://danangfantasticity.com/weather-da-nang",
  },
  {
    name: "Da Nang Tourism Portal: My Son guide (dry Feb-Aug, rainy Sep-Jan in central region)",
    url: "https://danangfantasticity.com/en/my-son-sanctuary/",
  },
  {
    name: "Da Nang City Portal: summer tourism demand spikes (Apr-May holiday + Enjoy Da Nang summer events)",
    url: "https://www.danang.gov.vn/vi/web/eng-dng/w/external-information-on-the-economy-politics-culture-and-society-in-da-nang-city-from-may-26-to-31",
  },
];

const SOURCES_PHILIPPINES: FixedSeasonSource[] = [
  {
    name: "PAGASA climate of the Philippines (rainy Jun-Nov, dry Dec-May)",
    url: "https://bagong.pagasa.dost.gov.ph/information/climate-philippines",
  },
  {
    name: "Philippines Department of Tourism destination guidance",
    url: "https://www.tourism.gov.ph/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_THAILAND_MAINLAND: FixedSeasonSource[] = [
  {
    name: "Thai Meteorological Department seasonal updates",
    url: "https://www.tmd.go.th/en",
  },
  {
    name: "Tourism Authority of Thailand seasonal travel planning",
    url: "https://www.tourismthailand.org/Articles/plan-a-trip-to-thailand-according-to-seasons",
  },
  ...SOURCES_SHARED,
];

const SOURCES_THAILAND_ANDAMAN: FixedSeasonSource[] = [
  {
    name: "Thai Meteorological Department southwest monsoon guidance",
    url: "https://www.tmd.go.th/en",
  },
  {
    name: "Tourism Authority of Thailand coastal season planning",
    url: "https://www.tourismthailand.org/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_SINGAPORE: FixedSeasonSource[] = [
  {
    name: "Meteorological Service Singapore monsoon seasons",
    url: "https://www.weather.gov.sg/climate-climate-of-singapore/",
  },
  {
    name: "Visit Singapore travel planning (seasonality and events)",
    url: "https://www.visitsingapore.com/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_MALAYSIA: FixedSeasonSource[] = [
  {
    name: "MetMalaysia monsoon and weather phenomena guidance",
    url: "https://www.met.gov.my/en/",
  },
  {
    name: "Malaysia official travel planning portal",
    url: "https://www.malaysia.travel/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_INDONESIA: FixedSeasonSource[] = [
  {
    name: "BMKG climate and season monitoring",
    url: "https://www.bmkg.go.id/iklim/",
  },
  {
    name: "Indonesia official tourism planning portal",
    url: "https://www.indonesia.travel/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_BALI: FixedSeasonSource[] = [
  {
    name: "BPS Bali monthly tourism indicators",
    url: "https://bali.bps.go.id/en/pressrelease.html",
  },
  {
    name: "Bali disaster agency on BMKG rainy season timing",
    url: "https://bpbd.baliprov.go.id/index.php/article/3854/musim-hujan-bali-diprediksi-dimulai-september-bpbd-hadiri-sosialisasi-bmkg",
  },
  {
    name: "Indonesia Travel Bali weather guidance",
    url: "https://indonesia.travel/content/indtravelrevamp/id/en/trip-ideas/things-to-know-about-weather-and-best-times-to-travel-to-bali.html",
  },
  ...SOURCES_SHARED,
];

const SOURCES_CAMBODIA: FixedSeasonSource[] = [
  {
    name: "Cambodia Ministry of Tourism weather seasons",
    url: "https://www.tourismcambodia.org/public/about-cambodia/weather-in-cambodia-1546851637",
  },
  ...SOURCES_SHARED,
];

const SOURCES_LAOS: FixedSeasonSource[] = [
  {
    name: "Lao Department of Meteorology and Hydrology",
    url: "https://www.dmhlao.gov.la/",
  },
  {
    name: "Official Lao tourism planning portal",
    url: "https://tourismlaos.org",
  },
  ...SOURCES_SHARED,
];

const SOURCES_MYANMAR: FixedSeasonSource[] = [
  {
    name: "Myanmar Department of Meteorology and Hydrology",
    url: "https://www.moezala.gov.mm/",
  },
  {
    name: "Myanmar tourism planning portal",
    url: "https://www.myanmar.travel/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_BRUNEI: FixedSeasonSource[] = [
  {
    name: "Brunei Darussalam Meteorological Department",
    url: "https://www.met.gov.bn/SitePages/Home.aspx",
  },
  {
    name: "Brunei tourism planning portal",
    url: "https://www.bruneitourism.com/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_TIMOR: FixedSeasonSource[] = [
  {
    name: "Timor-Leste climate profile (World Bank Climate Knowledge Portal)",
    url: "https://climateknowledgeportal.worldbank.org/country/timor-leste",
  },
  {
    name: "Timor-Leste official government portal",
    url: "https://www.timorleste.tl/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_SRI_LANKA: FixedSeasonSource[] = [
  {
    name: "Department of Meteorology Sri Lanka (official climate and monsoon context)",
    url: "https://meteo.gov.lk/",
  },
  {
    name: "Sri Lanka weather and monsoon overview (official meteorology publication)",
    url: "https://www.jma.go.jp/jma/jma-eng/jma-center/rsmc-hp-pub-eg/techrev/text14-2.pdf",
  },
  {
    name: "Sri Lanka Tourism weather planning by coast/season",
    url: "https://www.srilanka.travel/pristine-beaches",
  },
  ...SOURCES_SHARED,
];

const SOURCES_JAPAN: FixedSeasonSource[] = [
  {
    name: "Japan Meteorological Agency climate information",
    url: "https://www.jma.go.jp/jma/indexe.html",
  },
  {
    name: "Japan National Tourism Organization seasonal planning",
    url: "https://www.japan.travel/en/plan/climate/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_AUSTRIA: FixedSeasonSource[] = [
  {
    name: "GeoSphere Austria climate and weather service",
    url: "https://www.geosphere.at/en",
  },
  {
    name: "Austria Tourism travel planning portal",
    url: "https://www.austria.info/en",
  },
  ...SOURCES_SHARED,
];

const SOURCES_SPAIN: FixedSeasonSource[] = [
  {
    name: "AEMET (State Meteorological Agency of Spain)",
    url: "https://www.aemet.es/en/portada",
  },
  {
    name: "Official Spain Tourism portal",
    url: "https://www.spain.info/en/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_MOROCCO: FixedSeasonSource[] = [
  {
    name: "World Bank Climate Knowledge Portal (Morocco)",
    url: "https://climateknowledgeportal.worldbank.org/country/morocco",
  },
  {
    name: "Visit Morocco tourism planning portal",
    url: "https://www.visitmorocco.com/en",
  },
  ...SOURCES_SHARED,
];

const SOURCES_SOUTH_KOREA: FixedSeasonSource[] = [
  {
    name: "Korea Meteorological Administration",
    url: "https://www.weather.go.kr/w/index.do?lang=en",
  },
  {
    name: "Korea Tourism Organization travel planning portal",
    url: "https://english.visitkorea.or.kr/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_CHINA: FixedSeasonSource[] = [
  {
    name: "China Meteorological Administration",
    url: "https://www.cma.gov.cn/en2014/",
  },
  {
    name: "World Bank Climate Knowledge Portal (China)",
    url: "https://climateknowledgeportal.worldbank.org/country/china",
  },
  ...SOURCES_SHARED,
];

const SOURCES_TAIWAN: FixedSeasonSource[] = [
  {
    name: "Central Weather Administration (Taiwan)",
    url: "https://www.cwa.gov.tw/eng/",
  },
  {
    name: "Taiwan Tourism Administration travel planning portal",
    url: "https://eng.taiwan.net.tw/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_AUSTRALIA: FixedSeasonSource[] = [
  {
    name: "Australian Bureau of Meteorology climate guidance",
    url: "https://www.bom.gov.au/climate/",
  },
  {
    name: "Tourism Australia weather and planning guide",
    url: "https://www.australia.com/en/facts-and-planning/weather-in-australia.html",
  },
  ...SOURCES_SHARED,
];

const SOURCES_NEW_ZEALAND: FixedSeasonSource[] = [
  {
    name: "MetService New Zealand",
    url: "https://www.metservice.com/national",
  },
  {
    name: "100% Pure New Zealand climate and seasons guide",
    url: "https://www.newzealand.com/int/feature/new-zealand-climate-and-weather/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_NORDICS: FixedSeasonSource[] = [
  {
    name: "World Meteorological Organization climate resources",
    url: "https://wmo.int/",
  },
  {
    name: "Nordic tourism season planning context",
    url: "https://www.visitnordics.com/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_CANADA: FixedSeasonSource[] = [
  {
    name: "Environment and Climate Change Canada weather and climate",
    url: "https://weather.gc.ca/",
  },
  {
    name: "Destination Canada travel planning portal",
    url: "https://www.destinationcanada.com/en",
  },
  ...SOURCES_SHARED,
];

const SOURCES_USA: FixedSeasonSource[] = [
  {
    name: "NOAA climate and weather guidance",
    url: "https://www.noaa.gov/climate",
  },
  {
    name: "Visit The USA travel planning portal",
    url: "https://www.visittheusa.com/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_GULF: FixedSeasonSource[] = [
  {
    name: "World Bank Climate Knowledge Portal (Middle East)",
    url: "https://climateknowledgeportal.worldbank.org/",
  },
  {
    name: "UNWTO tourism data and seasonality context",
    url: "https://www.unwto.org/tourism-data",
  },
  ...SOURCES_SHARED,
];

const SOURCES_CHILE: FixedSeasonSource[] = [
  {
    name: "Dirección Meteorológica de Chile",
    url: "https://climatologia.meteochile.gob.cl/",
  },
  {
    name: "Chile Travel planning portal",
    url: "https://chile.travel/en/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_ARGENTINA: FixedSeasonSource[] = [
  {
    name: "Servicio Meteorológico Nacional Argentina",
    url: "https://www.smn.gob.ar/",
  },
  {
    name: "Visit Argentina planning portal",
    url: "https://www.argentina.travel/en",
  },
  ...SOURCES_SHARED,
];

const SOURCES_BRAZIL: FixedSeasonSource[] = [
  {
    name: "Instituto Nacional de Meteorologia (INMET)",
    url: "https://portal.inmet.gov.br/",
  },
  {
    name: "Visit Brasil official tourism portal",
    url: "https://www.visitbrasil.com/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_MEXICO: FixedSeasonSource[] = [
  {
    name: "Servicio Meteorológico Nacional (Mexico)",
    url: "https://smn.conagua.gob.mx/",
  },
  {
    name: "Visit Mexico tourism portal",
    url: "https://www.visitmexico.com/en/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_ITALY: FixedSeasonSource[] = [
  {
    name: "Italian Meteorological Service",
    url: "https://www.meteoam.it/en",
  },
  {
    name: "Italia.it official tourism portal",
    url: "https://www.italia.it/en",
  },
  ...SOURCES_SHARED,
];

const SOURCES_FRANCE: FixedSeasonSource[] = [
  {
    name: "Meteo-France climate guidance",
    url: "https://meteofrance.com/",
  },
  {
    name: "France.fr official tourism portal",
    url: "https://www.france.fr/en",
  },
  ...SOURCES_SHARED,
];

const SOURCES_GERMANY: FixedSeasonSource[] = [
  {
    name: "Deutscher Wetterdienst (DWD)",
    url: "https://www.dwd.de/EN/Home/home_node.html",
  },
  {
    name: "Germany Travel official portal",
    url: "https://www.germany.travel/en/home.html",
  },
  ...SOURCES_SHARED,
];

const SOURCES_UK: FixedSeasonSource[] = [
  {
    name: "Met Office UK climate guidance",
    url: "https://www.metoffice.gov.uk/",
  },
  {
    name: "VisitBritain official portal",
    url: "https://www.visitbritain.com/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_PORTUGAL: FixedSeasonSource[] = [
  {
    name: "Instituto Portugues do Mar e da Atmosfera",
    url: "https://www.ipma.pt/en/",
  },
  {
    name: "Visit Portugal official portal",
    url: "https://www.visitportugal.com/en",
  },
  ...SOURCES_SHARED,
];

const SOURCES_GREECE: FixedSeasonSource[] = [
  {
    name: "Hellenic National Meteorological Service",
    url: "https://emy.gr/emy/en",
  },
  {
    name: "Visit Greece official portal",
    url: "https://www.visitgreece.gr/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_TURKEY: FixedSeasonSource[] = [
  {
    name: "Turkish State Meteorological Service",
    url: "https://mgm.gov.tr/eng/",
  },
  {
    name: "Go Turkiye official tourism portal",
    url: "https://goturkiye.com/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_INDIA: FixedSeasonSource[] = [
  {
    name: "India Meteorological Department",
    url: "https://mausam.imd.gov.in/",
  },
  {
    name: "Incredible India official portal",
    url: "https://www.incredibleindia.gov.in/en",
  },
  ...SOURCES_SHARED,
];

const SOURCES_EGYPT: FixedSeasonSource[] = [
  {
    name: "Egyptian Meteorological Authority",
    url: "https://ema.gov.eg/",
  },
  {
    name: "Experience Egypt official tourism portal",
    url: "https://www.experienceegypt.eg/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_SOUTH_AFRICA: FixedSeasonSource[] = [
  {
    name: "South African Weather Service",
    url: "https://www.weathersa.co.za/",
  },
  {
    name: "South African Tourism official portal",
    url: "https://www.southafrica.net/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_KENYA: FixedSeasonSource[] = [
  {
    name: "Kenya Meteorological Department",
    url: "https://www.meteo.go.ke/",
  },
  {
    name: "Magical Kenya tourism portal",
    url: "https://magicalkenya.com/",
  },
  ...SOURCES_SHARED,
];

const SOURCES_PERU: FixedSeasonSource[] = [
  {
    name: "Servicio Nacional de Meteorologia e Hidrologia del Peru",
    url: "https://www.senamhi.gob.pe/",
  },
  {
    name: "Peru Travel official portal",
    url: "https://www.peru.travel/en",
  },
  ...SOURCES_SHARED,
];

const SOURCES_COLOMBIA: FixedSeasonSource[] = [
  {
    name: "IDEAM climate monitoring (Colombia)",
    url: "https://www.ideam.gov.co/",
  },
  {
    name: "Colombia Travel official portal",
    url: "https://colombia.travel/en",
  },
  ...SOURCES_SHARED,
];

const TEMPLATE_VN_NORTH = makeTemplate({
  marketHigh: asMonths([10, 11, 12, 1, 2, 3]),
  marketShoulder: asMonths([4, 5, 9]),
  marketOff: asMonths([6, 7, 8]),
  climateHigh: asMonths([10, 11, 12, 1, 2, 3, 4]),
  climateShoulder: asMonths([5, 9]),
  climateOff: asMonths([6, 7, 8]),
  marketReason: "Fixed city market season profile calibrated from recurring dry-season demand in North Vietnam.",
  climateReason: "Fixed city climate season profile for North Vietnam comfort patterns.",
  sources: SOURCES_VIETNAM,
});

const TEMPLATE_VN_CENTRAL = makeTemplate({
  marketHigh: asMonths([4, 5, 6, 7, 8]),
  marketShoulder: asMonths([1, 2, 3, 9]),
  marketOff: asMonths([10, 11, 12]),
  climateHigh: asMonths([2, 3, 4, 5, 6, 7, 8]),
  climateShoulder: asMonths([1, 9]),
  climateOff: asMonths([10, 11, 12]),
  marketReason:
    "Da Nang market season is fixed from curated city sources: demand peaks in spring/summer event months, and drops in heavy-rain months.",
  climateReason:
    "Da Nang climate season is fixed from curated city sources: dry season is generally February-August, while October-December is the wettest period.",
  sources: SOURCES_DA_NANG,
});

const TEMPLATE_VN_NHA_TRANG = makeTemplate({
  marketHigh: asMonths([1, 2, 3, 4, 5, 6, 7, 8]),
  marketShoulder: asMonths([9]),
  marketOff: asMonths([10, 11, 12]),
  climateHigh: asMonths([1, 2, 3, 4, 5, 6, 7, 8]),
  climateShoulder: asMonths([9]),
  climateOff: asMonths([10, 11, 12]),
  marketReason: "Fixed city market season profile for Nha Trang coastal peak months.",
  climateReason: "Fixed city climate season profile for Nha Trang coastal dry and rainy cycles.",
  sources: SOURCES_VIETNAM,
});

const TEMPLATE_VN_SOUTH = makeTemplate({
  marketHigh: asMonths([12, 1, 2, 3]),
  marketShoulder: asMonths([4, 11]),
  marketOff: asMonths([5, 6, 7, 8, 9, 10]),
  climateHigh: asMonths([12, 1, 2, 3]),
  climateShoulder: asMonths([4, 11]),
  climateOff: asMonths([5, 6, 7, 8, 9, 10]),
  marketReason: "Fixed city market season profile for South Vietnam dry-season demand.",
  climateReason: "Fixed city climate season profile for South Vietnam monsoon split.",
  sources: SOURCES_VIETNAM,
});

const TEMPLATE_TH_MAINLAND = makeTemplate({
  marketHigh: asMonths([11, 12, 1, 2]),
  marketShoulder: asMonths([3, 10]),
  marketOff: asMonths([4, 5, 6, 7, 8, 9]),
  climateHigh: asMonths([11, 12, 1, 2]),
  climateShoulder: asMonths([3, 10]),
  climateOff: asMonths([4, 5, 6, 7, 8, 9]),
  marketReason: "Fixed city market season profile for mainland Thailand, aligned to cool-season demand peaks.",
  climateReason: "Fixed city climate season profile based on Thailand cool/hot/rainy cycle.",
  sources: SOURCES_THAILAND_MAINLAND,
});

const TEMPLATE_TH_ANDAMAN = makeTemplate({
  marketHigh: asMonths([11, 12, 1, 2, 3, 4]),
  marketShoulder: asMonths([5, 10]),
  marketOff: asMonths([6, 7, 8, 9]),
  climateHigh: asMonths([11, 12, 1, 2, 3, 4]),
  climateShoulder: asMonths([5, 10]),
  climateOff: asMonths([6, 7, 8, 9]),
  marketReason: "Fixed city market season profile for Thailand Andaman coast high-demand beach months.",
  climateReason: "Fixed city climate season profile for Andaman coast southwest-monsoon pattern.",
  sources: SOURCES_THAILAND_ANDAMAN,
});

const TEMPLATE_MY_WEST = makeTemplate({
  marketHigh: asMonths([12, 1, 2, 6, 7, 8]),
  marketShoulder: asMonths([3, 4, 5, 9]),
  marketOff: asMonths([10, 11]),
  climateHigh: asMonths([12, 1, 2, 6, 7, 8]),
  climateShoulder: asMonths([3, 4, 5, 9]),
  climateOff: asMonths([10, 11]),
  marketReason: "Fixed city market season profile for Malaysia west coast, where travel demand rises in drier windows.",
  climateReason: "Fixed city climate season profile for west coast inter-monsoon wet peaks (especially Oct-Nov).",
  sources: SOURCES_MALAYSIA,
});

const TEMPLATE_MY_EAST = makeTemplate({
  marketHigh: asMonths([3, 4, 5, 6, 7, 8, 9]),
  marketShoulder: asMonths([2, 10]),
  marketOff: asMonths([11, 12, 1]),
  climateHigh: asMonths([3, 4, 5, 6, 7, 8, 9]),
  climateShoulder: asMonths([2, 10]),
  climateOff: asMonths([11, 12, 1]),
  marketReason: "Fixed city market season profile for Malaysia east coast around Northeast Monsoon closures and recovery.",
  climateReason: "Fixed city climate season profile aligned to the Northeast Monsoon wet phase (late-year to early-year).",
  sources: SOURCES_MALAYSIA,
});

const TEMPLATE_MY_BORNEO = makeTemplate({
  marketHigh: asMonths([2, 3, 4, 6, 7, 8]),
  marketShoulder: asMonths([5, 9, 10]),
  marketOff: asMonths([11, 12, 1]),
  climateHigh: asMonths([2, 3, 4, 6, 7, 8]),
  climateShoulder: asMonths([5, 9, 10]),
  climateOff: asMonths([11, 12, 1]),
  marketReason: "Fixed city market season profile for Malaysian Borneo around relatively drier months.",
  climateReason: "Fixed city climate season profile for Borneo with wetter late-year monsoon concentration.",
  sources: SOURCES_MALAYSIA,
});

const TEMPLATE_ID_JAVA_BALI = makeTemplate({
  marketHigh: asMonths([5, 6, 7, 8, 9]),
  marketShoulder: asMonths([4, 10, 11]),
  marketOff: asMonths([12, 1, 2, 3]),
  climateHigh: asMonths([5, 6, 7, 8, 9]),
  climateShoulder: asMonths([4, 10, 11]),
  climateOff: asMonths([12, 1, 2, 3]),
  marketReason: "Fixed city market season profile for Java/Bali dry-season demand and shoulder transitions.",
  climateReason: "Fixed city climate season profile for Java/Bali dry season (roughly May-Sep) versus wet season.",
  sources: SOURCES_INDONESIA,
});

const TEMPLATE_ID_BALI = makeTemplate({
  marketHigh: asMonths([6, 7, 8, 9]),
  marketShoulder: asMonths([1, 4, 5, 10, 12]),
  marketOff: asMonths([2, 3, 11]),
  climateHigh: asMonths([5, 6, 7, 8, 9]),
  climateShoulder: asMonths([4, 10]),
  climateOff: asMonths([11, 12, 1, 2, 3]),
  marketReason:
    "Fixed Bali market season profile using Bali tourism occupancy/arrival patterns (mid-year peak, November dip).",
  climateReason:
    "Fixed Bali climate season profile using BMKG-linked rainy season timing and Bali dry-season guidance.",
  sources: SOURCES_BALI,
});

const TEMPLATE_ID_MEDAN = makeTemplate({
  marketHigh: asMonths([1, 2, 3, 6, 7, 8]),
  marketShoulder: asMonths([5, 9, 10]),
  marketOff: asMonths([4, 11, 12]),
  climateHigh: asMonths([1, 2, 3, 6, 7, 8]),
  climateShoulder: asMonths([5, 9, 10]),
  climateOff: asMonths([4, 11, 12]),
  marketReason: "Fixed city market season profile for Medan, accounting for shoulder-heavy equatorial demand.",
  climateReason: "Fixed city climate season profile for North Sumatra's bimodal rainfall pattern.",
  sources: SOURCES_INDONESIA,
});

const TEMPLATE_ID_EAST = makeTemplate({
  marketHigh: asMonths([6, 7, 8, 9, 10]),
  marketShoulder: asMonths([4, 5, 11]),
  marketOff: asMonths([12, 1, 2, 3]),
  climateHigh: asMonths([6, 7, 8, 9, 10]),
  climateShoulder: asMonths([4, 5, 11]),
  climateOff: asMonths([12, 1, 2, 3]),
  marketReason: "Fixed city market season profile for eastern Indonesia with stronger mid-year demand.",
  climateReason: "Fixed city climate season profile for eastern Indonesia's drier mid-year window.",
  sources: SOURCES_INDONESIA,
});

const TEMPLATE_PH_MAIN = makeTemplate({
  marketHigh: asMonths([12, 1, 2, 3, 4]),
  marketShoulder: asMonths([5, 11]),
  marketOff: asMonths([6, 7, 8, 9, 10]),
  climateHigh: asMonths([12, 1, 2, 3, 4]),
  climateShoulder: asMonths([5, 11]),
  climateOff: asMonths([6, 7, 8, 9, 10]),
  marketReason: "Fixed city market season profile aligned with Philippines dry-season tourism.",
  climateReason: "Fixed city climate season profile based on PAGASA rainy/dry season split.",
  sources: SOURCES_PHILIPPINES,
});

const TEMPLATE_PH_CEBU_DAVAO = makeTemplate({
  marketHigh: asMonths([12, 1, 2, 3, 4, 5]),
  marketShoulder: asMonths([6, 11]),
  marketOff: asMonths([7, 8, 9, 10]),
  climateHigh: asMonths([12, 1, 2, 3, 4, 5]),
  climateShoulder: asMonths([6, 11]),
  climateOff: asMonths([7, 8, 9, 10]),
  marketReason: "Fixed city market season profile for central/southern Philippines travel rhythm.",
  climateReason: "Fixed city climate season profile for cities with less extreme but still monsoon-driven rainfall.",
  sources: SOURCES_PHILIPPINES,
});

const TEMPLATE_SINGAPORE = makeTemplate({
  marketHigh: asMonths([2, 3, 6, 7, 8, 9, 12]),
  marketShoulder: asMonths([1, 4, 5, 10]),
  marketOff: asMonths([11]),
  climateHigh: asMonths([2, 3, 6, 7, 8, 9]),
  climateShoulder: asMonths([1, 4, 5, 10]),
  climateOff: asMonths([11, 12]),
  marketReason: "Fixed city market season profile for Singapore demand peaks and holidays.",
  climateReason: "Fixed city climate season profile from monsoon-phase guidance.",
  sources: SOURCES_SINGAPORE,
});

const TEMPLATE_KH_INLAND = makeTemplate({
  marketHigh: asMonths([11, 12, 1, 2]),
  marketShoulder: asMonths([3, 4, 10]),
  marketOff: asMonths([5, 6, 7, 8, 9]),
  climateHigh: asMonths([11, 12, 1, 2]),
  climateShoulder: asMonths([3, 4, 10]),
  climateOff: asMonths([5, 6, 7, 8, 9]),
  marketReason: "Fixed city market season profile for Cambodia inland high-demand dry season.",
  climateReason: "Fixed city climate season profile from Cambodia wet/dry monsoon pattern.",
  sources: SOURCES_CAMBODIA,
});

const TEMPLATE_KH_COAST = makeTemplate({
  marketHigh: asMonths([12, 1, 2, 3, 4]),
  marketShoulder: asMonths([5, 11]),
  marketOff: asMonths([6, 7, 8, 9, 10]),
  climateHigh: asMonths([12, 1, 2, 3, 4]),
  climateShoulder: asMonths([5, 11]),
  climateOff: asMonths([6, 7, 8, 9, 10]),
  marketReason: "Fixed city market season profile for Cambodia coast beach demand.",
  climateReason: "Fixed city climate season profile for Cambodia coast wet-season concentration.",
  sources: SOURCES_CAMBODIA,
});

const TEMPLATE_LAOS = makeTemplate({
  marketHigh: asMonths([11, 12, 1, 2]),
  marketShoulder: asMonths([3, 4, 10]),
  marketOff: asMonths([5, 6, 7, 8, 9]),
  climateHigh: asMonths([11, 12, 1, 2]),
  climateShoulder: asMonths([3, 4, 10]),
  climateOff: asMonths([5, 6, 7, 8, 9]),
  marketReason: "Fixed city market season profile for Laos dry-season tourism.",
  climateReason: "Fixed city climate season profile for Laos monsoon cycle.",
  sources: SOURCES_LAOS,
});

const TEMPLATE_MM_YANGON = makeTemplate({
  marketHigh: asMonths([11, 12, 1, 2]),
  marketShoulder: asMonths([3, 10]),
  marketOff: asMonths([4, 5, 6, 7, 8, 9]),
  climateHigh: asMonths([11, 12, 1, 2]),
  climateShoulder: asMonths([3, 10]),
  climateOff: asMonths([4, 5, 6, 7, 8, 9]),
  marketReason: "Fixed city market season profile for Myanmar lower/coastal demand season.",
  climateReason: "Fixed city climate season profile for Myanmar monsoon concentration.",
  sources: SOURCES_MYANMAR,
});

const TEMPLATE_MM_DRY = makeTemplate({
  marketHigh: asMonths([11, 12, 1, 2]),
  marketShoulder: asMonths([3, 10]),
  marketOff: asMonths([4, 5, 6, 7, 8, 9]),
  climateHigh: asMonths([11, 12, 1, 2]),
  climateShoulder: asMonths([3, 10]),
  climateOff: asMonths([4, 5, 6, 7, 8, 9]),
  marketReason: "Fixed city market season profile for Myanmar dry-zone travel demand.",
  climateReason: "Fixed city climate season profile for Myanmar dry-zone heat/rain pattern.",
  sources: SOURCES_MYANMAR,
});

const TEMPLATE_TIMOR = makeTemplate({
  marketHigh: asMonths([6, 7, 8, 9, 10]),
  marketShoulder: asMonths([5, 11]),
  marketOff: asMonths([12, 1, 2, 3, 4]),
  climateHigh: asMonths([6, 7, 8, 9, 10]),
  climateShoulder: asMonths([5, 11]),
  climateOff: asMonths([12, 1, 2, 3, 4]),
  marketReason: "Fixed city market season profile for Timor-Leste dry-season travel windows.",
  climateReason: "Fixed city climate season profile for Timor-Leste wet/dry season split.",
  sources: SOURCES_TIMOR,
});

const TEMPLATE_BRUNEI = makeTemplate({
  marketHigh: asMonths([2, 3, 4, 7, 8, 9]),
  marketShoulder: asMonths([5, 6, 10]),
  marketOff: asMonths([11, 12, 1]),
  climateHigh: asMonths([2, 3, 4, 7, 8, 9]),
  climateShoulder: asMonths([5, 6, 10]),
  climateOff: asMonths([11, 12, 1]),
  marketReason: "Fixed city market season profile for Brunei demand around relatively drier windows.",
  climateReason: "Fixed city climate season profile for Brunei around Northeast Monsoon wet months.",
  sources: SOURCES_BRUNEI,
});

const TEMPLATE_LK_WEST_SOUTH = makeTemplate({
  marketHigh: asMonths([12, 1, 2, 3, 4]),
  marketShoulder: asMonths([5, 11]),
  marketOff: asMonths([6, 7, 8, 9, 10]),
  climateHigh: asMonths([12, 1, 2, 3, 4]),
  climateShoulder: asMonths([5, 11]),
  climateOff: asMonths([6, 7, 8, 9, 10]),
  marketReason:
    "Fixed city market season profile for Sri Lanka west/south coast, where demand generally peaks in the drier Dec-Apr window.",
  climateReason:
    "Fixed city climate season profile for Sri Lanka west/south coast with wetter Southwest Monsoon months in roughly May-Sep.",
  sources: SOURCES_SRI_LANKA,
});

const TEMPLATE_LK_EAST = makeTemplate({
  marketHigh: asMonths([5, 6, 7, 8, 9]),
  marketShoulder: asMonths([4, 10]),
  marketOff: asMonths([11, 12, 1, 2, 3]),
  climateHigh: asMonths([5, 6, 7, 8, 9]),
  climateShoulder: asMonths([4, 10]),
  climateOff: asMonths([11, 12, 1, 2, 3]),
  marketReason:
    "Fixed city market season profile for Sri Lanka east coast, where demand rises during the drier mid-year period.",
  climateReason:
    "Fixed city climate season profile for Sri Lanka east coast, usually drier during Southwest Monsoon months and wetter with Northeast Monsoon influence.",
  sources: SOURCES_SRI_LANKA,
});

const TEMPLATE_LK_HIGHLANDS = makeTemplate({
  marketHigh: asMonths([12, 1, 2, 3, 4, 7, 8]),
  marketShoulder: asMonths([5, 6, 9]),
  marketOff: asMonths([10, 11]),
  climateHigh: asMonths([12, 1, 2, 3, 4]),
  climateShoulder: asMonths([5, 6, 7, 8, 9]),
  climateOff: asMonths([10, 11]),
  marketReason:
    "Fixed city market season profile for Sri Lanka highlands with strongest demand in the drier winter/spring window and major mid-year travel peaks.",
  climateReason:
    "Fixed city climate season profile for Sri Lanka highlands with relative comfort concentrated in the drier early-year period.",
  sources: SOURCES_SRI_LANKA,
});

const TEMPLATE_LK_NORTH = makeTemplate({
  marketHigh: asMonths([2, 3, 4, 5, 6, 7, 8]),
  marketShoulder: asMonths([1, 9, 10]),
  marketOff: asMonths([11, 12]),
  climateHigh: asMonths([2, 3, 4, 5, 6, 7, 8, 9]),
  climateShoulder: asMonths([1, 10]),
  climateOff: asMonths([11, 12]),
  marketReason:
    "Fixed city market season profile for northern Sri Lanka, where demand usually improves after the Northeast Monsoon peak.",
  climateReason:
    "Fixed city climate season profile for northern Sri Lanka with wetter conditions most concentrated in late-year Northeast Monsoon months.",
  sources: SOURCES_SRI_LANKA,
});

const TEMPLATE_JP_MAIN = makeTemplate({
  marketHigh: asMonths([3, 4, 5, 10, 11]),
  marketShoulder: asMonths([2, 6, 9, 12]),
  marketOff: asMonths([1, 7, 8]),
  climateHigh: asMonths([4, 5, 10, 11]),
  climateShoulder: asMonths([3, 6, 9, 12]),
  climateOff: asMonths([1, 2, 7, 8]),
  marketReason: "Fixed city market season profile for mainland Japan around spring blossom and autumn foliage peaks.",
  climateReason: "Fixed city climate season profile for temperate Japan comfort windows in spring and autumn.",
  sources: SOURCES_JAPAN,
});

const TEMPLATE_JP_HOKKAIDO = makeTemplate({
  marketHigh: asMonths([2, 7, 8]),
  marketShoulder: asMonths([1, 3, 6, 9, 10]),
  marketOff: asMonths([4, 5, 11, 12]),
  climateHigh: asMonths([6, 7, 8, 9]),
  climateShoulder: asMonths([5, 10]),
  climateOff: asMonths([11, 12, 1, 2, 3, 4]),
  marketReason: "Fixed city market season profile for Hokkaido with winter-sports and mid-summer demand peaks.",
  climateReason: "Fixed city climate season profile for Hokkaido where warm-season comfort is concentrated in summer.",
  sources: SOURCES_JAPAN,
});

const TEMPLATE_JP_OKINAWA = makeTemplate({
  marketHigh: asMonths([4, 5, 6, 7, 8]),
  marketShoulder: asMonths([3, 9, 10, 11]),
  marketOff: asMonths([12, 1, 2]),
  climateHigh: asMonths([4, 5, 10, 11]),
  climateShoulder: asMonths([3, 6, 9, 12]),
  climateOff: asMonths([1, 2, 7, 8]),
  marketReason: "Fixed city market season profile for Okinawa's beach-demand months.",
  climateReason: "Fixed city climate season profile for Okinawa balancing typhoon-prone summer and milder shoulder periods.",
  sources: SOURCES_JAPAN,
});

const TEMPLATE_AT_MAIN = makeTemplate({
  marketHigh: asMonths([12, 1, 2, 6, 7, 8]),
  marketShoulder: asMonths([3, 4, 5, 9, 10]),
  marketOff: asMonths([11]),
  climateHigh: asMonths([5, 6, 7, 8, 9]),
  climateShoulder: asMonths([4, 10]),
  climateOff: asMonths([11, 12, 1, 2, 3]),
  marketReason: "Fixed city market season profile for Austria's combined winter and summer tourism peaks.",
  climateReason: "Fixed city climate season profile for lower-elevation Austria comfort in late spring to early autumn.",
  sources: SOURCES_AUSTRIA,
});

const TEMPLATE_AT_ALPINE = makeTemplate({
  marketHigh: asMonths([12, 1, 2, 3, 6, 7, 8]),
  marketShoulder: asMonths([4, 5, 9, 10]),
  marketOff: asMonths([11]),
  climateHigh: asMonths([6, 7, 8, 9]),
  climateShoulder: asMonths([5, 10]),
  climateOff: asMonths([11, 12, 1, 2, 3, 4]),
  marketReason: "Fixed city market season profile for Austria alpine areas with ski and summer-hiking demand cycles.",
  climateReason: "Fixed city climate season profile for alpine Austria where comfort concentrates in summer months.",
  sources: SOURCES_AUSTRIA,
});

const TEMPLATE_ES_MED = makeTemplate({
  marketHigh: asMonths([6, 7, 8, 9]),
  marketShoulder: asMonths([4, 5, 10]),
  marketOff: asMonths([11, 12, 1, 2, 3]),
  climateHigh: asMonths([5, 6, 9, 10]),
  climateShoulder: asMonths([4, 7, 8, 11]),
  climateOff: asMonths([12, 1, 2, 3]),
  marketReason: "Fixed city market season profile for Spain Mediterranean destinations with strongest summer demand.",
  climateReason: "Fixed city climate season profile for Mediterranean Spain with shoulder-month comfort often higher than peak summer heat.",
  sources: SOURCES_SPAIN,
});

const TEMPLATE_ES_INLAND = makeTemplate({
  marketHigh: asMonths([4, 5, 10]),
  marketShoulder: asMonths([3, 6, 9, 11]),
  marketOff: asMonths([12, 1, 2, 7, 8]),
  climateHigh: asMonths([4, 5, 10]),
  climateShoulder: asMonths([3, 6, 9, 11]),
  climateOff: asMonths([12, 1, 2, 7, 8]),
  marketReason: "Fixed city market season profile for inland Spain city travel concentrated in milder months.",
  climateReason: "Fixed city climate season profile for inland Spain with summer heat and winter cold reducing comfort.",
  sources: SOURCES_SPAIN,
});

const TEMPLATE_ES_NORTH = makeTemplate({
  marketHigh: asMonths([6, 7, 8, 9]),
  marketShoulder: asMonths([4, 5, 10]),
  marketOff: asMonths([11, 12, 1, 2, 3]),
  climateHigh: asMonths([6, 7, 8, 9]),
  climateShoulder: asMonths([5, 10]),
  climateOff: asMonths([11, 12, 1, 2, 3, 4]),
  marketReason: "Fixed city market season profile for northern Spain summer-demand concentration.",
  climateReason: "Fixed city climate season profile for northern Spain with best comfort generally in warmer months.",
  sources: SOURCES_SPAIN,
});

const TEMPLATE_MA_COAST = makeTemplate({
  marketHigh: asMonths([3, 4, 5, 9, 10, 11]),
  marketShoulder: asMonths([2, 6, 12]),
  marketOff: asMonths([1, 7, 8]),
  climateHigh: asMonths([3, 4, 5, 10, 11]),
  climateShoulder: asMonths([2, 6, 9, 12]),
  climateOff: asMonths([1, 7, 8]),
  marketReason: "Fixed city market season profile for Morocco coastal cities favoring milder spring and autumn periods.",
  climateReason: "Fixed city climate season profile for Morocco coast where peak summer heat is less comfortable.",
  sources: SOURCES_MOROCCO,
});

const TEMPLATE_MA_INLAND = makeTemplate({
  marketHigh: asMonths([3, 4, 5, 10, 11]),
  marketShoulder: asMonths([2, 6, 9, 12]),
  marketOff: asMonths([1, 7, 8]),
  climateHigh: asMonths([3, 4, 5, 10, 11]),
  climateShoulder: asMonths([2, 6, 9, 12]),
  climateOff: asMonths([1, 7, 8]),
  marketReason: "Fixed city market season profile for inland Morocco with strongest demand in spring/autumn.",
  climateReason: "Fixed city climate season profile for inland Morocco avoiding hottest summer and coolest winter windows.",
  sources: SOURCES_MOROCCO,
});

const TEMPLATE_KR_MAIN = makeTemplate({
  marketHigh: asMonths([4, 5, 10, 11]),
  marketShoulder: asMonths([3, 6, 9, 12]),
  marketOff: asMonths([1, 2, 7, 8]),
  climateHigh: asMonths([4, 5, 10]),
  climateShoulder: asMonths([3, 6, 9, 11]),
  climateOff: asMonths([12, 1, 2, 7, 8]),
  marketReason: "Fixed city market season profile for South Korea mainland spring and autumn demand peaks.",
  climateReason: "Fixed city climate season profile for South Korea with summer monsoon and winter cold constraints.",
  sources: SOURCES_SOUTH_KOREA,
});

const TEMPLATE_KR_BUSAN = makeTemplate({
  marketHigh: asMonths([4, 5, 6, 10, 11]),
  marketShoulder: asMonths([3, 9, 12]),
  marketOff: asMonths([1, 2, 7, 8]),
  climateHigh: asMonths([4, 5, 10, 11]),
  climateShoulder: asMonths([3, 6, 9, 12]),
  climateOff: asMonths([1, 2, 7, 8]),
  marketReason: "Fixed city market season profile for South Korea southeast coast with spring/autumn preference and summer vacation demand.",
  climateReason: "Fixed city climate season profile for Busan with monsoon summer constraints.",
  sources: SOURCES_SOUTH_KOREA,
});

const TEMPLATE_KR_JEJU = makeTemplate({
  marketHigh: asMonths([4, 5, 6, 10]),
  marketShoulder: asMonths([3, 9, 11]),
  marketOff: asMonths([12, 1, 2, 7, 8]),
  climateHigh: asMonths([4, 5, 10]),
  climateShoulder: asMonths([3, 6, 9, 11]),
  climateOff: asMonths([12, 1, 2, 7, 8]),
  marketReason: "Fixed city market season profile for Jeju with strongest demand in shoulder-to-early-summer periods.",
  climateReason: "Fixed city climate season profile for Jeju with typhoon-season risk during peak summer.",
  sources: SOURCES_SOUTH_KOREA,
});

const TEMPLATE_CN_NORTH = makeTemplate({
  marketHigh: asMonths([4, 5, 9, 10]),
  marketShoulder: asMonths([3, 6, 8, 11]),
  marketOff: asMonths([12, 1, 2, 7]),
  climateHigh: asMonths([4, 5, 9, 10]),
  climateShoulder: asMonths([3, 6, 8, 11]),
  climateOff: asMonths([12, 1, 2, 7]),
  marketReason: "Fixed city market season profile for northern China city travel concentrated in spring and autumn.",
  climateReason: "Fixed city climate season profile for northern China with hot summers and cold winters reducing comfort.",
  sources: SOURCES_CHINA,
});

const TEMPLATE_CN_EAST = makeTemplate({
  marketHigh: asMonths([3, 4, 5, 10, 11]),
  marketShoulder: asMonths([2, 6, 9, 12]),
  marketOff: asMonths([1, 7, 8]),
  climateHigh: asMonths([4, 5, 10, 11]),
  climateShoulder: asMonths([3, 6, 9, 12]),
  climateOff: asMonths([1, 2, 7, 8]),
  marketReason: "Fixed city market season profile for eastern China major metros with spring/autumn demand concentration.",
  climateReason: "Fixed city climate season profile for humid subtropical east China with summer heat/rain limits.",
  sources: SOURCES_CHINA,
});

const TEMPLATE_CN_SOUTH = makeTemplate({
  marketHigh: asMonths([10, 11, 12, 1, 3, 4]),
  marketShoulder: asMonths([2, 5, 9]),
  marketOff: asMonths([6, 7, 8]),
  climateHigh: asMonths([10, 11, 12, 1, 2, 3, 4]),
  climateShoulder: asMonths([5, 9]),
  climateOff: asMonths([6, 7, 8]),
  marketReason: "Fixed city market season profile for South China demand strongest outside hot/wet monsoon summer.",
  climateReason: "Fixed city climate season profile for South China with summer humidity and rain reducing comfort.",
  sources: SOURCES_CHINA,
});

const TEMPLATE_CN_SOUTHWEST = makeTemplate({
  marketHigh: asMonths([3, 4, 5, 9, 10]),
  marketShoulder: asMonths([2, 6, 11]),
  marketOff: asMonths([12, 1, 7, 8]),
  climateHigh: asMonths([3, 4, 5, 9, 10, 11]),
  climateShoulder: asMonths([2, 6]),
  climateOff: asMonths([12, 1, 7, 8]),
  marketReason: "Fixed city market season profile for southwest China shoulder-heavy travel rhythm.",
  climateReason: "Fixed city climate season profile for southwest China plateau/basin conditions with wettest midsummer months.",
  sources: SOURCES_CHINA,
});

const TEMPLATE_CN_TROPICAL = makeTemplate({
  marketHigh: asMonths([11, 12, 1, 2, 3, 4]),
  marketShoulder: asMonths([5, 10]),
  marketOff: asMonths([6, 7, 8, 9]),
  climateHigh: asMonths([11, 12, 1, 2, 3, 4]),
  climateShoulder: asMonths([5, 10]),
  climateOff: asMonths([6, 7, 8, 9]),
  marketReason: "Fixed city market season profile for tropical Hainan with strongest demand in drier winter-spring months.",
  climateReason: "Fixed city climate season profile for tropical Hainan with wetter summer/typhoon season constraints.",
  sources: SOURCES_CHINA,
});

const TEMPLATE_TW_MAIN = makeTemplate({
  marketHigh: asMonths([10, 11, 12, 1, 2, 3, 4]),
  marketShoulder: asMonths([5, 9]),
  marketOff: asMonths([6, 7, 8]),
  climateHigh: asMonths([10, 11, 12, 1, 2, 3, 4]),
  climateShoulder: asMonths([5, 9]),
  climateOff: asMonths([6, 7, 8]),
  marketReason: "Fixed city market season profile for Taiwan with strongest demand outside typhoon-prone midsummer months.",
  climateReason: "Fixed city climate season profile for Taiwan where cooler dry-season months are generally most comfortable.",
  sources: SOURCES_TAIWAN,
});

const TEMPLATE_TW_SOUTH = makeTemplate({
  marketHigh: asMonths([11, 12, 1, 2, 3, 4]),
  marketShoulder: asMonths([5, 10]),
  marketOff: asMonths([6, 7, 8, 9]),
  climateHigh: asMonths([11, 12, 1, 2, 3, 4]),
  climateShoulder: asMonths([5, 10]),
  climateOff: asMonths([6, 7, 8, 9]),
  marketReason: "Fixed city market season profile for southern Taiwan with demand concentration in cooler months.",
  climateReason: "Fixed city climate season profile for southern Taiwan with hottest/wettest months in summer.",
  sources: SOURCES_TAIWAN,
});

const TEMPLATE_AU_SOUTHEAST = makeTemplate({
  marketHigh: asMonths([12, 1, 2, 3]),
  marketShoulder: asMonths([4, 5, 10, 11]),
  marketOff: asMonths([6, 7, 8, 9]),
  climateHigh: asMonths([11, 12, 1, 2, 3]),
  climateShoulder: asMonths([4, 10]),
  climateOff: asMonths([5, 6, 7, 8, 9]),
  marketReason: "Fixed city market season profile for southeast Australia summer-holiday demand.",
  climateReason: "Fixed city climate season profile for southeast Australia with best outdoor comfort in late spring through early autumn.",
  sources: SOURCES_AUSTRALIA,
});

const TEMPLATE_AU_WEST = makeTemplate({
  marketHigh: asMonths([11, 12, 1, 2, 3]),
  marketShoulder: asMonths([4, 5, 10]),
  marketOff: asMonths([6, 7, 8, 9]),
  climateHigh: asMonths([3, 4, 5, 10, 11]),
  climateShoulder: asMonths([2, 6, 9, 12]),
  climateOff: asMonths([1, 7, 8]),
  marketReason: "Fixed city market season profile for southwest Australia with summer and shoulder demand peaks.",
  climateReason: "Fixed city climate season profile for Perth region where shoulder months are often more comfortable than peak summer heat.",
  sources: SOURCES_AUSTRALIA,
});

const TEMPLATE_AU_TROPICAL = makeTemplate({
  marketHigh: asMonths([5, 6, 7, 8, 9]),
  marketShoulder: asMonths([4, 10]),
  marketOff: asMonths([11, 12, 1, 2, 3]),
  climateHigh: asMonths([5, 6, 7, 8, 9]),
  climateShoulder: asMonths([4, 10]),
  climateOff: asMonths([11, 12, 1, 2, 3]),
  marketReason: "Fixed city market season profile for tropical Australia where dry-season months draw strongest demand.",
  climateReason: "Fixed city climate season profile for tropical Australia with wet-season heat/humidity reducing comfort.",
  sources: SOURCES_AUSTRALIA,
});

const TEMPLATE_NZ_MAIN = makeTemplate({
  marketHigh: asMonths([12, 1, 2, 3]),
  marketShoulder: asMonths([4, 5, 10, 11]),
  marketOff: asMonths([6, 7, 8, 9]),
  climateHigh: asMonths([12, 1, 2, 3]),
  climateShoulder: asMonths([4, 5, 10, 11]),
  climateOff: asMonths([6, 7, 8, 9]),
  marketReason: "Fixed city market season profile for New Zealand summer-demand concentration.",
  climateReason: "Fixed city climate season profile for New Zealand with best comfort in late spring to early autumn.",
  sources: SOURCES_NEW_ZEALAND,
});

const TEMPLATE_NZ_QUEENSTOWN = makeTemplate({
  marketHigh: asMonths([12, 1, 2, 7, 8]),
  marketShoulder: asMonths([3, 4, 5, 6, 9, 10]),
  marketOff: asMonths([11]),
  climateHigh: asMonths([12, 1, 2, 3]),
  climateShoulder: asMonths([4, 5, 10, 11]),
  climateOff: asMonths([6, 7, 8, 9]),
  marketReason: "Fixed city market season profile for Queenstown with both summer and ski-season demand peaks.",
  climateReason: "Fixed city climate season profile for Queenstown where warm-season comfort is strongest in summer.",
  sources: SOURCES_NEW_ZEALAND,
});

const TEMPLATE_IS_REYKJAVIK = makeTemplate({
  marketHigh: asMonths([6, 7, 8]),
  marketShoulder: asMonths([5, 9, 10]),
  marketOff: asMonths([11, 12, 1, 2, 3, 4]),
  climateHigh: asMonths([6, 7, 8]),
  climateShoulder: asMonths([5, 9]),
  climateOff: asMonths([10, 11, 12, 1, 2, 3, 4]),
  marketReason: "Fixed city market season profile for Reykjavik with strongest demand in long-day summer months.",
  climateReason: "Fixed city climate season profile for Reykjavik where comfort is concentrated in short mild summer windows.",
  sources: SOURCES_NORDICS,
});

const TEMPLATE_NO_TROMSO = makeTemplate({
  marketHigh: asMonths([6, 7, 8, 12, 1, 2]),
  marketShoulder: asMonths([3, 4, 5, 9, 10]),
  marketOff: asMonths([11]),
  climateHigh: asMonths([6, 7, 8]),
  climateShoulder: asMonths([5, 9]),
  climateOff: asMonths([10, 11, 12, 1, 2, 3, 4]),
  marketReason:
    "Fixed city market season profile for Tromso with dual demand peaks: midnight sun in summer and aurora season in winter.",
  climateReason:
    "Fixed city climate season profile for Tromso with short cool summers and long cold-season limitations.",
  sources: SOURCES_NORDICS,
});

const TEMPLATE_FI_HELSINKI = makeTemplate({
  marketHigh: asMonths([6, 7, 8, 12]),
  marketShoulder: asMonths([5, 9, 10, 1]),
  marketOff: asMonths([2, 3, 4, 11]),
  climateHigh: asMonths([6, 7, 8]),
  climateShoulder: asMonths([5, 9]),
  climateOff: asMonths([10, 11, 12, 1, 2, 3, 4]),
  marketReason:
    "Fixed city market season profile for Helsinki with summer city-travel demand and a smaller winter holiday bump.",
  climateReason: "Fixed city climate season profile for Helsinki with best comfort in the warm-season period.",
  sources: SOURCES_NORDICS,
});

const TEMPLATE_CA_COAST = makeTemplate({
  marketHigh: asMonths([6, 7, 8, 9]),
  marketShoulder: asMonths([5, 10]),
  marketOff: asMonths([11, 12, 1, 2, 3, 4]),
  climateHigh: asMonths([6, 7, 8, 9]),
  climateShoulder: asMonths([5, 10]),
  climateOff: asMonths([11, 12, 1, 2, 3, 4]),
  marketReason: "Fixed city market season profile for Vancouver with strongest demand in dry and mild summer months.",
  climateReason: "Fixed city climate season profile for Pacific Canada with highest comfort in late spring through early autumn.",
  sources: SOURCES_CANADA,
});

const TEMPLATE_CA_INTERIOR = makeTemplate({
  marketHigh: asMonths([6, 7, 8, 9]),
  marketShoulder: asMonths([5, 10]),
  marketOff: asMonths([11, 12, 1, 2, 3, 4]),
  climateHigh: asMonths([6, 7, 8]),
  climateShoulder: asMonths([5, 9, 10]),
  climateOff: asMonths([11, 12, 1, 2, 3, 4]),
  marketReason: "Fixed city market season profile for Calgary with strongest demand in warm and shoulder months.",
  climateReason: "Fixed city climate season profile for inland Canada with strong winter cold and short comfortable summer.",
  sources: SOURCES_CANADA,
});

const TEMPLATE_US_ALASKA = makeTemplate({
  marketHigh: asMonths([6, 7, 8]),
  marketShoulder: asMonths([5, 9]),
  marketOff: asMonths([10, 11, 12, 1, 2, 3, 4]),
  climateHigh: asMonths([6, 7, 8]),
  climateShoulder: asMonths([5, 9]),
  climateOff: asMonths([10, 11, 12, 1, 2, 3, 4]),
  marketReason: "Fixed city market season profile for Anchorage with strong summer demand and low winter demand.",
  climateReason: "Fixed city climate season profile for Alaska with comfort heavily concentrated in short summer months.",
  sources: SOURCES_USA,
});

const TEMPLATE_GULF_COAST = makeTemplate({
  marketHigh: asMonths([11, 12, 1, 2, 3]),
  marketShoulder: asMonths([4, 10]),
  marketOff: asMonths([5, 6, 7, 8, 9]),
  climateHigh: asMonths([11, 12, 1, 2, 3]),
  climateShoulder: asMonths([4, 10]),
  climateOff: asMonths([5, 6, 7, 8, 9]),
  marketReason: "Fixed city market season profile for Gulf coast cities with demand concentrated in cooler months.",
  climateReason: "Fixed city climate season profile for Gulf desert climates where summer heat severely reduces comfort.",
  sources: SOURCES_GULF,
});

const TEMPLATE_GULF_INLAND = makeTemplate({
  marketHigh: asMonths([11, 12, 1, 2]),
  marketShoulder: asMonths([3, 4, 10]),
  marketOff: asMonths([5, 6, 7, 8, 9]),
  climateHigh: asMonths([11, 12, 1, 2, 3]),
  climateShoulder: asMonths([4, 10]),
  climateOff: asMonths([5, 6, 7, 8, 9]),
  marketReason: "Fixed city market season profile for inland Gulf cities with strongest demand in winter months.",
  climateReason: "Fixed city climate season profile for inland desert heat with broad summer off-season comfort.",
  sources: SOURCES_GULF,
});

const TEMPLATE_CL_CENTRAL = makeTemplate({
  marketHigh: asMonths([11, 12, 1, 2, 3]),
  marketShoulder: asMonths([4, 10]),
  marketOff: asMonths([5, 6, 7, 8, 9]),
  climateHigh: asMonths([10, 11, 12, 1, 2, 3]),
  climateShoulder: asMonths([4, 9]),
  climateOff: asMonths([5, 6, 7, 8]),
  marketReason: "Fixed city market season profile for central Chile with peak travel in southern-hemisphere summer.",
  climateReason: "Fixed city climate season profile for Santiago's Mediterranean pattern with cool winters.",
  sources: SOURCES_CHILE,
});

const TEMPLATE_CL_PATAGONIA = makeTemplate({
  marketHigh: asMonths([12, 1, 2, 3]),
  marketShoulder: asMonths([11, 4, 10]),
  marketOff: asMonths([5, 6, 7, 8, 9]),
  climateHigh: asMonths([12, 1, 2, 3]),
  climateShoulder: asMonths([11, 4]),
  climateOff: asMonths([5, 6, 7, 8, 9, 10]),
  marketReason: "Fixed city market season profile for Patagonia with strong summer seasonality and wind-constrained winters.",
  climateReason: "Fixed city climate season profile for southern Patagonia with comfort largely restricted to summer.",
  sources: SOURCES_CHILE,
});

const TEMPLATE_AR_BUENOS_AIRES = makeTemplate({
  marketHigh: asMonths([11, 12, 1, 2, 3, 10]),
  marketShoulder: asMonths([4, 9]),
  marketOff: asMonths([5, 6, 7, 8]),
  climateHigh: asMonths([10, 11, 12, 1, 2, 3, 4]),
  climateShoulder: asMonths([5, 9]),
  climateOff: asMonths([6, 7, 8]),
  marketReason: "Fixed city market season profile for Buenos Aires with strongest demand in spring and summer.",
  climateReason: "Fixed city climate season profile for Buenos Aires where winter months are cooler and less favorable.",
  sources: SOURCES_ARGENTINA,
});

const TEMPLATE_AU_DESERT = makeTemplate({
  marketHigh: asMonths([4, 5, 6, 7, 8, 9]),
  marketShoulder: asMonths([3, 10]),
  marketOff: asMonths([11, 12, 1, 2]),
  climateHigh: asMonths([4, 5, 6, 7, 8, 9]),
  climateShoulder: asMonths([3, 10]),
  climateOff: asMonths([11, 12, 1, 2]),
  marketReason: "Fixed city market season profile for Australia's inland desert with peak demand in cooler months.",
  climateReason: "Fixed city climate season profile for central Australia where summer heat strongly limits comfort.",
  sources: SOURCES_AUSTRALIA,
});

const TEMPLATE_ES_CANARY = makeTemplate({
  marketHigh: asMonths([11, 12, 1, 2, 3, 4, 5]),
  marketShoulder: asMonths([6, 10]),
  marketOff: asMonths([7, 8, 9]),
  climateHigh: asMonths([10, 11, 12, 1, 2, 3, 4, 5]),
  climateShoulder: asMonths([6, 9]),
  climateOff: asMonths([7, 8]),
  marketReason: "Fixed city market season profile for Canary Islands with strong winter-sun demand.",
  climateReason: "Fixed city climate season profile for Canaries with mild year-round conditions and best shoulder comfort.",
  sources: SOURCES_SPAIN,
});

const TEMPLATE_CN_URUMQI = makeTemplate({
  marketHigh: asMonths([5, 6, 9, 10]),
  marketShoulder: asMonths([4, 7, 8, 11]),
  marketOff: asMonths([12, 1, 2, 3]),
  climateHigh: asMonths([5, 6, 9, 10]),
  climateShoulder: asMonths([4, 7, 8, 11]),
  climateOff: asMonths([12, 1, 2, 3]),
  marketReason: "Fixed city market season profile for far-west China with shoulder-season demand peaks.",
  climateReason: "Fixed city climate season profile for Urumqi's continental dry climate with cold winters and hot summers.",
  sources: SOURCES_CHINA,
});

const TEMPLATE_CN_LHASA = makeTemplate({
  marketHigh: asMonths([5, 6, 9, 10]),
  marketShoulder: asMonths([4, 7, 8, 11]),
  marketOff: asMonths([12, 1, 2, 3]),
  climateHigh: asMonths([5, 6, 9, 10]),
  climateShoulder: asMonths([4, 7, 8, 11]),
  climateOff: asMonths([12, 1, 2, 3]),
  marketReason: "Fixed city market season profile for Tibetan highland travel with strongest demand in milder months.",
  climateReason: "Fixed city climate season profile for Lhasa's high-altitude climate with cold winters and monsoon summer risks.",
  sources: SOURCES_CHINA,
});

const TEMPLATE_BR_MAIN = makeTemplate({
  marketHigh: asMonths([12, 1, 2, 7]),
  marketShoulder: asMonths([3, 4, 5, 6, 8, 11]),
  marketOff: asMonths([9, 10]),
  climateHigh: asMonths([5, 6, 7, 8]),
  climateShoulder: asMonths([4, 9, 10, 11]),
  climateOff: asMonths([12, 1, 2, 3]),
  marketReason: "Fixed country market season profile for Brazil balancing summer holiday demand and mid-year regional peaks.",
  climateReason: "Fixed country climate season profile for Brazil across tropical and southern temperate zones.",
  sources: SOURCES_BRAZIL,
});

const TEMPLATE_MX_MAIN = makeTemplate({
  marketHigh: asMonths([11, 12, 1, 2, 3, 4]),
  marketShoulder: asMonths([5, 10]),
  marketOff: asMonths([6, 7, 8, 9]),
  climateHigh: asMonths([11, 12, 1, 2, 3, 4]),
  climateShoulder: asMonths([5, 10]),
  climateOff: asMonths([6, 7, 8, 9]),
  marketReason: "Fixed country market season profile for Mexico with highest demand during cooler dry-season months.",
  climateReason: "Fixed country climate season profile for Mexico with rainy-season constraints in mid-year.",
  sources: SOURCES_MEXICO,
});

const TEMPLATE_IT_MAIN = makeTemplate({
  marketHigh: asMonths([5, 6, 9, 10]),
  marketShoulder: asMonths([4, 7, 8, 11]),
  marketOff: asMonths([12, 1, 2, 3]),
  climateHigh: asMonths([5, 6, 9, 10]),
  climateShoulder: asMonths([4, 7, 8, 11]),
  climateOff: asMonths([12, 1, 2, 3]),
  marketReason: "Fixed country market season profile for Italy with strongest city demand in spring and autumn.",
  climateReason: "Fixed country climate season profile for Italy balancing summer heat and winter cold windows.",
  sources: SOURCES_ITALY,
});

const TEMPLATE_FR_MAIN = makeTemplate({
  marketHigh: asMonths([5, 6, 9]),
  marketShoulder: asMonths([4, 7, 8, 10]),
  marketOff: asMonths([11, 12, 1, 2, 3]),
  climateHigh: asMonths([5, 6, 9]),
  climateShoulder: asMonths([4, 7, 8, 10]),
  climateOff: asMonths([11, 12, 1, 2, 3]),
  marketReason: "Fixed country market season profile for France with spring-to-early-autumn concentration.",
  climateReason: "Fixed country climate season profile for France with coolest comfort in late spring and early autumn.",
  sources: SOURCES_FRANCE,
});

const TEMPLATE_DE_MAIN = makeTemplate({
  marketHigh: asMonths([5, 6, 9]),
  marketShoulder: asMonths([4, 7, 8, 10]),
  marketOff: asMonths([11, 12, 1, 2, 3]),
  climateHigh: asMonths([5, 6, 9]),
  climateShoulder: asMonths([4, 7, 8, 10]),
  climateOff: asMonths([11, 12, 1, 2, 3]),
  marketReason: "Fixed country market season profile for Germany with strongest demand in warm shoulder months.",
  climateReason: "Fixed country climate season profile for Germany with winter cold and occasional summer heat constraints.",
  sources: SOURCES_GERMANY,
});

const TEMPLATE_GB_MAIN = makeTemplate({
  marketHigh: asMonths([6, 7, 8]),
  marketShoulder: asMonths([5, 9, 10]),
  marketOff: asMonths([11, 12, 1, 2, 3, 4]),
  climateHigh: asMonths([6, 7, 8]),
  climateShoulder: asMonths([5, 9, 10]),
  climateOff: asMonths([11, 12, 1, 2, 3, 4]),
  marketReason: "Fixed country market season profile for the UK with demand peaking in summer and shoulder months.",
  climateReason: "Fixed country climate season profile for the UK with best outdoor comfort in late spring through summer.",
  sources: SOURCES_UK,
});

const TEMPLATE_PT_MAIN = makeTemplate({
  marketHigh: asMonths([5, 6, 9, 10]),
  marketShoulder: asMonths([4, 7, 8, 11]),
  marketOff: asMonths([12, 1, 2, 3]),
  climateHigh: asMonths([5, 6, 9, 10]),
  climateShoulder: asMonths([4, 7, 8, 11]),
  climateOff: asMonths([12, 1, 2, 3]),
  marketReason: "Fixed country market season profile for Portugal with strongest demand in spring, summer and early autumn.",
  climateReason: "Fixed country climate season profile for Portugal's Atlantic and Mediterranean transition.",
  sources: SOURCES_PORTUGAL,
});

const TEMPLATE_GR_MAIN = makeTemplate({
  marketHigh: asMonths([4, 5, 6, 9, 10]),
  marketShoulder: asMonths([3, 7, 8, 11]),
  marketOff: asMonths([12, 1, 2]),
  climateHigh: asMonths([4, 5, 6, 9, 10]),
  climateShoulder: asMonths([3, 7, 8, 11]),
  climateOff: asMonths([12, 1, 2]),
  marketReason: "Fixed country market season profile for Greece with high demand in spring, summer and early autumn.",
  climateReason: "Fixed country climate season profile for Greece with peak-heat midsummer moderation.",
  sources: SOURCES_GREECE,
});

const TEMPLATE_TR_MAIN = makeTemplate({
  marketHigh: asMonths([4, 5, 6, 9, 10]),
  marketShoulder: asMonths([3, 7, 8, 11]),
  marketOff: asMonths([12, 1, 2]),
  climateHigh: asMonths([4, 5, 6, 9, 10]),
  climateShoulder: asMonths([3, 7, 8, 11]),
  climateOff: asMonths([12, 1, 2]),
  marketReason: "Fixed country market season profile for Turkey with strongest travel demand in spring and autumn windows.",
  climateReason: "Fixed country climate season profile for Turkey across Mediterranean, continental and Black Sea influences.",
  sources: SOURCES_TURKEY,
});

const TEMPLATE_IN_MAIN = makeTemplate({
  marketHigh: asMonths([11, 12, 1, 2, 3]),
  marketShoulder: asMonths([4, 10]),
  marketOff: asMonths([5, 6, 7, 8, 9]),
  climateHigh: asMonths([11, 12, 1, 2, 3]),
  climateShoulder: asMonths([4, 10]),
  climateOff: asMonths([5, 6, 7, 8, 9]),
  marketReason: "Fixed country market season profile for India with demand concentration during cooler dry-season months.",
  climateReason: "Fixed country climate season profile for India with broad monsoon-related comfort limits in mid-year.",
  sources: SOURCES_INDIA,
});

const TEMPLATE_EG_MAIN = makeTemplate({
  marketHigh: asMonths([11, 12, 1, 2, 3]),
  marketShoulder: asMonths([4, 10]),
  marketOff: asMonths([5, 6, 7, 8, 9]),
  climateHigh: asMonths([11, 12, 1, 2, 3]),
  climateShoulder: asMonths([4, 10]),
  climateOff: asMonths([5, 6, 7, 8, 9]),
  marketReason: "Fixed country market season profile for Egypt with strongest demand in cooler winter and shoulder periods.",
  climateReason: "Fixed country climate season profile for Egypt where summer desert heat is a dominant comfort constraint.",
  sources: SOURCES_EGYPT,
});

const TEMPLATE_ZA_MAIN = makeTemplate({
  marketHigh: asMonths([12, 1, 2, 3, 11]),
  marketShoulder: asMonths([4, 10]),
  marketOff: asMonths([5, 6, 7, 8, 9]),
  climateHigh: asMonths([11, 12, 1, 2, 3]),
  climateShoulder: asMonths([4, 10]),
  climateOff: asMonths([5, 6, 7, 8, 9]),
  marketReason: "Fixed country market season profile for South Africa with summer-peak demand in the southern hemisphere.",
  climateReason: "Fixed country climate season profile for South Africa with cooler winter months and warm coastal summers.",
  sources: SOURCES_SOUTH_AFRICA,
});

const TEMPLATE_KE_MAIN = makeTemplate({
  marketHigh: asMonths([1, 2, 6, 7, 8]),
  marketShoulder: asMonths([3, 9, 10, 12]),
  marketOff: asMonths([4, 5, 11]),
  climateHigh: asMonths([1, 2, 6, 7, 8]),
  climateShoulder: asMonths([3, 9, 10, 12]),
  climateOff: asMonths([4, 5, 11]),
  marketReason: "Fixed country market season profile for Kenya around drier windows between long and short rains.",
  climateReason: "Fixed country climate season profile for Kenya with two rainy seasons reducing comfort in spring and late autumn.",
  sources: SOURCES_KENYA,
});

const TEMPLATE_PE_MAIN = makeTemplate({
  marketHigh: asMonths([5, 6, 7, 8, 9]),
  marketShoulder: asMonths([4, 10, 11]),
  marketOff: asMonths([12, 1, 2, 3]),
  climateHigh: asMonths([5, 6, 7, 8, 9]),
  climateShoulder: asMonths([4, 10, 11]),
  climateOff: asMonths([12, 1, 2, 3]),
  marketReason: "Fixed country market season profile for Peru with dry-season demand peaks in Andes and coastal shoulder balance.",
  climateReason: "Fixed country climate season profile for Peru balancing coastal humidity, Andean seasonality and Amazon rainfall.",
  sources: SOURCES_PERU,
});

const TEMPLATE_CO_MAIN = makeTemplate({
  marketHigh: asMonths([12, 1, 2, 6, 7, 8]),
  marketShoulder: asMonths([3, 4, 9, 10, 11]),
  marketOff: asMonths([5]),
  climateHigh: asMonths([12, 1, 2, 6, 7, 8]),
  climateShoulder: asMonths([3, 4, 9, 10, 11]),
  climateOff: asMonths([5]),
  marketReason: "Fixed country market season profile for Colombia with strong travel windows in drier periods.",
  climateReason: "Fixed country climate season profile for Colombia with intertropical rainfall peaks and altitude-driven variation.",
  sources: SOURCES_COLOMBIA,
});

const REGION_TEMPLATE_MAP: Record<string, SeasonTemplate> = {
  "vn-hanoi": TEMPLATE_VN_NORTH,
  "vn-haiphong": TEMPLATE_VN_NORTH,
  "vn-da-nang": TEMPLATE_VN_CENTRAL,
  "vn-nha-trang": TEMPLATE_VN_NHA_TRANG,
  "vn-ho-chi-minh": TEMPLATE_VN_SOUTH,

  "th-bangkok": TEMPLATE_TH_MAINLAND,
  "th-chiang-mai": TEMPLATE_TH_MAINLAND,
  "th-phuket": TEMPLATE_TH_ANDAMAN,
  "th-krabi": TEMPLATE_TH_ANDAMAN,
  "th-khon-kaen": TEMPLATE_TH_MAINLAND,

  "my-kuala-lumpur": TEMPLATE_MY_WEST,
  "my-penang": TEMPLATE_MY_WEST,
  "my-kota-bharu": TEMPLATE_MY_EAST,
  "my-kota-kinabalu": TEMPLATE_MY_BORNEO,
  "my-kuching": TEMPLATE_MY_BORNEO,

  "id-jakarta": TEMPLATE_ID_JAVA_BALI,
  "id-surabaya": TEMPLATE_ID_JAVA_BALI,
  "id-yogyakarta": TEMPLATE_ID_JAVA_BALI,
  "id-medan": TEMPLATE_ID_MEDAN,
  "id-denpasar": TEMPLATE_ID_BALI,
  "id-lombok": TEMPLATE_ID_JAVA_BALI,
  "id-balikpapan": TEMPLATE_ID_EAST,
  "id-makassar": TEMPLATE_ID_EAST,
  "id-jayapura": TEMPLATE_ID_EAST,

  "ph-manila": TEMPLATE_PH_MAIN,
  "ph-cebu": TEMPLATE_PH_CEBU_DAVAO,
  "ph-davao": TEMPLATE_PH_CEBU_DAVAO,
  "ph-puerto-princesa": TEMPLATE_PH_MAIN,
  "ph-iloilo": TEMPLATE_PH_MAIN,

  "sg-singapore": TEMPLATE_SINGAPORE,

  "bn-bandar-seri-begawan": TEMPLATE_BRUNEI,

  "kh-phnom-penh": TEMPLATE_KH_INLAND,
  "kh-siem-reap": TEMPLATE_KH_INLAND,
  "kh-sihanoukville": TEMPLATE_KH_COAST,

  "la-vientiane": TEMPLATE_LAOS,
  "la-luang-prabang": TEMPLATE_LAOS,

  "mm-yangon": TEMPLATE_MM_YANGON,
  "mm-mandalay": TEMPLATE_MM_DRY,
  "mm-bagan": TEMPLATE_MM_DRY,

  "tl-dili": TEMPLATE_TIMOR,

  "lk-colombo": TEMPLATE_LK_WEST_SOUTH,
  "lk-galle": TEMPLATE_LK_WEST_SOUTH,
  "lk-kandy": TEMPLATE_LK_HIGHLANDS,
  "lk-trincomalee": TEMPLATE_LK_EAST,
  "lk-jaffna": TEMPLATE_LK_NORTH,

  "jp-tokyo": TEMPLATE_JP_MAIN,
  "jp-osaka": TEMPLATE_JP_MAIN,
  "jp-sapporo": TEMPLATE_JP_HOKKAIDO,
  "jp-fukuoka": TEMPLATE_JP_MAIN,
  "jp-naha": TEMPLATE_JP_OKINAWA,

  "at-vienna": TEMPLATE_AT_MAIN,
  "at-salzburg": TEMPLATE_AT_ALPINE,
  "at-innsbruck": TEMPLATE_AT_ALPINE,
  "at-graz": TEMPLATE_AT_MAIN,
  "at-klagenfurt": TEMPLATE_AT_ALPINE,

  "es-madrid": TEMPLATE_ES_INLAND,
  "es-barcelona": TEMPLATE_ES_MED,
  "es-valencia": TEMPLATE_ES_MED,
  "es-seville": TEMPLATE_ES_INLAND,
  "es-malaga": TEMPLATE_ES_MED,
  "es-palma": TEMPLATE_ES_MED,
  "es-bilbao": TEMPLATE_ES_NORTH,

  "ma-casablanca": TEMPLATE_MA_COAST,
  "ma-marrakesh": TEMPLATE_MA_INLAND,
  "ma-tangier": TEMPLATE_MA_COAST,
  "ma-agadir": TEMPLATE_MA_COAST,
  "ma-fes": TEMPLATE_MA_INLAND,
  "ma-rabat": TEMPLATE_MA_COAST,

  "kr-seoul": TEMPLATE_KR_MAIN,
  "kr-busan": TEMPLATE_KR_BUSAN,
  "kr-jeju": TEMPLATE_KR_JEJU,
  "kr-daegu": TEMPLATE_KR_MAIN,
  "kr-gangneung": TEMPLATE_KR_MAIN,

  "cn-beijing": TEMPLATE_CN_NORTH,
  "cn-shanghai": TEMPLATE_CN_EAST,
  "cn-guangzhou": TEMPLATE_CN_SOUTH,
  "cn-shenzhen": TEMPLATE_CN_SOUTH,
  "cn-chengdu": TEMPLATE_CN_SOUTHWEST,
  "cn-xian": TEMPLATE_CN_NORTH,
  "cn-harbin": TEMPLATE_CN_NORTH,
  "cn-kunming": TEMPLATE_CN_SOUTHWEST,
  "cn-sanya": TEMPLATE_CN_TROPICAL,
  "cn-hangzhou": TEMPLATE_CN_EAST,

  "tw-taipei": TEMPLATE_TW_MAIN,
  "tw-taichung": TEMPLATE_TW_MAIN,
  "tw-kaohsiung": TEMPLATE_TW_SOUTH,
  "tw-hualien": TEMPLATE_TW_MAIN,
  "tw-tainan": TEMPLATE_TW_SOUTH,

  "au-sydney": TEMPLATE_AU_SOUTHEAST,
  "au-melbourne": TEMPLATE_AU_SOUTHEAST,
  "au-brisbane": TEMPLATE_AU_SOUTHEAST,
  "au-perth": TEMPLATE_AU_WEST,
  "au-cairns": TEMPLATE_AU_TROPICAL,
  "au-adelaide": TEMPLATE_AU_SOUTHEAST,
  "au-darwin": TEMPLATE_AU_TROPICAL,
  "au-hobart": TEMPLATE_AU_SOUTHEAST,
  "au-gold-coast": TEMPLATE_AU_SOUTHEAST,

  "nz-auckland": TEMPLATE_NZ_MAIN,
  "nz-wellington": TEMPLATE_NZ_MAIN,
  "nz-christchurch": TEMPLATE_NZ_MAIN,
  "nz-queenstown": TEMPLATE_NZ_QUEENSTOWN,
  "nz-dunedin": TEMPLATE_NZ_MAIN,
  "nz-rotorua": TEMPLATE_NZ_MAIN,

  "is-reykjavik": TEMPLATE_IS_REYKJAVIK,
  "no-tromso": TEMPLATE_NO_TROMSO,
  "fi-helsinki": TEMPLATE_FI_HELSINKI,

  "ca-vancouver": TEMPLATE_CA_COAST,
  "ca-calgary": TEMPLATE_CA_INTERIOR,
  "us-anchorage": TEMPLATE_US_ALASKA,

  "ae-dubai": TEMPLATE_GULF_COAST,
  "sa-riyadh": TEMPLATE_GULF_INLAND,

  "cl-santiago": TEMPLATE_CL_CENTRAL,
  "cl-punta-arenas": TEMPLATE_CL_PATAGONIA,
  "ar-buenos-aires": TEMPLATE_AR_BUENOS_AIRES,

  "au-alice-springs": TEMPLATE_AU_DESERT,
  "es-las-palmas": TEMPLATE_ES_CANARY,
  "cn-urumqi": TEMPLATE_CN_URUMQI,
  "cn-lhasa": TEMPLATE_CN_LHASA,
  "br-sao-paulo": TEMPLATE_BR_MAIN,
  "br-rio-de-janeiro": TEMPLATE_BR_MAIN,
  "br-salvador": TEMPLATE_BR_MAIN,
  "br-manaus": TEMPLATE_BR_MAIN,
  "br-porto-alegre": TEMPLATE_BR_MAIN,
  "mx-mexico-city": TEMPLATE_MX_MAIN,
  "mx-cancun": TEMPLATE_MX_MAIN,
  "mx-guadalajara": TEMPLATE_MX_MAIN,
  "mx-monterrey": TEMPLATE_MX_MAIN,
  "mx-puerto-vallarta": TEMPLATE_MX_MAIN,
  "it-rome": TEMPLATE_IT_MAIN,
  "it-milan": TEMPLATE_IT_MAIN,
  "it-naples": TEMPLATE_IT_MAIN,
  "it-palermo": TEMPLATE_IT_MAIN,
  "it-venice": TEMPLATE_IT_MAIN,
  "fr-paris": TEMPLATE_FR_MAIN,
  "fr-lyon": TEMPLATE_FR_MAIN,
  "fr-marseille": TEMPLATE_FR_MAIN,
  "fr-nice": TEMPLATE_FR_MAIN,
  "fr-bordeaux": TEMPLATE_FR_MAIN,
  "de-berlin": TEMPLATE_DE_MAIN,
  "de-munich": TEMPLATE_DE_MAIN,
  "de-hamburg": TEMPLATE_DE_MAIN,
  "de-frankfurt": TEMPLATE_DE_MAIN,
  "de-cologne": TEMPLATE_DE_MAIN,
  "gb-london": TEMPLATE_GB_MAIN,
  "gb-manchester": TEMPLATE_GB_MAIN,
  "gb-edinburgh": TEMPLATE_GB_MAIN,
  "gb-glasgow": TEMPLATE_GB_MAIN,
  "gb-belfast": TEMPLATE_GB_MAIN,
  "pt-lisbon": TEMPLATE_PT_MAIN,
  "pt-porto": TEMPLATE_PT_MAIN,
  "pt-faro": TEMPLATE_PT_MAIN,
  "pt-funchal": TEMPLATE_PT_MAIN,
  "pt-ponta-delgada": TEMPLATE_PT_MAIN,
  "gr-athens": TEMPLATE_GR_MAIN,
  "gr-thessaloniki": TEMPLATE_GR_MAIN,
  "gr-heraklion": TEMPLATE_GR_MAIN,
  "gr-rhodes": TEMPLATE_GR_MAIN,
  "gr-corfu": TEMPLATE_GR_MAIN,
  "tr-istanbul": TEMPLATE_TR_MAIN,
  "tr-ankara": TEMPLATE_TR_MAIN,
  "tr-izmir": TEMPLATE_TR_MAIN,
  "tr-antalya": TEMPLATE_TR_MAIN,
  "tr-trabzon": TEMPLATE_TR_MAIN,
  "in-delhi": TEMPLATE_IN_MAIN,
  "in-mumbai": TEMPLATE_IN_MAIN,
  "in-bengaluru": TEMPLATE_IN_MAIN,
  "in-kolkata": TEMPLATE_IN_MAIN,
  "in-chennai": TEMPLATE_IN_MAIN,
  "eg-cairo": TEMPLATE_EG_MAIN,
  "eg-alexandria": TEMPLATE_EG_MAIN,
  "eg-luxor": TEMPLATE_EG_MAIN,
  "eg-aswan": TEMPLATE_EG_MAIN,
  "eg-sharm-el-sheikh": TEMPLATE_EG_MAIN,
  "za-cape-town": TEMPLATE_ZA_MAIN,
  "za-johannesburg": TEMPLATE_ZA_MAIN,
  "za-durban": TEMPLATE_ZA_MAIN,
  "za-pretoria": TEMPLATE_ZA_MAIN,
  "za-port-elizabeth": TEMPLATE_ZA_MAIN,
  "ke-nairobi": TEMPLATE_KE_MAIN,
  "ke-mombasa": TEMPLATE_KE_MAIN,
  "ke-kisumu": TEMPLATE_KE_MAIN,
  "ke-eldoret": TEMPLATE_KE_MAIN,
  "ke-malindi": TEMPLATE_KE_MAIN,
  "pe-lima": TEMPLATE_PE_MAIN,
  "pe-cusco": TEMPLATE_PE_MAIN,
  "pe-arequipa": TEMPLATE_PE_MAIN,
  "pe-iquitos": TEMPLATE_PE_MAIN,
  "pe-trujillo": TEMPLATE_PE_MAIN,
  "co-bogota": TEMPLATE_CO_MAIN,
  "co-medellin": TEMPLATE_CO_MAIN,
  "co-cartagena": TEMPLATE_CO_MAIN,
  "co-cali": TEMPLATE_CO_MAIN,
  "co-barranquilla": TEMPLATE_CO_MAIN,
};

export function getFixedSeasonProfile(regionId: string): FixedSeasonProfile | null {
  const template = REGION_TEMPLATE_MAP[regionId];
  if (!template) {
    return null;
  }

  return {
    regionId,
    marketByMonth: { ...template.marketByMonth },
    climateByMonth: { ...template.climateByMonth },
    marketReason: template.marketReason,
    climateReason: template.climateReason,
    sources: [...template.sources],
    lastReviewed: REVIEWED_AT,
  };
}
