const axios = require('axios');
const fs = require('fs-extra');

const BASE_URL = 'http://localhost:3000';
const QUEUE_FILE = 'queue.json';
const CATALOG_FILE = 'catalog.json';

// Fungsi tidur acak (biar dikira manusia)
const randomSleep = (min, max) => {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, ms));
};

async function createCatalog() {
    if (!fs.existsSync(QUEUE_FILE)) return console.log("❌ queue.json gak ada!");
    
    let queue = await fs.readJson(QUEUE_FILE);
    let catalog = [];
    
    // Cek catalog lama
    if (fs.existsSync(CATALOG_FILE)) {
        catalog = await fs.readJson(CATALOG_FILE);
    }
    
    // Set ID yang sudah diproses biar pencarian cepet
    const processedIds = new Set(catalog.map(c => c.bookId));

    console.log(`🥷 Mode Ninja Aktif. Total antrean: ${queue.length - processedIds.size}`);

    let counter = 0;

    for (const bookId of queue) {
        if (processedIds.has(bookId)) continue; 

        try {
            // Konfigurasi Header biar sopan (menyamar jadi browser)
            const config = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            };

            const res = await axios.get(`${BASE_URL}/api/detail/${bookId}/v2`, config);
            const data = res.data.data;

            const item = {
                bookId: bookId,
                title: data.bookName || data.title,
                cover: data.cover, 
                desc: data.introduction,
                rating: data.ratings,
                totalEps: data.chapterCount
            };

            catalog.push(item);
            processedIds.add(bookId); // Tandai sudah diproses
            
            console.log(`✅ [${catalog.length}] Aman: ${item.title}`);
            counter++;

            // Simpan file setiap 5 data (biar kalau crash data aman)
            if (counter % 5 === 0) {
                await fs.writeJson(CATALOG_FILE, catalog, { spaces: 2 });
            }

            // Jeda Acak: 2 detik sampai 5 detik
            await randomSleep(2000, 5000);

        } catch (e) {
            console.log(`❌ Gagal ID ${bookId}: ${e.message}`);
            
            if (e.response && e.response.status === 429) {
                console.log("⚠️ TERDETEKSI! Kena Rate Limit. Istirahat 1 menit...");
                await randomSleep(60000, 65000); // Tidur 1 menit
            } else {
                // Kalau error lain, jeda dikit aja
                await randomSleep(1000, 2000);
            }
        }
    }

    // Simpan final
    await fs.writeJson(CATALOG_FILE, catalog, { spaces: 2 });
    console.log("🎉 Katalog Selesai (Versi Ninja)!");
}

createCatalog();