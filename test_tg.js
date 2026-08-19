require('dotenv').config();

async function checkLinks() {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
        console.log("--- Vercel Blob Links (cms_telegram_links.json) ---");
        const { get } = require('@vercel/blob');
        try {
            const res = await get('cms_telegram_links.json');
            const data = await res.json();
            console.log(JSON.stringify(data, null, 2));
        } catch (e) {
            console.error("Blob error:", e.message);
        }

        console.log("--- Vercel Blob Complaints (cms_complaints.json) ---");
        try {
            const res2 = await get('cms_complaints.json');
            const data2 = await res2.json();
            // find a recent complaint to see its respondent_phone
            const lastComplaints = data2.filter(c => c.respondent_phone).slice(-5).map(c => ({
                id: c.id,
                case_number: c.case_number,
                respondent_phone: c.respondent_phone
            }));
            console.log("Last 5 Complaints with respondent_phone:", JSON.stringify(lastComplaints, null, 2));
        } catch (e) {
            console.error("Complaints Blob error:", e.message);
        }
    } else {
        console.log("No BLOB_READ_WRITE_TOKEN configured in local environment.");
    }
}

checkLinks().catch(console.error).finally(() => process.exit(0));
