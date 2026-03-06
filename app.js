require('dotenv').config(); // Gizli .env dosyasını okumak için
const express = require('express');
const session = require('express-session'); // Oturum yönetimi için eklendi
const app = express();
const path = require('path');
const mongoose = require('mongoose');

// --- YENİ EKLENEN DOSYA YÜKLEME KÜTÜPHANELERİ ---
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// --- CLOUDINARY AYARLARI (Senin Bilgilerinle Mühürlendi) ---
cloudinary.config({
  cloud_name: 'djcmmlnz4', 
  api_key: '898543896878648',
  api_secret: 'BURAYA_GIZLI_SECRET_ANAHTARINI_YAZ' // <--- Mavi butondan aldığın secret'ı buraya yapıştır!
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'yaman-auto',
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
});
const upload = multer({ storage: storage }).array('resimler', 15);

// --- ARAÇ MODELİ (15 Fotoğraf İçin Diziye Çevrildi) ---
const aracSchema = new mongoose.Schema({
    marka: String,
    model: String,
    fiyat: String,
    km: String,
    yil: String,
    yakit: String,
    resimler: [String], // Sadece burası dizi (array) olarak güncellendi
    eklenmeTarihi: { type: Date, default: Date.now }
});
const Arac = mongoose.model('Arac', aracSchema);

// --- AYARLAR ---
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, "public"))); 
app.use(express.urlencoded({ extended: true }));

// --- 1. OTURUM GÜVENLİĞİ (SESSION) ---
app.use(session({
    secret: 'yaman_auto_ozel_anahtar',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 }
}));

// --- 2. KORUMA KALKANI (MIDDLEWARE) ---
const adminKontrol = (req, res, next) => {
    if (req.session.adminGiris) {
        next();
    } else {
        res.redirect('/admin/login');
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
        res.status(500).send("Sistem şu an meşgul.");
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
        res.render('admin-panel', { araclar: araclar });
    } catch (err) {
        res.redirect('/admin/login');
    }
});

app.get('/admin/ekle', adminKontrol, (req, res) => res.render('admin-ekle'));

// --- İLAN KAYDETME (Cloudinary Entegrasyonlu) ---
app.post('/admin/ekle', adminKontrol, upload, async (req, res) => {
    try {
        const yeniVeri = req.body;
        if (req.files) {
            yeniVeri.resimler = req.files.map(file => file.path);
        }
        const yeniArac = new Arac(yeniVeri);
        await yeniArac.save();
        res.redirect('/admin/panel');
    } catch (err) {
        res.send("Kayıt hatası: " + err.message);
    }
});

// --- İLAN DÜZENLEME SAYFASI ---
app.get('/admin/duzenle/:id', adminKontrol, async (req, res) => {
    try {
        const arac = await Arac.findById(req.params.id);
        res.render('admin-duzenle', { arac: arac });
    } catch (err) {
        res.redirect('/admin/panel');
    }
});

// --- İLAN GÜNCELLEME (Cloudinary Entegrasyonlu) ---
app.post('/admin/guncelle/:id', adminKontrol, upload, async (req, res) => {
    try {
        let guncelVeri = req.body;
        if (req.files && req.files.length > 0) {
            guncelVeri.resimler = req.files.map(file => file.path);
        }
        await Arac.findByIdAndUpdate(req.params.id, guncelVeri);
        res.redirect('/admin/panel');
    } catch (err) {
        res.send("Güncelleme hatası.");
    }
});

app.get('/admin/sil/:id', adminKontrol, async (req, res) => {
    try {
        await Arac.findByIdAndDelete(req.params.id);
        res.redirect('/admin/panel');
    } catch (err) {
        res.status(500).send("Silme işlemi başarısız.");
    }
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- 7. PORT AYARI ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Yaman Auto ${PORT} portunda aktif!`));