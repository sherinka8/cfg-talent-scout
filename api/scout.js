// api/scout.js - High-Value Core Tech Filtered Vercel Serverless Function
export default async function handler(req, res) {
  // Official UK Government API endpoint for open OCDS datasets
  const GOV_API_URL = "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search";
  
  const searchPayload = {
    cpvCodes: ["72000000"], // Broad IT & Digital Systems Category
    pageSize: 80, // High page size count to filter out garbage records safely
    page: 1
  };

  // 💷 MINIMUM CONTRACT VALUE: Set to £150,000 to drop small administrative contracts instantly
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
      
      // Extract numeric value from payload data
      const numericValue = tender.value?.amount || 0;
      const valueDisplay = numericValue > 0 ? `£${numericValue.toLocaleString()}` : "Value inside Document logs";
      
      const fullTextLower = `${title} ${description}`.toLowerCase();

      // FILTER 1: Financial Threshold Check (Skip everything under £150k)
      if (numericValue > 0 && numericValue < MINIMUM_VALUE_THRESHOLD) return;

      // FILTER 2: Text Exclusion Check (Skip explicit voucher/canteen junk)
      const containsCrap = CRAP_EXCLUSION_KEYWORDS.some(word => fullTextLower.includes(word));
      if (containsCrap) return; 

      // FILTER 3: Core Engineering Match Check
      const isRealTechContract = CORE_TECH_KEYWORDS.some(word => fullTextLower.includes(word));
      if (!isRealTechContract) return; 

      // If it passes all 3 validation filters, classify into Code First Girls paths
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
          id: release.ocid,
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
          id: release.ocid,
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
