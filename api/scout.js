// api/scout.js - Master Timeline Sourcing & Query Link Encoder
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  // Request a bulk chunk directly from the core pipeline
  const cacheBuster = Date.now();
  const GOV_API_URL = `https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?limit=100&stages=tender,award&cb=${cacheBuster}`;

  const MINIMUM_VALUE_THRESHOLD = 150000;

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

  try {
    const apiResponse = await fetch(GOV_API_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!apiResponse.ok) throw new Error(`Registry connection error`);

    const data = await apiResponse.json();
    const releases = data.releases || [];

    let liveTenders = [];
    let contractWins = [];

    releases.forEach((release) => {
      const tender = release.tender || {};
      const awards = release.awards || [];
      const buyer = release.buyer?.name || "UK Government Department";
      const title = tender.title || "Digital Transformation Project";
      const description = tender.description || "";
      
      // Extract numeric date cleanly to map year tracks accurately
      const rawDate = release.date || tender.tenderPeriod?.startDate || "2025-01-01";
      const recordYear = new Date(rawDate).getFullYear();

      const numericValue = tender.value?.amount || 0;
      const valueDisplay = numericValue > 0 ? `£${numericValue.toLocaleString()}` : "Value inside Document logs";
      const fullTextLower = `${title} ${description}`.toLowerCase();

      // Application Master Filters
      if (numericValue > 0 && numericValue < MINIMUM_VALUE_THRESHOLD) return;
      if (CRAP_EXCLUSION_KEYWORDS.some(word => fullTextLower.includes(word))) return; 
      if (!CORE_TECH_KEYWORDS.some(word => fullTextLower.includes(word))) return; 

      let pathway = "Software Engineering";
      if (fullTextLower.includes("python") || fullTextLower.includes("sql") || fullTextLower.includes("data")) {
        pathway = "Data Engineering";
      } else if (fullTextLower.includes("javascript") || fullTextLower.includes("react") || fullTextLower.includes("node")) {
        pathway = "Full-Stack";
      }

      // Format clean search strings to inject directly into the live public search engine
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
