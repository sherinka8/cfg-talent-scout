// api/scout.js - Consolidated 2025 & 2026 High-Value Tech Sourcing Engine
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const cacheBuster = Date.now();
  const MINIMUM_VALUE_THRESHOLD = 150000;

  // Exact target year boundaries required
  const targetRanges = [
    { from: "2025-01-01T00:00:00", to: "2025-12-31T23:59:59" }, // Complete 2025 Pipeline
    { from: "2026-01-01T00:00:00", to: new Date().toISOString().split('T')[0] + "T23:59:59" } // 2026 To Date
  ];

  const CRAP_EXCLUSION_KEYWORDS = [
    "eyecare", "eye care", "voucher", "optician", "benefits platform", "cycle to work", 
    "catering", "canteen", "security guard", "cleaning", "uniform", "furniture", 
    "occupational health", "medical check", "gym membership", "translation"
  ];

  const CORE_TECH_KEYWORDS = [
    "software", "developer", "engineer", "data", "cloud", "migration", "application", 
    "react", "javascript", "python", "sql", "aws", "azure", "devops", "cyber", 
    "scrum", "agile", "product manager", "qa", "testing", "automation", "full-stack"
  ];

  let rawReleasesCombined = [];

  try {
    // Loop through both timelines independently to force the Gov database to yield both stacks
    for (const range of targetRanges) {
      const fetchUrl = `https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?publishedFrom=${range.from}&publishedTo=${range.to}&limit=100&stages=tender,award&cb=${cacheBuster}`;
      
      const apiResponse = await fetch(fetchUrl, {
        method: 'POST', // Government index demands POST schema for payload maps
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpvCodes: ["72000000"] }) // IT Category lock
      });

      if (apiResponse.ok) {
        const payloadData = await apiResponse.json();
        if (payloadData.releases) {
          rawReleasesCombined = rawReleasesCombined.concat(payloadData.releases);
        }
      }
    }

    let liveTenders = [];
    let contractWins = [];

    rawReleasesCombined.forEach((release) => {
      const tender = release.tender || {};
      const awards = release.awards || [];
      const buyer = release.buyer?.name || "UK Government Department";
      const title = tender.title || "Digital Transformation Project";
      const description = tender.description || "";
      
      // Compute accurate timeline display year
      const rawDateString = release.date || tender.tenderPeriod?.startDate || "2025-06-01";
      const recordYear = new Date(rawDateString).getFullYear();

      const numericValue = tender.value?.amount || 0;
      const valueDisplay = numericValue > 0 ? `£${numericValue.toLocaleString()}` : "Value inside Document logs";
      const fullTextLower = `${title} ${description}`.toLowerCase();

      // Core filter configurations
      if (numericValue > 0 && numericValue < MINIMUM_VALUE_THRESHOLD) return;
      if (CRAP_EXCLUSION_KEYWORDS.some(word => fullTextLower.includes(word))) return; 
      if (!CORE_TECH_KEYWORDS.some(word => fullTextLower.includes(word))) return; 

      let pathway = "Software Engineering";
      if (fullTextLower.includes("python") || fullTextLower.includes("sql") || fullTextLower.includes("data")) {
        pathway = "Data Engineering";
      } else if (fullTextLower.includes("javascript") || fullTextLower.includes("react") || fullTextLower.includes("node")) {
        pathway = "Full-Stack";
      }

      const portalQueryString = encodeURIComponent(`${buyer} ${title}`.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 80));

      if (release.tag?.includes("tender") || awards.length === 0) {
        liveTenders.push({
          searchQuery: portalQueryString,
          year: recordYear,
          buyer,
          title,
          description,
          value: valueDisplay,
          pathway,
          closingDate: tender.tenderPeriod?.endDate ? new Date(tender.tenderPeriod.endDate).toLocaleDateString('en-GB') : "See Notice"
        });
      } else {
        let suppliers = [];
        awards.forEach(aw => (aw.suppliers || []).forEach(s => suppliers.push(s.name)));

        contractWins.push({
          searchQuery: portalQueryString,
          year: recordYear,
          buyer,
          title,
          description,
          value: valueDisplay,
          pathway,
          suppliers,
          awardDate: awards[0]?.date ? new Date(awards[0].date).toLocaleDateString('en-GB') : "Recent Notice"
        });
      }
    });

    return res.status(200).json({ liveTenders, contractWins });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
