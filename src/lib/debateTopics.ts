// Förslag på sakområden som chips i ThreadHeader.
// Användaren kan också skriva eget i fritext.
export const TOPIC_AREA_SUGGESTIONS = [
  "Skola och utbildning",
  "Vård och omsorg",
  "Äldreomsorg",
  "Infrastruktur och kollektivtrafik",
  "Bostäder och samhällsbyggnad",
  "Ekonomi och skatter",
  "Miljö och klimat",
  "Energi",
  "Kultur och fritid",
  "Trygghet och brottslighet",
  "Integration och migration",
  "Arbetsmarknad och näringsliv",
  "Demokrati och förvaltning",
  "Jordbruk och landsbygd",
  "Digitalisering",
] as const;

export type TopicAreaSuggestion = (typeof TOPIC_AREA_SUGGESTIONS)[number];
