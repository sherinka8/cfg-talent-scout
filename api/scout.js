// api/scout.js - Cache-Busting Live 2025/2026 Procurement Engine
export default async function handler(req, res) {
  // Force headers to prevent browser blocks and tell Vercel NEVER to cache this response
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Hardcoded dates for 2025 through current day in 2026
  const startDate = "2025-01-01T00:00:00";
  const endDate = new Date().toISOString().split('T')[0] + "T23:59:59";
  
  // ⚡ CACHE-BUSTING MIRACLE: Adding a unique timestamp forces Vercel to fetch fresh data every single click
  const cacheBuster = Date.now();
  
  // Clean, pure URL encoding structure for the UK Government server
  const GOV_API_URL = `https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?publishedFrom=${startDate}&publishedTo=${endDate}&limit=100&cpvCodes=72000000&cb=${cacheBuster}`;

  const MINIMUM_VALUE_THRESHOLD = 150000;

  const CRAP_EXCLUSION_KEYWORDS = [
    "eyecare", "eye care", "voucher", "optician", "benefits platform", "cycle to work", 
    "catering", "canteen", "security guard", "cleaning", "uniform", "furniture", 
    "occupational health", "medical check", "gym membership", "translation", "courier"
  ];

  const CORE_TECH_KEYWORDS = [
    "software", "developer", "engineer", "data", "cloud", "migration", "application", 
    "react", "javascript", "python", "sql", "aws", "azure", "devops", "cyber", 
    "scrum", "agile", "product manager", "qa", "testing", "automation", "full-stack", "frontend"
  ];

  try {
    // We change this to a clean GET request. No payload body to confuse the gov server.
    const apiResponse = await fetch(GOV_API_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!apiResponse.ok) {
      throw new Error(`Government Server Rejected Request: ${apiResponse.status}`);
    }

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
      
      // Isolate clean Find a Tender ID suffix
      let rawOcid = release.ocid || "";
      let publicLinkHash = rawOcid.replace("ocds-b5fd17-", ""); 
      if (!publicLinkHash && release.id) publicLinkHash = release.id;

      const numericValue = tender.value?.amount || 0;
      const valueDisplay = numericValue > 0 ? `£${numericValue.toLocaleString()}` : "Value inside Document logs";
      
      const fullTextLower = `${title} ${description}`.toLowerCase();

      // Filters
      if (numericValue > 0 && numericValue < MINIMUM_VALUE_THRESHOLD) return;
      if (CRAP_EXCLUSION_KEYWORDS.some(word => fullTextLower.includes(word))) return; 
      if (!CORE_TECH_KEYWORDS.some(word => fullTextLower.includes(word))) return; 

      let pathway = "Software Engineering";
      if (fullTextLower.includes("python") || fullTextLower.includes("sql") || fullTextLower.includes("data")) {
        pathway = "Data Engineering";
      } else if (fullTextLower.includes("javascript") || fullTextLower.includes("react") || fullTextLower.includes("node") || fullTextLower.includes("frontend")) {
        pathway = "Full-Stack";
      } else if (fullTextLower.includes("agile") || fullTextLower.includes("scrum") || fullTextLower.includes("product")) {
        pathway = "Product Management";
      }

      const svKeywords = ["social value", "ppn 06/20", "diversity", "gender", "skills gap", "apprenticeship"];
      const hasHighSv = svKeywords.some(keyword => fullTextLower.includes(keyword));

      if (release.tag?.includes("tender") || awards.length === 0) {
        liveTenders.push({
          id: publicLinkHash,
          buyer,
          title,
          description,
          value: valueDisplay,
          pathway,
          svLeverage: hasHighSv ? "HIGH" : "Standard",
          closingDate: tender.tenderPeriod?.endDate ? new Date(tender.tenderPeriod.endDate).toLocaleDateString('en-GB') : "See Notice"
        });
      } else {
        let suppliers = [];
        let contacts = [];

        awards.forEach(award => {
          (award.suppliers || []).forEach(sup => {
            suppliers.push(sup.name || "Contractor Selected");
            if (sup.contactPoint?.email || sup.contactPoint?.name) {
              contacts.push({
                name: sup.contactPoint.name || "Commercial Representative",
                email: sup.contactPoint.email || "Check Company Domain"
              });
            }
          });
        });

        contractWins.push({
          id: publicLinkHash,
          buyer,
          title,
          description,
          value: valueDisplay,
          pathway,
          suppliers,
          contacts: contacts.length > 0 ? contacts : [{ name: "VP of Delivery", email: "Check Corporate Web Link" }],
          awardDate: awards[0]?.date ? new Date(awards[0].date).toLocaleDateString('en-GB') : "Recent Notice"
        });
      }
    });

    return res.status(200).json({ liveTenders, contractWins });

  } catch (error) {
    return res.status(500).json({ error: "Search failed", details: error.message });
  }
}
