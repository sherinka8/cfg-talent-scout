// api/scout.js - Vercel Serverless Function
export default async function handler(req, res) {
  // Official UK Government API endpoint format for daily release feeds
  const GOV_API_URL = "https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search";
  
  const searchPayload = {
    cpvCodes: ["72000000"], // IT Services, Software, Data and Systems consulting
    pageSize: 30,
    page: 1
  };

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
      const value = tender.value?.amount ? `£${tender.value.amount.toLocaleString()}` : "Value inside Document logs";
      
      let pathway = "Software Engineering";
      const descLower = description.toLowerCase();
      if (descLower.includes("python") || descLower.includes("sql") || descLower.includes("data")) {
        pathway = "Data Engineering";
      } else if (descLower.includes("javascript") || descLower.includes("react") || descLower.includes("node")) {
        pathway = "Full-Stack";
      } else if (descLower.includes("agile") || descLower.includes("scrum") || descLower.includes("product")) {
        pathway = "Product Management";
      }

      const svKeywords = ["social value", "ppn 06/20", "diversity", "gender", "skills gap", "apprenticeship"];
      const hasHighSv = svKeywords.some(keyword => descLower.includes(keyword));

      if (release.tag?.includes("tender") || awards.length === 0) {
        liveTenders.push({
          id: release.ocid,
          buyer,
          title,
          description,
          value,
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
          value,
          pathway,
          suppliers,
          contacts: contacts.length > 0 ? contacts : [{ name: "VP of Delivery / Resource Manager", email: "Check Corporate Web Link" }],
          awardDate: awards[0]?.date ? new Date(awards[0].date).toLocaleDateString('en-GB') : "Recent Notice"
        });
      }
    });

    // Set standard cache control headers to make Vercel servers fly
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    return res.status(200).json({ liveTenders, contractWins });

  } catch (error) {
    return res.status(500).json({ error: "Search failed", details: error.message });
  }
}
