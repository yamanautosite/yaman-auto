require('dotenv').config(); // Gizli .env dosyasını okumak için en üste ekledik
const express = require('express');
const app = express();
const path = require('path');
const mongoose = require('mongoose');

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, "public"))); 
app.use(express.urlencoded({ extended: true }));

// --- 1. MONGODB BAĞLANTISI (GÜVENLİ MÜHÜR) ---
// Şifreyi sildik, artık process.env üzerinden gizlice okuyoruz
const dbURI = process.env.MONGODB_URI; 

mongoose.connect(dbURI)
    .then(() => console.log('🚀 Yaman Auto Kasası (MongoDB) Güvenle Bağlandı!'))
    .catch((err) => {
        console.log('❌ Kasa Bağlantı Hatası:', err.message);
    });

// --- 2. ARAÇ ŞABLONU (MODEL) ---
const aracSchema = new mongoose.Schema({
    marka: String,
    model: String,
    fiyat: String,
    km: String,
    yil: String,
    yakit: String,
    resim: String,
    eklenmeTarihi: { type: Date, default: Date.now }
});

const Arac = mongoose.model('Arac', aracSchema);

// --- 3. FİLTRELEME MANTIĞI ---
async function filtreleVeGetir(query) {
    let { marka, model, yakit } = query;
    let filtre = {};

    if (marka) filtre.marka = marka;
    if (model) filtre.model = model;
    if (yakit) filtre.yakit = yakit;

    return await Arac.find(filtre).sort({ eklenmeTarihi: -1 });
}

// --- 4. KULLANICI ROTALARI ---

app.get('/', async (req, res) => {
    try {
        const araclar = await filtreleVeGetir(req.query);
        res.render('index', { araclar: araclar });
    } catch (err) {
        res.status(500).send("Sistem şu an meşgul, lütfen az sonra tekrar deneyin.");
    }
});

app.get('/satilik-araclar', async (req, res) => {
    try {
        const araclar = await filtreleVeGetir(req.query);
        res.render('satilik-araclar', { araclar: araclar });
    } catch (err) {
        res.status(500).send("Araçlar listelenemedi.");
    }
});

app.get('/arac/:id', async (req, res) => {
    try {
        const arac = await Arac.findById(req.params.id);
        if (arac) res.render('detay', { arac: arac });
        else res.status(404).send("Araç bulunamadı.");
    } catch (err) {
        res.status(404).send("Geçersiz araç kimliği.");
    }
});

app.get('/hakkimizda', (req, res) => res.render('hakkimizda'));
app.get('/iletisim', (req, res) => res.render('iletisim'));

// --- 5. ADMİN PANELİ ROTALARI ---

app.get('/admin/login', (req, res) => res.render('login'));

app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "yaman2026") {
        res.redirect('/admin/panel');
    } else {
        res.send("<script>alert('Hatalı giriş!'); window.location='/admin/login';</script>");
    }
});

app.get('/admin/panel', async (req, res) => {
    try {
        const araclar = await Arac.find().sort({ eklenmeTarihi: -1 });
        res.render('admin-panel', { araclar: araclar });
    } catch (err) {
        res.redirect('/admin/login');
    }
});

app.get('/admin/ekle', (req, res) => res.render('admin-ekle'));

app.post('/admin/ekle', async (req, res) => {
    try {
        const yeniArac = new Arac(req.body);
        await yeniArac.save();
        res.redirect('/admin/panel');
    } catch (err) {
        res.send("Kayıt hatası: " + err.message);
    }
});

app.get('/admin/sil/:id', async (req, res) => {
    try {
        await Arac.findByIdAndDelete(req.params.id);
        res.redirect('/admin/panel');
    } catch (err) {
        res.status(500).send("Silme işlemi başarısız.");
    }
});

// --- 6. PORT AYARI (RENDER İÇİN ÖNEMLİ) ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Yaman Auto ${PORT} portunda yayında!`));