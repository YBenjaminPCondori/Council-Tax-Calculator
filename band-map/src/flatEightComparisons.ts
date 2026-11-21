import { buildings, flatAddress } from "./data";
import type { BuildingId } from "./data";
import { flatEightEvidence as subject } from "./flatEightEvidence";

export interface ComparisonCandidate {
  id: string;
  building: BuildingId;
  flat: number;
  band: "C" | "E";
  propertyType: "Mid-floor flat";
  epcFloorArea: number;
  valuationUrl: string;
  epcUrl: string;
}

const nearbyFlats = [
  { building: "woolspinners", flat: 1, band: "C", epcFloorArea: 54,
    valuationId: "4e4edebb-f3f4-2481-ad94-97f48fe18250", epcId: "5690-5038-0332-4094-3973" },
  { building: "woolspinners", flat: 2, band: "C", epcFloorArea: 54,
    valuationId: "fcf6867d-9a8e-9a5d-0fbb-098277b1e891", epcId: "9836-3906-4309-8437-0200" },
  { building: "woolspinners", flat: 3, band: "C", epcFloorArea: 54,
    valuationId: "60d01b8a-644b-cd54-94be-2dce6ee7a92f", epcId: "7537-4039-8009-0313-6292" },
  { building: "woolspinners", flat: 4, band: "C", epcFloorArea: 54,
    valuationId: "1e660566-e337-fd68-e0ef-18803f6d1cf6", epcId: "8137-4039-8009-0343-6292" },
  { building: "woolspinners", flat: 5, band: "C", epcFloorArea: 54,
    valuationId: "f9dbdb0e-f637-37fe-5096-666bd662e375", epcId: "9039-3906-4309-8237-0200" },
  { building: "woolspinners", flat: 6, band: "C", epcFloorArea: 55,
    valuationId: "914d10db-4cca-d983-6b03-81f8936bd37b", epcId: "0137-5039-8009-0313-6296" },
  { building: "woolspinners", flat: 7, band: "E", epcFloorArea: 75,
    valuationId: "d920291f-a5f1-ca25-87ab-5a546581b2f5", epcId: "1690-3038-0332-2095-3973" },
  { building: "softwood", flat: 1, band: "C", epcFloorArea: 54,
    valuationId: "9cd6eda0-f020-c04e-f5b9-cfca3c526da8", epcId: "9600-0322-0832-6027-3943" },
  { building: "softwood", flat: 2, band: "C", epcFloorArea: 54,
    valuationId: "31437887-d119-aef0-5882-10a7499d1688", epcId: "2222-3006-8309-2084-3200" },
  { building: "softwood", flat: 3, band: "C", epcFloorArea: 54,
    valuationId: "99e07d9d-254e-3ed2-25ed-79544f4ca6c0", epcId: "2124-3006-8309-2684-3200" },
  { building: "softwood", flat: 4, band: "C", epcFloorArea: 54,
    valuationId: "b93b7f3f-31f4-74b7-3c04-b36dc6c44187", epcId: "5434-8339-2000-0842-6222" },
  { building: "softwood", flat: 5, band: "C", epcFloorArea: 54,
    valuationId: "5f8abacd-6e61-cb25-fdff-532201f3ce53", epcId: "0320-3982-8090-2324-0631" },
  { building: "softwood", flat: 6, band: "C", epcFloorArea: 55,
    valuationId: "63537001-8389-8ec2-64e9-a8344a584709", epcId: "0320-3382-9090-2324-8671" },
  { building: "softwood", flat: 7, band: "E", epcFloorArea: 75,
    valuationId: "95b72145-84f7-97b1-f6f7-5de8e7c074a4", epcId: "9634-9339-2000-0812-6226" },
] as const;

export const candidates: ComparisonCandidate[] = nearbyFlats.map(({ valuationId, epcId, ...flat }) => ({
  ...flat,
  id: candidateId(flat.building, flat.flat),
  propertyType: "Mid-floor flat",
  valuationUrl: "https://www.tax.service.gov.uk/check-council-tax-band/property/" + valuationId,
  epcUrl: "https://find-energy-certificate.service.gov.uk/energy-certificate/" + epcId,
}));

export const maxComparisons = 5;
export const reviewGuidanceUrl = "https://www.gov.uk/challenge-council-tax-band/do-not-have-a-legal-right-to-make-a-challenge";
export const subjectAddress = flatAddress(buildings[subject.building], subject.flat);
export const subjectEffectiveDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" })
  .format(new Date(subject.effectiveFrom));

export const evidenceChecklist = [
  "Obtain a measured plan and confirm the Effective Floor Area.",
  "Look for closely matched lower-band flats and verify their type, size, age, style and design.",
  "Check the official review guidance and confirm which route applies to your case.",
];

export function candidateId(building: BuildingId, flat: number) {
  return building + ":" + flat;
}

export function comparisonDifference(candidate: ComparisonCandidate) {
  return (subject.epcFloorArea - candidate.epcFloorArea) + " m² less EPC floor area than Flat 8. The EPC lists a mid-floor flat.";
}

export function makeReviewLetter(selected: readonly ComparisonCandidate[]) {
  const paragraphs = [
    "Dear Valuation Office,",
    "Please review the Council Tax band for " + subjectAddress + ". The valuation list shows Band " +
      subject.band + " with effect from " + subjectEffectiveDate + ".",
    "The EPC describes the property as a top-floor flat and records a total floor area of " +
      subject.epcFloorArea + " m². Please confirm the property details and the Effective Floor Area used in the valuation.",
  ];
  if (selected.length) {
    paragraphs.push(
      "I have included the following nearby lower-band flats as candidates for comparison:",
      selected.map(candidate => "- " + flatAddress(buildings[candidate.building], candidate.flat) +
        " (Band " + candidate.band + ", " + candidate.epcFloorArea + " m² EPC total floor area)").join("\n"),
      "These are smaller mid-floor flats. The evidence pack records those differences. I am seeking more closely matched evidence.",
    );
  } else {
    paragraphs.push("I am gathering measured information and evidence from similar properties for comparison.");
  }
  paragraphs.push("Please explain the basis for the band and let me know what further evidence would help your review.", "Yours faithfully,\n[Your name]");
  return paragraphs.join("\n\n");
}
