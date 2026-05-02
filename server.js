/* ═══════════════════════════════════════════════════════════
   MediCore HMS — server.js
   Stack: Node.js + Express + MySQL + JWT
   ═══════════════════════════════════════════════════════════ */

const express  = require("express");
const mysql    = require("mysql2");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const path     = require("path");
const cors     = require("cors");

const app = express();
const PORT       = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "medicore_secret_change_in_production";

// ─── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // serve Login.html, Index.html, etc.

// ─── MySQL Connection Pool ─────────────────────────────────
const db = mysql.createPool({
    host:               process.env.DB_HOST     || "localhost",
    user:               process.env.DB_USER     || "root",
    password:           process.env.DB_PASSWORD || "",
    database:           process.env.DB_NAME     || "hospital_db",
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0
});

// Test DB connection on startup
db.getConnection((err, connection) => {
    if (err) {
        console.error("❌ Database connection failed:", err.message);
        console.error("   Make sure MySQL is running and hospital_db exists.");
    } else {
        console.log("✅ MySQL connected successfully.");
        connection.release();
        initTables();
    }
});

// ═══════════════════════════════════════════════════════════
//  DATABASE INIT — Auto-create tables if they don't exist
// ═══════════════════════════════════════════════════════════
function initTables() {
    const queries = [
        // Users table
        `CREATE TABLE IF NOT EXISTS users (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            username   VARCHAR(100) NOT NULL UNIQUE,
            password   VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Doctors table
        `CREATE TABLE IF NOT EXISTS doctors (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            name         VARCHAR(150) NOT NULL,
            specialty    VARCHAR(100),
            availability VARCHAR(100),
            fee          DECIMAL(10,2) DEFAULT 0,
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Patients table
        `CREATE TABLE IF NOT EXISTS patients (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            name       VARCHAR(150) NOT NULL,
            age        INT NOT NULL,
            gender     ENUM('Male','Female','Other') NOT NULL,
            disease    VARCHAR(255) NOT NULL,
            doctor_id  INT,
            amount     DECIMAL(10,2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL
        )`,

        // Appointments table
        `CREATE TABLE IF NOT EXISTS appointments (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            patient_id       INT NOT NULL,
            doctor_id        INT NOT NULL,
            appointment_date DATE NOT NULL,
            time_slot        VARCHAR(20) NOT NULL,
            status           ENUM('Booked','Completed','Cancelled') DEFAULT 'Booked',
            created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id)  ON DELETE CASCADE,
            FOREIGN KEY (doctor_id)  REFERENCES doctors(id)   ON DELETE CASCADE
        )`
    ];

    queries.forEach(sql => {
        db.query(sql, err => {
            if (err) console.error("❌ Table init error:", err.message);
        });
    });

    // Seed sample doctors if table is empty
    db.query("SELECT COUNT(*) AS cnt FROM doctors", (err, rows) => {
        if (err || rows[0].cnt > 0) return;
        const sampleDoctors = [
            ["Dr. Priya Sharma",   "Cardiologist",     "Mon-Fri 9AM-5PM",  800],
            ["Dr. Rajesh Kumar",   "Orthopedist",      "Tue-Sat 10AM-6PM", 600],
            ["Dr. Anjali Mehta",   "Neurologist",      "Mon-Thu 8AM-4PM",  900],
            ["Dr. Suresh Nair",    "General Medicine", "Daily 8AM-8PM",    300],
            ["Dr. Kavitha Reddy",  "Pediatrician",     "Mon-Fri 9AM-5PM",  500]
        ];
        db.query(
            "INSERT INTO doctors (name, specialty, availability, fee) VALUES ?",
            [sampleDoctors],
            err => { if (!err) console.log("✅ Sample doctors seeded."); }
        );
    });

    console.log("✅ Tables initialized.");
}

// ═══════════════════════════════════════════════════════════
//  AUTH MIDDLEWARE
// ═══════════════════════════════════════════════════════════
function verifyToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(401).json({ message: "No token provided." });

    const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : authHeader;

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: "Invalid or expired token." });
        req.user = decoded;
        next();
    });
}

// ═══════════════════════════════════════════════════════════
//  AUTH ROUTES
// ═══════════════════════════════════════════════════════════

