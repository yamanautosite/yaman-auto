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
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
});
const upload = multer({ storage: storage }).array('resimler', 15);

// --- ARAÇ MODELİ (Mühürlü Şema) ---
const aracSchema = new mongoose.Schema({
    marka: String,
    model: String,
    fiyat: String,
    km: String,
    yil: String,
    yakit: String,
    resimler: [String], // Çoklu fotoğraf listesi
    eklenmeTarihi: { type: Date, default: Date.now }
});
const Arac = mongoose.model('Arac', aracSchema);

// --- GENEL AYARLAR ---
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, "public"))); 
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'yaman_auto_ozel_anahtar',
    resave: false,
    saveUninitialized: true,
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

// --- İLAN KAYDETME (KRİTİK GÜNCELLEME) ---
app.post('/admin/ekle', adminKontrol, upload, async (req, res) => {
    try {
        const yeniVeri = { ...req.body };
        if (req.files && req.files.length > 0) {
            yeniVeri.resimler = req.files.map(file => file.path);
        }
        const yeniArac = new Arac(yeniVeri);
        await yeniArac.save();
        res.redirect('/admin/panel');
    } catch (err) {
        console.error("MÜHÜRLEME HATASI:", err); // Hatanın nedenini terminale basar
        res.status(500).send("Kayıt sırasında hata oluştu: " + err.message);
    }
});

app.get('/admin/duzenle/:id', adminKontrol, async (req, res) => {
    try {
        const arac = await Arac.findById(req.params.id);
        res.render('admin-duzenle', { arac });
    } catch (err) { res.redirect('/admin/panel'); }
});

app.post('/admin/guncelle/:id', adminKontrol, upload, async (req, res) => {
    try {
        let guncelVeri = { ...req.body };
        if (req.files && req.files.length > 0) {
            guncelVeri.resimler = req.files.map(file => file.path);
        }
        await Arac.findByIdAndUpdate(req.params.id, guncelVeri);
        res.redirect('/admin/panel');
    } catch (err) { res.status(500).send("Güncelleme hatası."); }
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