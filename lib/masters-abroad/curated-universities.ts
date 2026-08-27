/**
 * Curated real official program pages for German universities with strong
 * cybersecurity/infosec master's programs — researched and spot-checked
 * live (not AI-generated) to avoid the hallucinated-URL problem Gemini has
 * with no browsing access. Matched against AI suggestions by name at
 * discovery time; anything outside this list falls back to a real Google
 * search link rather than a fabricated .edu-looking URL.
 *
 * Tuition note: Baden-Württemberg (KIT) charges ~€1,500/semester for
 * non-EU students since 2017; all other German states listed here are
 * currently tuition-free for public universities (semester admin fee only,
 * typically €100-350). Always confirm current rules on the official page.
 */
export type CuratedUniversity = {
  matchNames: string[]; // substrings matched case-insensitively against an AI-suggested name
  officialUrl: string;
  city: string;
  focusAreas: string[];
  tuitionNote: string;
  caveat?: string;
};

export const CURATED_UNIVERSITIES: CuratedUniversity[] = [
  {
    matchNames: ["saarland", "saarbrücken", "saarbruecken", "cispa"],
    officialUrl: "https://www.uni-saarland.de/en/study/programmes/master/cybersecurity.html",
    city: "Saarbrücken",
    focusAreas: ["Cryptography", "Privacy", "Software Security", "Systems & Networks"],
    tuitionNote: "No tuition fees — semester fee only. Run in cooperation with CISPA Helmholtz Center.",
  },
  {
    matchNames: ["tu darmstadt", "technical university of darmstadt", "athene"],
    officialUrl: "https://www.informatik.tu-darmstadt.de/studium_fb20/im_studium/studiengaenge_liste/itsecurity_msc.en.jsp",
    city: "Darmstadt",
    focusAreas: ["Cryptography", "System Security", "Software Security"],
    tuitionNote: "No tuition fees — semester fee only. Hosted by ATHENE, Europe's largest cybersecurity research center.",
  },
  {
    matchNames: ["ruhr", "bochum", "rub", "horst görtz"],
    officialUrl: "https://informatik.rub.de/en/studies/its/",
    city: "Bochum",
    focusAreas: ["IT Security", "Networks and Systems", "Applied Cryptography"],
    tuitionNote: "No tuition fees — semester fee only. Home to the Horst Görtz Institute for IT Security.",
  },
  {
    matchNames: ["rwth aachen", "aachen"],
    officialUrl: "https://www.rwth-aachen.de/cms/root/studium/vor-dem-studium/studiengaenge/liste-aktuelle-studiengaenge/studiengangbeschreibung/~bcfg/informatik-m-sc/",
    city: "Aachen",
    focusAreas: ["Computer Science (general)", "Security as an elective specialization"],
    tuitionNote: "No tuition fees — semester fee only.",
    caveat: "General MSc Computer Science — verify current security-track elective availability directly with the department.",
  },
  {
    matchNames: ["tu berlin", "technical university of berlin", "technische universität berlin"],
    officialUrl: "https://www.tu.berlin/en/eecs/academics-teaching/study-offer/masters-programs/msc-computer-science-informatik",
    city: "Berlin",
    focusAreas: ["Computer Science (general)", "IT Security as a certified track"],
    tuitionNote: "No tuition fees — semester fee only.",
    caveat: "General MSc Computer Science with an optional certified IT Security track — verify current track offerings directly.",
  },
  {
    matchNames: ["karlsruhe", "kit "],
    officialUrl: "https://www.informatik.kit.edu/english/mastercomputerscience.php",
    city: "Karlsruhe",
    focusAreas: ["Computer Science (general)", "Security as an elective specialization"],
    tuitionNote: "Baden-Württemberg charges ~€1,500/semester for non-EU students (unlike most other German states) — verify current amount.",
    caveat: "General MSc Computer Science — verify current security-track elective availability directly with the department.",
  },
  {
    matchNames: ["technical university of munich", "tum", "münchen"],
    officialUrl: "https://www.cit.tum.de/en/cit/studies/degree-programs/master-informatics/",
    city: "Munich",
    focusAreas: ["Computer Science (general)"],
    tuitionNote: "No tuition fees — semester fee only.",
    caveat: "General MSc Informatics — cybersecurity is not currently a listed specialization track; verify directly before counting on it.",
  },
];

export function matchCuratedUniversity(name: string): CuratedUniversity | null {
  const lower = name.toLowerCase();
  return CURATED_UNIVERSITIES.find((u) => u.matchNames.some((m) => lower.includes(m))) ?? null;
}

/** Rough monthly cost-of-living estimates (rent + living expenses) for comparison — not university-specific. */
export const CITY_COST_OF_LIVING: Record<string, string> = {
  Munich: "€1,200-1,500/month — one of Germany's most expensive cities",
  Berlin: "€1,000-1,300/month — rising fast but still below Munich",
  Karlsruhe: "€850-1,100/month",
  Stuttgart: "€1,000-1,250/month",
  Aachen: "€750-950/month",
  Darmstadt: "€800-1,000/month",
  Bochum: "€650-850/month — one of the more affordable options",
  Saarbrücken: "€650-850/month — one of the more affordable options",
};
