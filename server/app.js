// server/app.js
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();
const User = require('./models/user'); 
const Book = require('./models/Book');
const bcrypt = require('bcryptjs');  // For password hashing
const session = require('express-session');

const multer = require('multer');
const {storage} = require('./config/cloudinary');
const upload= multer({storage});

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));  // To parse form data
app.use(express.json());                          // To parse JSON data
app.use(express.static('public'));

// Set EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: true
}));

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}



// Simple test route
app.get('/', (req, res) => {
  res.render('home.ejs');
});

// Signup page (GET)
app.get('/signup', (req, res) => {
  res.render('signup.ejs',{error: null});
});

// Signup form submit (POST)
app.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('signup.ejs',{error: '❌ User already exists! Try logging in.'});
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Save new user
    const newUser = new User({ name, email, passwordHash });
    await newUser.save();

    res.send('signup.ejs',{error:'✅ Signup successful! Go back for login.'});
  } catch (err) {
    console.error(err);
    res.send('❌ Error during signup.');
  }
});

// Login page (GET)
app.get('/login', (req, res) => {
  res.render('login',{ error: null });
});

// Login form submit (POST)
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
        return res.render('login.ejs', { error: 'User not found' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
        return res.render('login.ejs', { error: 'Incorrect password' });
    }

    // Save user info in session
    req.session.userId = user._id;
    req.session.userName = user.name;

    res.redirect('/dashboard');

  } catch (err) {
    console.error(err);
    res.send('❌ Error during login.');
  }
});

// Dashboard page (only for logged-in users)
app.get('/dashboard', requireLogin, (req, res) => {
  res.render('dashboard', { userName: req.session.userName });
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});


// Show post-book form (only for logged-in users)
app.get('/post-book', requireLogin, (req, res) => {
  res.render('postBook.ejs',{ message: null });
});

// Handle post-book form
app.post('/post-book', requireLogin, upload.single('image'), async (req, res) => {
  try {
    const { title, author, price, description,location } = req.body;
    let  url = req.file.path;
    let filename = req.file.path;
    const newBook = new Book({
      title,
      author,
      price,
      description,
      seller: req.session.userId,
      image: {url,filename},
      location
    });

    await newBook.save();
    res.render('postBook.ejs',{ message: '✅ Book posted successfully!' });
  } catch (err) {
    console.error(err);
    res.send('postBook.ejs',{ message: '❌ Error posting book. Try again.' });
  }
});


// Show all posted books
app.get('/books', async (req, res) => {
  const query = {};
  if (req.query.location) {
    query.location = { $regex: req.query.location, $options: 'i' }; // case-insensitive search
  }

  const books = await Book.find(query).populate('seller', 'name email');
  res.render('books.ejs', { books });
});


// Buy Now Route
app.get('/buy/:id', requireLogin, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id).populate('seller', 'name email');
    if (!book) return res.send('❌ Book not found');

    // For now, just show the seller details
    res.render('buybook.ejs', { book });
  } catch (err) {
    console.error(err);
    res.send('❌ Error loading book.');
  }
});

// Static list of NGOs and schools
const ngos = [
  { name: "Hope Foundation", location: "Sector 62, Noida" },
  { name: "Goonj NGO", location: "Sector 15, Noida" },
  { name: "Govt. Primary School", location: "Sector 50, Noida" },
  { name: "Smile India Foundation", location: "Sector 45, Noida" }
];

// Donate book form route
app.get('/donate-book', (req, res) => {
  res.render('donatebook.ejs', { ngos ,message: null});
});

app.post('/donate-book', requireLogin,upload.single('image'), async (req, res) => {
  try {
    const { title, author, description, ngo } = req.body;
    let  url = req.file.path;
    let filename = req.file.filename;
    const donation = new Book({
      title,
      author,
      description,
      price: 0,
      location: ngo,   // NGO location field   
      image: {url,filename},   
      seller: req.session.userId, // ✅ fixes the error
      isDonated: true
    });

    await donation.save();
    res.render('donatebook.ejs', { ngos,message: '✅ Book donated successfully!' });
  } catch (err) {
    console.error("Error saving donation:", err);
    res.render('donatebook.ejs', { message: '❌ Error donating book. Try again.', ngos  });
  }
});

// Connect to MongoDB
mongoose.connect(process.env.ATLASDB_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => console.log('❌ MongoDB connection error:', err.message));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
