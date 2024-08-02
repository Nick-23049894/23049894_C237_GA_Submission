const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const app = express();
const port = 3000;

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    },
});

const upload = multer({ storage: storage });

const connection = mysql.createConnection({
    // host: 'localhost',
    // user: 'root',
    // password: '',
    // database: 'taskManagerDb'
    host: 'db4free.net',
    user: 'nickho_23049894',
    password: 'pDyB3m3E*F"*XD.',
    database: 'taskmanagerdb'
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Set up view engine 
app.set('view engine', 'ejs');
// Enable form processing
app.use(express.urlencoded({
    extended: false
}));
app.use(express.static('public'));

// used to store session so that i can store userId chatgpt
const session = require('express-session');

app.use(session({
    secret: 'your secret key',
    resave: false,
    saveUninitialized: true
}));

// Middleware to check if user is authenticated chatgpt
function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.redirect('/');
    }
}

// Add a route for the root URL ('/')
app.get('/', (req, res) => {
    res.render('index');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Query MySQL for user credentials
    const getUserQuery = 'SELECT * FROM users WHERE username = ?';
    connection.query(getUserQuery, [username], (error, results) => {

        if (error) {
            console.error('Error retrieving user:', error.message);
            return res.status(500).send('Error retrieving user');
        }

        if (results.length === 0) {
            return res.render('index', { error: 'User does not exist' });
        }

        const user = results[0];
        if (user.password !== password) {
            return res.render('index', { error: 'Incorrect password' });
        }

        // Store user session data
        req.session.userId = user.userId;
        req.session.username = user.username;

        // Query tasks for the authenticated user
        const getUserTasksQuery = 'SELECT * FROM tasks WHERE userId = ?';
        connection.query(getUserTasksQuery, [user.userId], (error, tasks) => {
            if (error) {
                console.error('Error retrieving tasks:', error.message);
                return res.status(500).send('Error retrieving tasks');
            }

            res.render('home', { data: { userId: req.session.userId, username: req.session.username, tasks } });
        });
    });
});

// Create account
app.get('/createAccount', (req, res) => {
    res.render('createAcc');
});

app.post('/aCreateAcc', (req, res) => {
    const { username, password, Cpassword } = req.body;
    // Validate password length
    if (username.length < 3) {
        return res.render('createAcc', { error: 'Username must be at least 3 characters long' });
    }

    // Validate password length
    if (password.length <= 8) {
        return res.render('createAcc', { error: 'Password must be more than 8 characters long' });
    }

    // Check if password and confirm password match
    if (password !== Cpassword) {
        return res.render('createAcc', { error: 'Passwords do not match' });
    }

    // Check if username already exists in the database
    const checkUserQuery = 'SELECT * FROM users WHERE username = ?';
    connection.query(checkUserQuery, [username], (error, results) => {
        if (error) {
            console.error('Error checking username:', error.message);
            return res.status(500).send('Error creating account');
        }

        if (results.length > 0) {
            return res.render('createAcc', { error: 'Username already exists' });
        }

        // Insert new user into the database
        const insertUserQuery = 'INSERT INTO users (username, password) VALUES (?, ?)';
        connection.query(insertUserQuery, [username, password], (error, results) => {
            if (error) {
                console.error('Error creating account:', error.message);
                return res.status(500).send('Error creating account');
            }

            res.redirect('/');
        });
    });
});

// Add tasks
app.get('/createtask', isAuthenticated, (req, res) => {
    res.render('createTask');
});

app.post('/addTask', isAuthenticated, (req, res) => {
    const { title, description, dueDate, priority } = req.body;
    const userId = req.session.userId;

    // Get current date in 'YYYY-MM-DD' format
    const createdDate = new Date().toISOString().split('T')[0];

    // Use today's date if dueDate is empty or null
    const formattedDueDate = dueDate ? dueDate : createdDate;

    // Validate dueDate again in case of invalid input
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);  // Set the time to midnight to only compare dates
    const inputDueDate = new Date(formattedDueDate);
    inputDueDate.setHours(0, 0, 0, 0);  // Set the time to midnight to only compare dates

    if (inputDueDate < currentDate) {
        return res.render('createTask', { error: 'Due date cannot be in the past' });
    }

    // Insert new task into MySQL database
    const insertTaskQuery = 'INSERT INTO tasks (userId, title, description, priority, completed, createdDate, dueDate) VALUES (?, ?, ?, ?, ?, ?, ?)';
    connection.query(insertTaskQuery, [userId, title, description, priority, false, createdDate, formattedDueDate], (error, results) => {
        if (error) {
            console.error('Error creating task:', error.message);
            return res.status(500).send('Error creating task');
        }
        // Redirect to the home page after successful task creation
        res.redirect('/home');
    });
});

