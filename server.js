const express = require('express');
const ejs = require('ejs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production-12345';
const DATA_FILE = path.join(__dirname, 'data', 'devices.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const ADMIN_EMAIL = 'admin@devicecompare.com';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('admin123', 10);

let devicesData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

fs.watchFile(DATA_FILE, () => {
  try {
    devicesData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Error reloading devices data:', e);
  }
});

const authMiddleware = (req, res, next) => {
  const token = req.cookies.adminToken || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ===== PUBLIC ROUTES =====

app.get('/', (req, res) => {
  res.render('home', {
    categories: devicesData.categories,
    devices: devicesData.devices,
    featured: devicesData.devices.filter(d => d.rating >= 4.6).slice(0, 6)
  });
});

app.get('/category/:name', (req, res) => {
  const cat = decodeURIComponent(req.params.name);
  const filtered = devicesData.devices.filter(d => d.category.toLowerCase() === cat.toLowerCase());
  res.render('category', {
    category: cat,
    devices: filtered,
    categories: devicesData.categories
  });
});

app.get('/products', (req, res) => {
  const { category, brand, search, sort } = req.query;
  let filtered = [...devicesData.devices];

  if (category && category !== 'all') {
    filtered = filtered.filter(d => d.category.toLowerCase() === category.toLowerCase());
  }
  if (brand) {
    filtered = filtered.filter(d => d.brand.toLowerCase() === brand.toLowerCase());
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(d =>
      d.name.toLowerCase().includes(s) ||
      d.brand.toLowerCase().includes(s) ||
      d.category.toLowerCase().includes(s)
    );
  }
  if (sort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') filtered.sort((a, b) => b.price - a.price);
  else if (sort === 'rating') filtered.sort((a, b) => b.rating - a.rating);
  else if (sort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));

  const brands = [...new Set(devicesData.devices.map(d => d.brand))];

  res.render('products', {
    devices: filtered,
    categories: devicesData.categories,
    brands,
    filters: { category, brand, search, sort }
  });
});

app.get('/device/:id', (req, res) => {
  const device = devicesData.devices.find(d => d.id === parseInt(req.params.id));
  if (!device) return res.status(404).render('404');
  res.render('device', { device, categories: devicesData.categories });
});

app.get('/compare', (req, res) => {
  const ids = req.query.ids ? req.query.ids.split(',').map(Number).filter(Boolean) : [];
  if (ids.length < 2 || ids.length > 4) {
    res.render('compare', {
      devices: [],
      categories: devicesData.categories,
      error: 'Select 2-4 devices to compare'
    });
    return;
  }
  const devices = ids.map(id => devicesData.devices.find(d => d.id === id)).filter(Boolean);
  if (devices.length < 2) {
    res.render('compare', { devices: [], categories: devicesData.categories, error: 'Invalid device selection' });
    return;
  }
  res.render('compare', { devices, categories: devicesData.categories, error: null });
});

app.get('/api/devices', (req, res) => {
  const { category, search } = req.query;
  let filtered = devicesData.devices;
  if (category && category !== 'all') filtered = filtered.filter(d => d.category.toLowerCase() === category.toLowerCase());
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(d => d.name.toLowerCase().includes(s) || d.brand.toLowerCase().includes(s));
  }
  res.json(filtered);
});

app.get('/api/compare/:id1/:id2', (req, res) => {
  const id1 = parseInt(req.params.id1);
  const id2 = parseInt(req.params.id2);
  const d1 = devicesData.devices.find(d => d.id === id1);
  const d2 = devicesData.devices.find(d => d.id === id2);
  if (!d1 || !d2) return res.status(404).json({ error: 'Device not found' });
  res.json({ device1: d1, device2: d2 });
});

app.get('/api/categories', (req, res) => {
  res.json(devicesData.categories);
});

app.get('/404', (req, res) => {
  res.status(404).render('404', { categories: devicesData.categories });
});

app.use((req, res) => {
  res.status(404).render('404', { categories: devicesData.categories });
});

// ===== HIDDEN ADMIN ROUTES =====

// The admin login is at /sys-login-7a9f2b (hard to guess/accidentally find)
app.get('/sys-login-7a9f2b', (req, res) => {
  if (req.cookies.adminToken) {
    return res.redirect('/sys-panel-8x3k1');
  }
  res.render('admin-login', { error: null, categories: [] });
});

app.post('/sys-login-7a9f2b', async (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    const token = jwt.sign({ email, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
    res.cookie('adminToken', token, { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 });
    return res.redirect('/sys-panel-8x3k1');
  }
  res.render('admin-login', { error: 'Invalid credentials', categories: [] });
});

app.get('/sys-panel-8x3k1', authMiddleware, (req, res) => {
  res.render('admin-panel', {
    devices: devicesData.devices,
    categories: devicesData.categories,
    categories: devicesData.categories,
    user: req.user
  });
});

app.get('/sys-panel-8x3k1/add', authMiddleware, (req, res) => {
  res.render('admin-edit', {
    device: null,
    categories: devicesData.categories,
    user: req.user
  });
});

app.get('/sys-panel-8x3k1/edit/:id', authMiddleware, (req, res) => {
  const device = devicesData.devices.find(d => d.id === parseInt(req.params.id));
  if (!device) return res.status(404).send('Device not found');
  res.render('admin-edit', { device, categories: devicesData.categories, user: req.user });
});

app.post('/sys-panel-8x3k1/add', authMiddleware, (req, res) => {
  try {
    const data = req.body;
    const newId = Math.max(...devicesData.devices.map(d => d.id)) + 1;
    const device = {
      id: newId,
      category: data.category,
      name: data.name,
      brand: data.brand,
      price: parseFloat(data.price),
      image: data.image || '',
      specs: JSON.parse(data.specs || '{}'),
      rating: parseFloat(data.rating) || 4.0,
      availability: data.availability === 'true'
    };
    devicesData.devices.push(device);
    fs.writeFileSync(DATA_FILE, JSON.stringify(devicesData, null, 2));
    res.redirect('/sys-panel-8x3k1');
  } catch (err) {
    res.status(400).send('Error: ' + err.message);
  }
});

app.post('/sys-panel-8x3k1/edit/:id', authMiddleware, (req, res) => {
  try {
    const data = req.body;
    const idx = devicesData.devices.findIndex(d => d.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).send('Device not found');
    devicesData.devices[idx] = {
      ...devicesData.devices[idx],
      category: data.category,
      name: data.name,
      brand: data.brand,
      price: parseFloat(data.price),
      image: data.image || '',
      specs: JSON.parse(data.specs || '{}'),
      rating: parseFloat(data.rating) || 4.0,
      availability: data.availability === 'true'
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(devicesData, null, 2));
    res.redirect('/sys-panel-8x3k1');
  } catch (err) {
    res.status(400).send('Error: ' + err.message);
  }
});

app.post('/sys-panel-8x3k1/delete/:id', authMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  devicesData.devices = devicesData.devices.filter(d => d.id !== id);
  fs.writeFileSync(DATA_FILE, JSON.stringify(devicesData, null, 2));
  res.redirect('/sys-panel-8x3k1');
});

app.post('/sys-panel-8x3k1/logout', (req, res) => {
  res.clearCookie('adminToken');
  res.redirect('/');
});

// Show admin URL hint in console
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    // Allow viewing console hint
  }
  next();
});

app.listen(PORT, () => {
  console.log(`\n🚀 Device Compare running at http://localhost:${PORT}`);
  console.log(`\n🔒 Admin panel: /sys-login-7a9f2b`);
  console.log(`   Default credentials: ${ADMIN_EMAIL} / admin123\n`);
});