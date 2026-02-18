const axios = require('axios');
const fs = require('fs-extra');

// KONFIGURASI
const BASE_URL = 'http://localhost:3000';
const CATALOG_FILE = 'catalog.json';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function harvestCatalog() {
    console.log("🚜 Mulai Panen Katalog Lengkap...");
    
    let catalog = [];
    let processedIds = new Set();

    // 1. Cek kalau ada file lama, load dulu biar bisa resume
    if (fs.existsSync(CATALOG_FILE)) {
        try {
            catalog = await fs.readJson(CATALOG_FILE);
            catalog.forEach(item => processedIds.add(item.bookId));
            console.log(`📦 Melanjutkan katalog lama: ${catalog.length} buku sudah tersimpan.`);
        } catch (e) {
            console.log("⚠️ File katalog rusak, mulai baru.");
        }
    }

    try {
        // 2. Ambil Daftar Kategori
        console.log("Mengambil daftar kategori...");
        const catRes = await axios.get(`${BASE_URL}/api/categories`);
        
        let categories = [];
        // Deteksi struktur data kategori
        if (Array.isArray(catRes.data.data)) {
            categories = catRes.data.data;
        } else if (catRes.data.data && Array.isArray(catRes.data.data.types)) {
            categories = catRes.data.data.types;
        }

        console.log(`✅ Ditemukan ${categories.length} kategori.`);

        // 3. Loop per Kategori
        for (const cat of categories) {
            const catId = cat.id || cat.categoryId;
            const catName = cat.name || "Unknown";

            console.log(`\n📂 Masuk kategori: ${catName} (ID: ${catId})`);
            
            let page = 1;
            let totalPages = 1; 

            while (page <= totalPages) {
                try {
                    const url = `${BASE_URL}/api/category/${catId}?page=${page}&size=20`;
                    const res = await axios.get(url);
                    const resultData = res.data.data;
                    const bookList = resultData.bookList || [];

                    // Update total page dari info server
                    if (resultData.pages) totalPages = resultData.pages;

                    if (bookList.length === 0) break; // Stop kalau kosong

                    let addedCount = 0;

                    // 4. Proses Data Buku
                    for (const book of bookList) {
                        // Cek Duplikat
                        if (processedIds.has(book.bookId)) continue;

                        // Ambil Data Penting Saja
                        const newItem = {
                            bookId: book.bookId,
                            title: book.bookName || book.title || "No Title",
                            cover: book.cover,
                            desc: book.introduction || "Tidak ada deskripsi",
                            rating: book.ratings || 0,
                            totalEps: book.chapterCount || 0,
                            tags: book.tags || []
                        };

                        catalog.push(newItem);
                        processedIds.add(book.bookId);
                        addedCount++;
                    }

                    if (addedCount > 0) {
                        process.stdout.write(`+${addedCount} `); // Indikator nambah
                        // Simpan setiap kali dapet data baru (aman kalau crash)
                        await fs.writeJson(CATALOG_FILE, catalog, { spaces: 2 });
                    } else {
                        process.stdout.write(`.`); // Indikator lewat (duplikat)
                    }

                    page++;
                    await sleep(500); // Jeda biar sopan

                } catch (e) {
                    console.log(`❌ Error hal ${page}: ${e.message}`);
                    break;
                }
            }
        }

        console.log(`\n\n🎉 SELESAI! Total ${catalog.length} buku tersimpan di ${CATALOG_FILE}`);

    } catch (error) {
        console.error("🔥 Error Fatal:", error.message);
    }
}

harvestCatalog();