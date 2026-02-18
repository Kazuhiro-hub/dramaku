const axios = require('axios');
const fs = require('fs-extra');

// KONFIGURASI
const BASE_URL = 'http://localhost:3000'; 
const QUEUE_FILE = 'queue.json';

// Fungsi tidur (Jeda)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function harvestBookIds() {
    console.log("🚜 Mulai memanen Book ID (Revisi v2)...");
    let bookIds = new Set();

    // Load queue lama kalau ada
    if (fs.existsSync(QUEUE_FILE)) {
        const existing = await fs.readJson(QUEUE_FILE);
        existing.forEach(id => bookIds.add(id));
        console.log(`📦 Melanjutkan antrean lama: ${bookIds.size} buku sudah ada.`);
    }

    try {
        // 1. Ambil Kategori Dulu
        console.log("Mengambil daftar kategori...");
        const catRes = await axios.get(`${BASE_URL}/api/categories`);
        
        // PENTING: Kadang kategori ada di data.data atau data.data.types
        // Kita jaga-jaga cek dua-duanya
        let categories = [];
        if (Array.isArray(catRes.data.data)) {
            categories = catRes.data.data;
        } else if (catRes.data.data && Array.isArray(catRes.data.data.types)) {
            categories = catRes.data.data.types;
        } else {
            console.error("❌ Gagal membaca struktur kategori!");
            console.log(catRes.data);
            return;
        }

        console.log(`✅ Ditemukan ${categories.length} kategori.`);

        // 2. Loop per Kategori
        for (const cat of categories) {
            const catId = cat.id || cat.categoryId;
            const catName = cat.name || "Unknown";

            console.log(`\n📂 Masuk kategori: ${catName} (ID: ${catId})`);
            
            let page = 1;
            let totalPages = 1; // Default 1 dulu sebelum tau aslinya

            // Loop Halaman
            while (page <= totalPages) {
                try {
                    // Request Data
                    const url = `${BASE_URL}/api/category/${catId}?page=${page}&size=20`;
                    const res = await axios.get(url);
                    
                    // --- PERBAIKAN UTAMA DISINI ---
                    const resultData = res.data.data;
                    const bookList = resultData.bookList || [];
                    
                    // Update total halaman dari info server (biar akurat)
                    if (resultData.pages) {
                        totalPages = resultData.pages;
                    }
                    
                    if (bookList.length > 0) {
                        bookList.forEach(b => {
                            // Kadang bookId itu string, kita simpan apa adanya
                            if (b.bookId) bookIds.add(b.bookId);
                        });
                        
                        process.stdout.write(`.`); // Titik progress
                    } else {
                        // Kalau kosong, berarti habis (walaupun totalPages bilang masih ada)
                        break;
                    }

                    page++;
                    await sleep(800); // Jeda aman

                } catch (e) {
                    console.log(`❌ Error di hal ${page}: ${e.message}`);
                    break; // Kalau error mending skip kategori ini biar gak macet
                }
            }
        }

        // 3. Simpan Hasil Akhir
        const finalQueue = Array.from(bookIds);
        await fs.writeJson(QUEUE_FILE, finalQueue, { spaces: 2 });
        console.log(`\n\n✅ PANEN SELESAI! Total ${finalQueue.length} buku unik tersimpan di ${QUEUE_FILE}`);

    } catch (error) {
        console.error("🔥 Error Fatal:", error.message);
    }
}

harvestBookIds();