// POST /auth/signup
app.post("/auth/signup", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password)
        return res.status(400).json({ message: "Username and password are required." });
    if (password.length < 6)
        return res.status(400).json({ message: "Password must be at least 6 characters." });

    try {
        const hashed = await bcrypt.hash(password, 10);
        db.query(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            [username.trim(), hashed],
            (err) => {
                if (err) {
                    if (err.code === "ER_DUP_ENTRY")
                        return res.status(409).json({ message: "Username already exists." });
                    console.error("Signup error:", err);
                    return res.status(500).json({ message: "Server error during signup." });
                }
                res.json({ message: "Account created successfully." });
            }
        );
    } catch (err) {
        console.error("Signup bcrypt error:", err);
        res.status(500).json({ message: "Internal server error." });
    }
});

// POST /auth/login
app.post("/auth/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password)
        return res.status(400).json({ message: "Username and password are required." });

    db.query(
        "SELECT * FROM users WHERE username = ?",
        [username.trim()],
        async (err, rows) => {
            if (err) return res.status(500).json({ message: "Server error." });
            if (!rows.length) return res.status(401).json({ message: "Invalid credentials." });

            const user = rows[0];
            const match = await bcrypt.compare(password, user.password);
            if (!match) return res.status(401).json({ message: "Invalid credentials." });

            const token = jwt.sign(
                { id: user.id, username: user.username },
                JWT_SECRET,
                { expiresIn: "24h" }
            );

            res.json({ token, username: user.username });
        }
    );
});

// ═══════════════════════════════════════════════════════════
//  DOCTOR ROUTES
// ═══════════════════════════════════════════════════════════

// GET /doctors
app.get("/doctors", verifyToken, (req, res) => {
    db.query("SELECT * FROM doctors ORDER BY name ASC", (err, rows) => {
        if (err) return res.status(500).json({ message: "Error fetching doctors." });
        res.json(rows);
    });
});

// POST /add-doctor
app.post("/add-doctor", verifyToken, (req, res) => {
    const { name, specialty, availability, fee } = req.body;
    if (!name) return res.status(400).json({ message: "Doctor name is required." });

    db.query(
        "INSERT INTO doctors (name, specialty, availability, fee) VALUES (?, ?, ?, ?)",
        [name, specialty || null, availability || null, fee || 0],
        (err, result) => {
            if (err) return res.status(500).json({ message: "Error adding doctor." });
            res.json({ message: "Doctor added.", id: result.insertId });
        }
    );
});

// DELETE /delete-doctor/:id
app.delete("/delete-doctor/:id", verifyToken, (req, res) => {
    db.query("DELETE FROM doctors WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ message: "Error deleting doctor." });
        res.json({ message: "Doctor deleted." });
    });
});

// ═══════════════════════════════════════════════════════════
//  PATIENT ROUTES
// ═══════════════════════════════════════════════════════════

// GET /patients
app.get("/patients", verifyToken, (req, res) => {
    const sql = `
        SELECT
            p.*,
            d.name        AS doctor_name,
            d.availability,
            d.fee
        FROM patients p
        LEFT JOIN doctors d ON p.doctor_id = d.id
        ORDER BY p.created_at DESC
    `;
    db.query(sql, (err, rows) => {
        if (err) return res.status(500).json({ message: "Error fetching patients." });
        res.json(rows);
    });
});

// POST /add-patient
app.post("/add-patient", verifyToken, (req, res) => {
    const { name, age, gender, disease, doctor_id, amount } = req.body;

    if (!name || !age || !gender || !disease)
        return res.status(400).json({ message: "Required fields missing." });

    db.query(
        "INSERT INTO patients (name, age, gender, disease, doctor_id, amount) VALUES (?, ?, ?, ?, ?, ?)",
        [name, age, gender, disease, doctor_id || null, amount || 0],
        (err, result) => {
            if (err) return res.status(500).json({ message: "Error adding patient." });
            res.json({ message: "Patient added.", id: result.insertId });
        }
    );
});

// PUT /update-patient/:id
app.put("/update-patient/:id", verifyToken, (req, res) => {
    const { name, age, gender, disease, doctor_id, amount } = req.body;

    db.query(
        `UPDATE patients
         SET name=?, age=?, gender=?, disease=?, doctor_id=?, amount=?
         WHERE id=?`,
        [name, age, gender, disease, doctor_id || null, amount || 0, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ message: "Error updating patient." });
            res.json({ message: "Patient updated." });
        }
    );
});

// DELETE /delete-patient/:id
app.delete("/delete-patient/:id", verifyToken, (req, res) => {
    db.query("DELETE FROM patients WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ message: "Error deleting patient." });
        res.json({ message: "Patient deleted." });
    });
});

