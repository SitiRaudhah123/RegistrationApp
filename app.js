const express = require('express');
const mysql = require('mysql2'); // Note: mysql2 is recommended over mysql for better features like promises and pooling

//******** TODO: Insert code to import 'express-session' *********//
const session = require('express-session');

const flash = require('connect-flash');

const app = express(); // moved this line UP before app.use()

app.use(flash()); // this line now comes AFTER app is defined

// Database connection Pool
const pool = mysql.createPool({
    host: 'kxv9rg.h.filess.io',
    user: 'C237database_beehatpull',
    password: '31f90e51f29129f0ebb30e2fbd7ae2a80e13f69c',
    database: 'C237database_beehatpull',
    port: 3307,
    waitForConnections: true, // If true, the pool will queue connections and wait for one to become available
    connectionLimit: 4,       // IMPORTANT: Set this to a value LESS THAN your database provider's limit (e.g., 4 if limit is 5)
    queueLimit: 0             // No limit on how many requests can be queued (0 means unlimited)
});

// Test connection pool connection (optional, but good for verifying startup)
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to database pool:', err);
        // It's crucial to throw or handle this error properly, as the app won't function without DB
        throw err;
    }
    console.log('Connected to database pool');
    connection.release(); // Release the connection back to the pool immediately after testing
});


app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

//******** TODO: Insert code for Session Middleware below ********//
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

// Flash messages middleware is already added above, just reminding here.
// app.use(flash()); // This line is present twice in your original code, one is enough.
// I've kept the one after `app = express();` initialization.

// Setting up EJS
app.set('view engine', 'ejs');

//******** TODO: Create a Middleware to check if user is logged in. ********//
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', "Please log in to view this resource");
        res.redirect('/login');
    }
};

//******** TODO: Create a Middleware to check if user is admin. ********//
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role == 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/dashboard');
    }
};

// Routes
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user, messages: req.flash('success') });
});

app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

//******** TODO: Create a middleware function validateRegistration ********//
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact } = req.body;

    if (!username || !email || !password || !address || !contact) {
        // Use flash messages for user-friendly error display instead of send
        req.flash('error', 'All fields are required.');
        req.flash('formData', req.body); // Store data to repopulate form
        return res.redirect('/register');
    }

    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next(); //If all validation pass, the next function is called, allowing the request to proceed to the
            // next middleware function or route handler.
};

//******** TODO: Integrate validateRegistration into the register route. ********//
app.post('/register', validateRegistration, (req, res) => {
    //******** TODO: Update register route to include role. ********//
    const { username, email, password, address, contact, role } = req.body;

    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    // Use pool.query instead of db.query
    pool.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            console.error('Error during registration:', err); // Log the error for debugging
            // Check for specific errors, e.g., duplicate email/username
            if (err.code === 'ER_DUP_ENTRY') {
                req.flash('error', 'Username or Email already exists.');
                req.flash('formData', req.body);
                return res.redirect('/register');
            }
            // General error for other database issues
            req.flash('error', 'Registration failed. Please try again.');
            req.flash('formData', req.body);
            return res.redirect('/register');
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

//******** TODO: Insert code for login routes to render login page below ********//
app.get('/login', (req, res) => {
    res.render('login', {
        messages: req.flash('success'), // Retrieve success message from the session and pass them to the view
        errors: req.flash('error')      // Retrieve error messages from the session and pass them to the view
    });
});

//******** TODO: Insert code for login routes for form submission below ********//
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    // Use pool.query instead of db.query
    pool.query(sql, [email, password], (err, results) => {
        if (err) {
            console.error('Error during login query:', err); // Log the error for debugging
            req.flash('error', 'An error occurred during login. Please try again.');
            return res.redirect('/login');
        }
        if (results.length > 0) {
            //successful login
            req.session.user = results[0]; //store user in session
            req.flash('success', 'Login successful');
            res.redirect('/dashboard');
        } else {
            //Invalid Credentials
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

// There were two app.get('/') routes, consolidating to one as the first one already handles flash messages.
// Removed the duplicate app.get('/') from line 170.

//******** TODO: Insert code for dashboard route to render dashboard page for users. ********//
app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});

//******** TODO: Insert code for admin route to render dashboard page for admin. ********//
app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin', { user: req.session.user });
});

//******** TODO: Insert code for logout route ********//
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/');
    });
});

// Starting the server
app.listen(3000, () => {
    console.log('Server started on port 3000');
});
