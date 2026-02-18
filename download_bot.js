const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const sanitize = require('sanitize-filename');

// KONFIGURASI
const BASE_URL = 'http://localhost:3000';
const QUEUE_FILE = 'queue.json';
const HISTORY_FILE = 'history.json'; // Database download yg sukses
const OUTPUT_DIR = 'D:\\dramabox-web'; // Sesuai request

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fungsi pembungkus FFmpeg pakai Promise
function downloadWithFFmpeg(url, outputPath) {
    return new Promise((resolve, reject) => {
        // Command FFmpeg standard untuk download HLS/m3u8 ke MP4
        const cmd = `ffmpeg -i "${url}" -c copy -bsf:a aac_adtstoasc "${outputPath}" -y`;
        
        console.log(`   🎬 Executing FFmpeg...`);
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(true);
            }
        });
    });
}

async function startDownload() {
    // 1. Persiapan File
    if (!fs.existsSync(QUEUE_FILE)) {
        return console.log("❌ File queue.json tidak ditemukan. Jalankan script panen dulu!");
    }
    
    let queue = await fs.readJson(QUEUE_FILE);
    let history = fs.existsSync(HISTORY_FILE) ? await fs.readJson(HISTORY_FILE) : [];
    
    // Set history biar pencarian cepat
    let historySet = new Set(history);

    console.log(`🚀 Memulai Download. Antrean: ${queue.length}, Selesai: ${historySet.size}`);

    // 2. Loop Utama per Buku
    for (const bookId of queue) {
        if (historySet.has(bookId)) {
            console.log(`⏭️  Book ID ${bookId} sudah pernah didownload. Skip.`);
            continue;
        }

        try {
            // A. Ambil Detail Buku (Untuk Judul)
            const detailRes = await axios.get(`${BASE_URL}/api/detail/${bookId}/v2`);
            const rawTitle = detailRes.data.data.title || `Unknown_Drama_${bookId}`;
            const cleanTitle = sanitize(rawTitle); // Bersihkan karakter ilegal Windows

            // B. Buat Folder
            const bookFolder = path.join(OUTPUT_DIR, cleanTitle, 'Episode');
            await fs.ensureDir(bookFolder);
            console.log(`\n📘 Memproses: ${cleanTitle} (ID: ${bookId})`);

            // C. Ambil List Episode
            const chapterRes = await axios.get(`${BASE_URL}/api/chapters/${bookId}`);
            const chapters = chapterRes.data.data || [];

            console.log(`   ditemukan ${chapters.length} episode.`);

            // D. Loop per Episode
            for (const chap of chapters) {
                const epNum = chap.chapterNo || chap.id; // Sesuaikan field API
                const fileName = `Ep_${epNum}.mp4`;
                const filePath = path.join(bookFolder, fileName);

                if (fs.existsSync(filePath)) {
                    console.log(`   ✅ Ep ${epNum} sudah ada. Skip.`);
                    continue;
                }

                // Ambil Stream URL
                try {
                    const streamRes = await axios.get(`${BASE_URL}/api/stream?bookId=${bookId}&episode=${epNum}`);
                    const streamUrl = streamRes.data.data.url; // Asumsi struktur return URL

                    if (streamUrl) {
                        await downloadWithFFmpeg(streamUrl, filePath);
                        console.log(`   ✅ Ep ${epNum} Download Sukses!`);
                    } else {
                        console.log(`   ⚠️ Ep ${epNum} URL kosong.`);
                    }
                    
                    // Jeda dikit biar napas
                    await sleep(1000); 

                } catch (errStream) {
                    console.log(`   ❌ Gagal Ep ${epNum}: ${errStream.message}`);
                }
            }

            // E. Tandai Selesai di History
            history.push(bookId);
            await fs.writeJson(HISTORY_FILE, history);
            console.log(`💾 ${cleanTitle} selesai diproses. History disimpan.`);

        } catch (errBook) {
            console.error(`❌ Gagal memproses Buku ID ${bookId}:`, errBook.message);
        }
        
        // Istirahat antar buku
        await sleep(2000);
    }
}

startDownload();