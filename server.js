const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
 
const app = express();
const JWT_SECRET = "hospital_secret_key_change_in_production";
 
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
 
const db = mysql.createConnection({
    user: "root",
    password: "karthik@1234",
    database: "hospital_db",
    socketPath: "/tmp/mysql.sock"
});
 
db.connect(err => {
    if (err) console.error(err);
    else console.log("✅ Connected to MySQL Database");
});
 
// ─── Create users table if not exists ────────────────────────
db.query(`
    CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);
 
// ─── JWT Middleware ───────────────────────────────────────────
function authenticate(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
 
    if (!token) return res.status(401).json({ message: "Access denied. Please log in." });
 
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: "Invalid or expired token." });
        req.user = user;
        next();
    });
}
 
// ─── AUTH: Signup ─────────────────────────────────────────────
app.post("/auth/signup", async (req, res) => {
    const { username, password } = req.body;
 
    if (!username || !password)
        return res.status(400).json({ message: "Username and password are required." });
 
    const hashedPassword = await bcrypt.hash(password, 10);
 
    db.query(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        [username, hashedPassword],
        (err) => {
            if (err) {
                if (err.code === "ER_DUP_ENTRY")
                    return res.status(409).json({ message: "Username already exists." });
                return res.status(500).json({ message: "Signup failed." });
            }
            res.json({ message: "Account created successfully." });
        }
    );
});
 
// ─── AUTH: Login ──────────────────────────────────────────────
app.post("/auth/login", (req, res) => {
    const { username, password } = req.body;
 
    if (!username || !password)
        return res.status(400).json({ message: "Username and password are required." });
 
    db.query(
        "SELECT * FROM users WHERE username = ?",
        [username],
        async (err, results) => {
            if (err || results.length === 0)
                return res.status(401).json({ message: "Invalid username or password." });
 
            const user = results[0];
            const match = await bcrypt.compare(password, user.password);
 
            if (!match)
                return res.status(401).json({ message: "Invalid username or password." });
 
            const token = jwt.sign(
                { id: user.id, username: user.username },
                JWT_SECRET,
                { expiresIn: "8h" }
            );
 
            res.json({ token, username: user.username });
        }
    );
});
 
// ─── Get Doctors (protected) ──────────────────────────────────
app.get("/doctors", authenticate, (req, res) => {
    db.query("SELECT * FROM doctors", (err, results) => {
        if (err) res.status(500).send("Database error");
        else res.json(results);
    });
});
 
// ─── Add Patient (protected) ──────────────────────────────────
app.post("/add-patient", authenticate, (req, res) => {
    const { name, age, gender, disease, doctor_id, amount } = req.body;
    const sql = `INSERT INTO patients (name, age, gender, disease, doctor_id, amount) VALUES (?, ?, ?, ?, ?, ?)`;
    db.query(sql, [name, age, gender, disease, doctor_id, amount], (err) => {
        if (err) res.status(500).send("Insert error");
        else res.json({ message: "Patient added successfully" });
    });
});
 
// ─── Update Patient (protected) ───────────────────────────────
app.put("/update-patient/:id", authenticate, (req, res) => {
    const { id } = req.params;
    const { name, age, gender, disease, doctor_id, amount } = req.body;
    const sql = `UPDATE patients SET name=?, age=?, gender=?, disease=?, doctor_id=?, amount=? WHERE id=?`;
    db.query(sql, [name, age, gender, disease, doctor_id, amount, id], (err) => {
        if (err) res.status(500).send("Update error");
        else res.json({ message: "Patient updated successfully" });
    });
});
 
// ─── Delete Patient (protected) ───────────────────────────────
app.delete("/delete-patient/:id", authenticate, (req, res) => {
    const { id } = req.params;
    db.query("DELETE FROM patients WHERE id = ?", [id], (err) => {
        if (err) res.status(500).send("Delete error");
        else res.json({ message: "Patient deleted successfully" });
    });
});
 
// ─── Get Patients (protected) ─────────────────────────────────
app.get("/patients", authenticate, (req, res) => {
    const sql = `
        SELECT patients.*, doctors.name AS doctor_name
        FROM patients
        LEFT JOIN doctors ON patients.doctor_id = doctors.id
        ORDER BY patients.id DESC
    `;
    db.query(sql, (err, results) => {
        if (err) res.status(500).send("Fetch error");
        else res.json(results);
    });
});
 
app.listen(3000, () => {
    console.log("🚀 Server running on http://localhost:3000");
});
 