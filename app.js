require('dotenv').config(); // Gizli .env dosyasını okumak için
const express = require('express');
const session = require('express-session'); // Oturum yönetimi için eklendi
const app = express();
const path = require('path');
const mongoose = require('mongoose');

// --- ARAÇ MODELİ (Sema Tanımı) ---
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

// --- AYARLAR ---
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, "public"))); 
app.use(express.urlencoded({ extended: true }));

// --- 1. OTURUM GÜVENLİĞİ (SESSION) ---
app.use(session({
    secret: 'yaman_auto_ozel_anahtar', // Oturumu şifrelemek için rastgele bir anahtar
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 } // 1 saat sonra otomatik çıkış yapar
}));

// --- 2. KORUMA KALKANI (MIDDLEWARE) ---
// Bu fonksiyon, giriş yapmamış kişileri admin sayfalarından uzak tutar
const adminKontrol = (req, res, next) => {
    if (req.session.adminGiris) {
        next(); // Giriş yapılmışsa devam et
    } else {
        res.redirect('/admin/login'); // Yapılmamışsa giriş sayfasına at
    }
};

// --- 3. MONGODB BAĞLANTISI ---
const dbURI = process.env.MONGODB_URI; 

mongoose.connect(dbURI)
    .then(() => console.log('🚀 Yaman Auto Kasası (MongoDB) Güvenle Bağlandı!'))
    .catch((err) => {
        console.log('❌ Kasa Bağlantı Hatası:', err.message);
    });

// --- 4. FİLTRELEME MANTIĞI ---
async function filtreleVeGetir(query) {
    let { marka, model, yakit } = query;
    let filtre = {};

    if (marka) filtre.marka = marka;
    if (model) filtre.model = model;
    if (yakit) filtre.yakit = yakit;

    return await Arac.find(filtre).sort({ eklenmeTarihi: -1 });
}

// --- 5. KULLANICI ROTALARI (HERKESE AÇIK) ---

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

// --- 6. ADMİN ROTALARI (KORUMALI) ---

// Giriş Sayfası
app.get('/admin/login', (req, res) => res.render('login'));

// Giriş Kontrolü
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "yaman2026") {
        req.session.adminGiris = true; // Oturumu mühürle
        res.redirect('/admin/panel');
    } else {
        res.send("<script>alert('Hatalı giriş!'); window.location='/admin/login';</script>");
    }
});

// Admin Panel Ana Sayfa (Koruma Altında)
app.get('/admin/panel', adminKontrol, async (req, res) => {
    try {
        const araclar = await Arac.find().sort({ eklenmeTarihi: -1 });
        res.render('admin-panel', { araclar: araclar });
    } catch (err) {
        res.redirect('/admin/login');
    }
});

// İlan Ekleme Sayfası (Koruma Altında)
app.get('/admin/ekle', adminKontrol, (req, res) => res.render('admin-ekle'));

// İlan Kaydetme (Koruma Altında)
app.post('/admin/ekle', adminKontrol, async (req, res) => {
    try {
        const yeniArac = new Arac(req.body);
        await yeniArac.save();
        res.redirect('/admin/panel');
    } catch (err) {
        res.send("Kayıt hatası: " + err.message);
    }
});

// İlan Silme (Koruma Altında)
app.get('/admin/sil/:id', adminKontrol, async (req, res) => {
    try {
        await Arac.findByIdAndDelete(req.params.id);
        res.redirect('/admin/panel');
    } catch (err) {
        res.status(500).send("Silme işlemi başarısız.");
    }
});

// Güvenli Çıkış
app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- 7. PORT AYARI ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Yaman Auto ${PORT} portunda koruma altında!`));