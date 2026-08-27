// Common Indian metro/tech-hub city names, lowercase, for a best-effort
// India-location match on sources that only give a free-text location
// string (everything except hiring.cafe, which has a real country code).
const INDIA_HINTS = [
  "india",
  "bengaluru",
  "bangalore",
  "mumbai",
  "delhi",
  "gurugram",
  "gurgaon",
  "noida",
  "hyderabad",
  "pune",
  "chennai",
  "kolkata",
  "ahmedabad",
  "jaipur",
  "kochi",
  "cochin",
  "chandigarh",
  "indore",
  "coimbatore",
  "nagpur",
  "surat",
];

export function isIndiaLocation(location: string | null): boolean {
  if (!location) return false;
  const lower = location.toLowerCase();
  return INDIA_HINTS.some((hint) => lower.includes(hint));
}
