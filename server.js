const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

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

// Get Doctors
app.get("/doctors", (req, res) => {
    db.query("SELECT * FROM doctors", (err, results) => {
        if (err) res.status(500).send("Database error");
        else res.json(results);
    });
});

// Add Patient
app.post("/add-patient", (req, res) => {
    const { name, age, gender, disease, doctor_id, amount } = req.body;

    const sql = `
        INSERT INTO patients (name, age, gender, disease, doctor_id, amount)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [name, age, gender, disease, doctor_id, amount], (err) => {
        if (err) res.status(500).send("Insert error");
        else res.json({ message: "Patient added successfully" });
    });
});

// Get Patients with Doctor Info
app.get("/patients", (req, res) => {
    const sql = `
        SELECT patients.*, doctors.name AS doctor_name
        FROM patients
        LEFT JOIN doctors ON patients.doctor_id = doctors.id
    `;

    db.query(sql, (err, results) => {
        if (err) res.status(500).send("Fetch error");
        else res.json(results);
    });
});

app.listen(3000, () => {
    console.log("🚀 Server running on http://localhost:3000");
});