// Home page route
app.get('/home', isAuthenticated, (req, res) => {
    const userId = req.session.userId;
    const sql = 'SELECT * FROM tasks WHERE userId = ?';
    connection.query(sql, [userId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving tasks');
        }

        res.render('home', { data: { userId: req.session.userId, username: req.session.username, tasks: results } });
    });
});

// Task detail route
app.get('/task/:id', isAuthenticated, (req, res) => {
    const taskId = req.params.id;
    const sql = 'SELECT * FROM tasks WHERE id = ? AND userId = ?'; // Ensure task belongs to logged-in user

    connection.query(sql, [taskId, req.session.userId], (error, results) => {
        if (error) {
            console.error('Error retrieving task:', error.message);
            return res.status(500).send('Error retrieving task');
        }

        if (results.length > 0) {
            res.render('taskDetail', { task: results[0] });
        } else {
            res.status(404).send('Task not found');
        }
    });
});

// Edit task route
app.get('/updateTask/:id', isAuthenticated, (req, res) => {
    const taskId = req.params.id;
    const sql = 'SELECT * FROM tasks WHERE id = ? AND userId = ?'; // Ensure task belongs to logged-in user

    connection.query(sql, [taskId, req.session.userId], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving task');
        }

        if (results.length > 0) {
            const task = results[0];
            res.render('updateTask', { task: task });
        } else {
            res.status(404).send('Task not found');
        }
    });
});

// Update task route
app.post('/updateTask/:id', isAuthenticated, (req, res) => {
    const taskId = req.params.id;
    const { title, description, priority, completed, dueDate } = req.body;
    const userId = req.session.userId;

    // Fetch the original task to get the original values
    const getTaskQuery = 'SELECT title, description, priority, completed, dueDate FROM tasks WHERE id = ? AND userId = ?';
    connection.query(getTaskQuery, [taskId, userId], (error, results) => {
        if (error) {
            console.error('Error retrieving task:', error.message);
            return res.status(500).send('Error retrieving task');
        }

        if (results.length === 0) {
            return res.status(404).send('Task not found');
        }

        // >> chatgpt
        const originalTask = results[0];
        const originalDueDate = new Date(originalTask.dueDate);
        const newDueDate = new Date(dueDate);

        // Get the current date
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0); // Set the time to midnight to only compare dates

        // Ensure the new due date is not before the original due date if it is before or on today
        if (newDueDate < currentDate ) {
            return res.render('updateTask', {
                task: { id: taskId, title, description, priority, completed: completed === 'true', dueDate },
                error: 'New due date cannot be before the original due date.'
            });
        }
        // << chatgpt



        // Check if any values have changed
        if (
            title === originalTask.title &&
            description === originalTask.description &&
            priority === originalTask.priority &&
            completed === (originalTask.completed ? 'true' : 'false') &&
            dueDate === originalTask.dueDate
        ) {
            return res.redirect('/home'); // No changes detected, redirect to home
        }

        // Base update query
        const updateTaskQuery = 'UPDATE tasks SET title = ?, description = ?, priority = ?, completed = ?, dueDate = ? WHERE id = ? AND userId = ?';
        const params = [title, description, priority, completed === 'true', dueDate, taskId, userId];

        // Execute the update query with the appropriate parameters
        connection.query(updateTaskQuery, params, (error, results) => {
            if (error) {
                console.error('Error updating task:', error.message);
                return res.status(500).send('Error updating task');
            } else {
                res.redirect('/home');
            }
        });
    });
});

// Delete task route
app.get('/deleteTask/:id', isAuthenticated, (req, res) => {
    const taskId = req.params.id;
    const sql = 'DELETE FROM tasks WHERE id = ? AND userId = ?'; // Ensure task belongs to logged-in user

    connection.query(sql, [taskId, req.session.userId], (error, results) => {
        if (error) {
            console.error('Error deleting task:', error.message);
            return res.status(500).send('Error deleting task');
        }

        // Check if any rows were affected (task deleted)
        if (results.affectedRows > 0) {
            res.redirect('/home');
        } else {
            res.status(404).send('Task not found');
        }
    });
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
