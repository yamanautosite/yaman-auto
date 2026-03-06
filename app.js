require('dotenv').config(); 
const express = require('express');
const session = require('express-session');
const app = express();
const path = require('path');
const mongoose = require('mongoose');

// --- DOSYA YÜKLEME MOTORLARI ---
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// --- CLOUDINARY YAPILANDIRMASI ---
cloudinary.config({
    cloud_name: 'djcmmlnz4', 
    api_key: '898543896878648',
    api_secret: 'A3aMt2AQYyOhn7dyO3ZHSHmiV-M' 
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'yaman-auto',
        // KRİTİK GÜNCELLEME: webp formatı izne eklendi
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'], 
    },
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB sınırı (Büyük ilanlar için esnetildi)
}).array('resimler', 15);

// --- ARAÇ MODELİ ---
const aracSchema = new mongoose.Schema({
    marka: String,
    model: String,
    fiyat: String,
    km: String,
    yil: String,
    yakit: String,
    resimler: [String], 
    eklenmeTarihi: { type: Date, default: Date.now }
});
const Arac = mongoose.model('Arac', aracSchema);

// --- GENEL AYARLAR ---
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, "public"))); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'yaman_auto_ozel_anahtar',
    resave: false,
    saveUninitialized: false, 
    cookie: { maxAge: 3600000 }
}));

// --- GÜVENLİK KONTROLÜ ---
const adminKontrol = (req, res, next) => {
    if (req.session.adminGiris) {
        next();
    } else {
        res.redirect('/admin/login');
    }
};

// --- MONGODB BAĞLANTISI ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('🚀 Yaman Auto Kasası Güvenle Bağlandı!'))
    .catch((err) => console.log('❌ Kasa Bağlantı Hatası:', err.message));

// --- FİLTRELEME FONKSİYONU ---
async function filtreleVeGetir(query) {
    let { marka, model, yakit } = query;
    let filtre = {};
    if (marka) filtre.marka = marka;
    if (model) filtre.model = model;
    if (yakit) filtre.yakit = yakit;
    return await Arac.find(filtre).sort({ eklenmeTarihi: -1 });
}

// --- KULLANICI ROTALARI ---
app.get('/', async (req, res) => {
    try {
        const araclar = await filtreleVeGetir(req.query);
        res.render('index', { araclar });
    } catch (err) { res.status(500).send("Sunucu hatası."); }
});

app.get('/satilik-araclar', async (req, res) => {
    try {
        const araclar = await filtreleVeGetir(req.query);
        res.render('satilik-araclar', { araclar });
    } catch (err) { res.status(500).send("Liste yüklenemedi."); }
});

app.get('/arac/:id', async (req, res) => {
    try {
        const arac = await Arac.findById(req.params.id);
        if (arac) res.render('detay', { arac });
        else res.status(404).send("Araç bulunamadı.");
    } catch (err) { res.status(404).send("Geçersiz araç."); }
});

app.get('/hakkimizda', (req, res) => res.render('hakkimizda'));
app.get('/iletisim', (req, res) => res.render('iletisim'));

// --- ADMİN ROTALARI ---
app.get('/admin/login', (req, res) => res.render('login'));

app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "yaman2026") {
        req.session.adminGiris = true;
        res.redirect('/admin/panel');
    } else {
        res.send("<script>alert('Hatalı giriş!'); window.location='/admin/login';</script>");
    }
});

app.get('/admin/panel', adminKontrol, async (req, res) => {
    try {
        const araclar = await Arac.find().sort({ eklenmeTarihi: -1 });
        res.render('admin-panel', { araclar });
    } catch (err) { res.redirect('/admin/login'); }
});

app.get('/admin/ekle', adminKontrol, (req, res) => res.render('admin-ekle'));

// --- İLAN KAYDETME ---
app.post('/admin/ekle', adminKontrol, (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            console.error("YÜKLEME HATASI:", err);
            return res.status(500).send("Fotoğraflar Cloudinary'ye mühürlenemedi: " + err.message);
        }
        try {
            const yeniVeri = { ...req.body };
            if (req.files && req.files.length > 0) {
                yeniVeri.resimler = req.files.map(file => file.path);
            }
            const yeniArac = new Arac(yeniVeri);
            await yeniArac.save();
            res.redirect('/admin/panel');
        } catch (dbErr) {
            console.error("VERİTABANI HATASI:", dbErr);
            res.status(500).send("Veritabanı kaydı başarısız.");
        }
    });
});

app.get('/admin/duzenle/:id', adminKontrol, async (req, res) => {
    try {
        const arac = await Arac.findById(req.params.id);
        res.render('admin-duzenle', { arac });
    } catch (err) { res.redirect('/admin/panel'); }
});

// --- İLAN GÜNCELLEME ---
app.post('/admin/guncelle/:id', adminKontrol, (req, res) => {
    upload(req, res, async (err) => {
        if (err) return res.status(500).send("Güncelleme sırasında yükleme hatası.");
        try {
            let guncelVeri = { ...req.body };
            if (req.files && req.files.length > 0) {
                guncelVeri.resimler = req.files.map(file => file.path);
            }
            await Arac.findByIdAndUpdate(req.params.id, guncelVeri);
            res.redirect('/admin/panel');
        } catch (dbErr) { res.status(500).send("Veritabanı güncelleme hatası."); }
    });
});

app.get('/admin/sil/:id', adminKontrol, async (req, res) => {
    try {
        await Arac.findByIdAndDelete(req.params.id);
        res.redirect('/admin/panel');
    } catch (err) { res.status(500).send("Silme hatası."); }
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Yaman Auto ${PORT} portunda aktif!`));