// ═══════════════════════════════════════════════════════════
//  APPOINTMENT ROUTES  — FIXED
// ═══════════════════════════════════════════════════════════

// GET /appointments
app.get("/appointments", verifyToken, (req, res) => {
    const sql = `
        SELECT
            a.*,
            p.name AS patient_name,
            d.name AS doctor_name
        FROM appointments a
        LEFT JOIN patients p ON a.patient_id = p.id
        LEFT JOIN doctors  d ON a.doctor_id  = d.id
        ORDER BY a.appointment_date DESC, a.time_slot ASC
    `;
    db.query(sql, (err, rows) => {
        if (err) {
            console.error("❌ GET /appointments error:", err);
            return res.status(500).json({ message: "Error fetching appointments." });
        }
        res.json(rows);
    });
});

// POST /book-appointment  ← THIS WAS THE BROKEN ROUTE (was in frontend JS)
app.post("/book-appointment", verifyToken, (req, res) => {
    console.log("📥 Booking appointment:", req.body);

    const { patient_id, doctor_id, appointment_date, time_slot } = req.body;

    if (!patient_id || !doctor_id || !appointment_date || !time_slot) {
        console.warn("❌ Missing fields:", req.body);
        return res.status(400).json({ message: "All fields are required." });
    }

    // Check for duplicate booking (same doctor, date, time slot)
    db.query(
        `SELECT id FROM appointments
         WHERE doctor_id=? AND appointment_date=? AND time_slot=? AND status != 'Cancelled'`,
        [doctor_id, appointment_date, time_slot],
        (err, existing) => {
            if (err) return res.status(500).json({ message: "Server error." });
            if (existing.length > 0)
                return res.status(409).json({ message: "This time slot is already booked for the selected doctor." });

            db.query(
                `INSERT INTO appointments (patient_id, doctor_id, appointment_date, time_slot)
                 VALUES (?, ?, ?, ?)`,
                [patient_id, doctor_id, appointment_date, time_slot],
                (err, result) => {
                    if (err) {
                        console.error("❌ Insert appointment error:", err);
                        return res.status(500).json({ message: "Error booking appointment." });
                    }
                    console.log("✅ Appointment booked, ID:", result.insertId);
                    res.json({ message: "Appointment booked.", id: result.insertId });
                }
            );
        }
    );
});

// PUT /update-appointment/:id  (mark complete / cancel)
app.put("/update-appointment/:id", verifyToken, (req, res) => {
    const { status } = req.body;
    const allowed = ["Booked", "Completed", "Cancelled"];

    if (!allowed.includes(status))
        return res.status(400).json({ message: "Invalid status value." });

    db.query(
        "UPDATE appointments SET status=? WHERE id=?",
        [status, req.params.id],
        (err) => {
            if (err) return res.status(500).json({ message: "Error updating appointment." });
            res.json({ message: "Appointment updated." });
        }
    );
});

// DELETE /delete-appointment/:id
app.delete("/delete-appointment/:id", verifyToken, (req, res) => {
    db.query("DELETE FROM appointments WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ message: "Error deleting appointment." });
        res.json({ message: "Appointment deleted." });
    });
});

// ═══════════════════════════════════════════════════════════
//  DASHBOARD STATS ROUTE
// ═══════════════════════════════════════════════════════════
app.get("/stats", verifyToken, (req, res) => {
    const queries = {
        patients:     "SELECT COUNT(*) AS cnt FROM patients",
        doctors:      "SELECT COUNT(*) AS cnt FROM doctors",
        appointments: "SELECT COUNT(*) AS cnt FROM appointments",
        completed:    "SELECT COUNT(*) AS cnt FROM appointments WHERE status='Completed'"
    };

    const stats = {};
    const keys  = Object.keys(queries);
    let done    = 0;

    keys.forEach(key => {
        db.query(queries[key], (err, rows) => {
            stats[key] = err ? 0 : rows[0].cnt;
            if (++done === keys.length) res.json(stats);
        });
    });
});

// ═══════════════════════════════════════════════════════════
//  SERVE FRONTEND (SPA fallback)
// ═══════════════════════════════════════════════════════════
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Login.html"));
});

app.get("/Index.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "Index.html"));
});

// ─── Start Server ──────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🏥 MediCore HMS running at http://localhost:${PORT}`);
    console.log(`   Login page : http://localhost:${PORT}/`);
    console.log(`   Dashboard  : http://localhost:${PORT}/Index.html\n`);
});