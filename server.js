const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const db = mysql.createConnection({
    user: "root",
    password: "karthik@1234", // 🔴 Put your real password
    database: "hospital_db",
    socketPath: "/tmp/mysql.sock"
});

db.connect((err) => {
    if (err) {
        console.error("❌ Database connection failed:", err);
    } else {
        console.log("✅ Connected to MySQL Database");
    }
});

// ➕ Add Patient
app.post("/add-patient", (req, res) => {
    const { name, age, gender, disease } = req.body;

    const sql = "INSERT INTO patients (name, age, gender, disease) VALUES (?, ?, ?, ?)";

    db.query(sql, [name, age, gender, disease], (err) => {
        if (err) {
            res.status(500).send("Database error");
        } else {
            res.json({ message: "Patient added successfully" });
        }
    });
});

// 📄 Get All Patients
app.get("/patients", (req, res) => {
    db.query("SELECT * FROM patients", (err, results) => {
        if (err) {
            res.status(500).send("Database error");
        } else {
            res.json(results);
        }
    });
});

// ❌ Delete Patient
app.delete("/delete-patient/:id", (req, res) => {
    const patientId = req.params.id;

    db.query("DELETE FROM patients WHERE id = ?", [patientId], (err) => {
        if (err) {
            res.status(500).send("Delete error");
        } else {
            res.json({ message: "Patient deleted successfully" });
        }
    });
});

app.listen(3000, () => {
    console.log("🚀 Server running on http://localhost:3000");
});