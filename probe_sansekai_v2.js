const axios = require('axios');

const BASE_URL = 'https://api.sansekai.my.id';
// Kita sudah tau ID-nya dari log sebelumnya, jadi langsung tembak aja!
const TARGET_ID = '42000006070'; 
const TARGET_JUDUL = 'Setelah Cerai, Tiga Kakakku Manjakan Aku';

async function probeEpisode() {
    try {
        console.log(`🕵️ MENGUJI KESAKTIAN API SANSEKAI...`);
        console.log(`   Target: ${TARGET_JUDUL} (ID: ${TARGET_ID})`);

        // Tembak Endpoint "All Episode"
        const url = `${BASE_URL}/api/dramabox/allepisode?bookId=${TARGET_ID}&lang=in`;
        console.log(`   GET ${url}`);

        const res = await axios.get(url);
        const data = res.data;

        // Cek apakah hasilnya Array atau Object
        let episodes = [];
        if (Array.isArray(data)) {
            episodes = data;
        } else if (data.result && Array.isArray(data.result)) {
            episodes = data.result;
        } else if (data.data && Array.isArray(data.data)) {
            episodes = data.data;
        }

        if (episodes.length > 0) {
            console.log(`\n🎉 HASIL: Ditemukan ${episodes.length} Episode!`);
            
            // Cek detail episode terakhir (apakah ada link videonya?)
            const lastEp = episodes[episodes.length - 1];
            console.log("\n--- BEDAH EPISODE TERAKHIR ---");
            console.log(JSON.stringify(lastEp, null, 2));

            // KESIMPULAN
            if (episodes.length > 6) {
                console.log("\n🚀 KESIMPULAN: JACKPOT!! API INI TEMBUS LIMIT 6 EPISODE!");
                console.log("   (Segera kabari saya biar kita update index.html)");
            } else {
                console.log("\n⚠️ KESIMPULAN: Yah... masih kena limit 6 episode juga.");
            }
        } else {
            console.log("\n❌ Gagal: Respon kosong atau struktur beda.");
            console.log("Raw Data:", JSON.stringify(data).substring(0, 200) + "...");
        }

    } catch (error) {
        console.error("🔥 Error Koneksi:", error.message);
        if(error.response) {
            console.log("Status:", error.response.status);
            console.log("Data:", JSON.stringify(error.response.data));
        }
    }
}

probeEpisode();