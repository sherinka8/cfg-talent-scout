// api/scout.js - Master Filtering, Date Targeting, and Direct Reference Link Engine
export default async function handler(req, res) {
  // Official UK Government API endpoint for searching Open Contracting Data Standard notices
  const GOV_API_URL = "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search";
  
  // 📅 BOUNDARY LOCK: Set boundaries targeting exclusively 2025 and 2026 pipelines
  const startDate = new Date("2025-01-01T00:00:00Z");
  const endDate = new Date(); // Captures up to the current date in 2026

  const formatDateForGov = (dateObj) => dateObj.toISOString().split('T')[0] + "T00:00:00";

  const searchPayload = {
    cpvCodes: ["72000000"], // Broad IT, Software, Systems and Data Consulting Category
    publishedFrom: formatDateForGov(startDate), 
    publishedTo: formatDateForGov(endDate),
    pageSize: 100, // Pulls a massive block payload to ensure filtration returns a robust dashboard
    page: 1
  };

  // 💷 MINIMUM CONTRACT VALUE: Discard administrative noise under £150k
  const MINIMUM_VALUE_THRESHOLD = 150000;

  // ❌ TEXT EXCLUSION LIST: Drops common umbrella keyword clutter instantly
  const CRAP_EXCLUSION_KEYWORDS = [
    "eyecare", "eye care", "voucher", "optician", "benefits platform", "cycle to work", 
    "catering", "canteen", "security guard", "cleaning", "uniform", "furniture", 
    "occupational health", "medical check", "gym membership", "translation", "courier"
  ];

  // 🎯 CORE TECH KEYWORDS: The contract text must mention at least one core engineering deliverable
  const CORE_TECH_KEYWORDS = [
    "software", "developer", "engineer", "data", "cloud", "migration", "application", 
    "react", "javascript", "python", "sql", "aws", "azure", "devops", "cyber", 
    "scrum", "agile", "product manager", "qa", "testing", "automation", "full-stack", "frontend"
  ];

  try {
    const apiResponse = await fetch(GOV_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchPayload)
    });

    if (!apiResponse.ok) {
      throw new Error(`Failed network request: ${apiResponse.status}`);
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
      
      // Grab notice identity hash needed to frame external URLs
      const noticeId = release.id || release.ocid || "";
      
      const numericValue = tender.value?.amount || 0;
      const valueDisplay = numericValue > 0 ? `£${numericValue.toLocaleString()}` : "Value inside Document logs";
      
      const fullTextLower = `${title} ${description}`.toLowerCase();

      // FILTER 1: Financial Threshold Check (Skip small-value updates)
      if (numericValue > 0 && numericValue < MINIMUM_VALUE_THRESHOLD) return;

      // FILTER 2: Text Exclusion Check (Skip explicit voucher/canteen junk)
      const containsCrap = CRAP_EXCLUSION_KEYWORDS.some(word => fullTextLower.includes(word));
      if (containsCrap) return; 

      // FILTER 3: Engineering Match Check
      const isRealTechContract = CORE_TECH_KEYWORDS.some(word => fullTextLower.includes(word));
      if (!isRealTechContract) return; 

      // If it passes all validation criteria, sort into Code First Girls track paths
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
          id: noticeId,
          buyer,
          title,
          description,
          value: valueDisplay,
          pathway,
          svLeverage: hasHighSv ? "HIGH" : "Standard",
          closingDate: tender.tenderPeriod?.endDate ? new Date(tender.tenderPeriod.endDate).toLocaleDateString('en-GB') : "See Document Packet"
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
          id: noticeId,
          buyer,
          title,
          description,
          value: valueDisplay,
          pathway,
          suppliers,
          contacts: contacts.length > 0 ? contacts : [{ name: "VP of Delivery / Resource Manager", email: "Check Corporate Web Link" }],
          awardDate: awards[0]?.date ? new Date(awards[0].date).toLocaleDateString('en-GB') : "Recent Notice"
        });
      }
    });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    return res.status(200).json({ liveTenders, contractWins });

  } catch (error) {
    return res.status(500).json({ error: "Search failed", details: error.message });
  }
}
