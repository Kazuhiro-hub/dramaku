const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
// Kita pakai salah satu ID yang pasti ada (dari log debug kamu sebelumnya)
const TEST_ID = '42000006070'; 

async function cekDetailBuku() {
    try {
        console.log(`🕵️ Sedang mengintip detail ID: ${TEST_ID}...`);
        const res = await axios.get(`${BASE_URL}/api/detail/${TEST_ID}/v2`);
        
        console.log("\n--- ISI DATA DETAIL ---");
        // Tampilkan semua isinya biar kita tahu nama field yang benar
        console.log(JSON.stringify(res.data, null, 2));

    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

cekDetailBuku();