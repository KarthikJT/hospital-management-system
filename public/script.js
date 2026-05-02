/* ═══════════════════════════════════════════════════════════
   MediCore HMS — script.js  (Next Phase)
   ═══════════════════════════════════════════════════════════ */

const token = localStorage.getItem("token");

// ─── Redirect to login if no token ────────────────────────
if (!token) window.location.href = "/Login.html";

// ─── Show logged-in username ───────────────────────────────
const storedUser = localStorage.getItem("username");
if (storedUser) {
    const el = document.getElementById("loggedInUser");
    if (el) el.textContent = storedUser;
}

// ─── Authenticated fetch helper ────────────────────────────
function authFetch(url, options = {}) {
    return fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            ...(options.headers || {})
        }
    });
}

// ─── Toast Notification System ─────────────────────────────
function showToast(message, type = "success") {
    const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(40px)";
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// ─── Logout ────────────────────────────────────────────────
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.href = "/Login.html";
}

// ─── In-memory doctor cache for auto-fill ─────────────────
let doctorsCache = [];
let allAppointments = [];

// ─── On Load ───────────────────────────────────────────────
window.onload = () => {
    loadDoctors();
    loadPatients();
    loadAppointments();
    setMinDate();
    setupSearch();
};

// ─── Set minimum date (today) ──────────────────────────────
function setMinDate() {
    const dateInput = document.getElementById("appointmentDate");
    if (dateInput) dateInput.min = new Date().toISOString().split("T")[0];
}

// ═══════════════════════════════════════════════════════════
//  DOCTORS
// ═══════════════════════════════════════════════════════════
async function loadDoctors() {
    try {
        const res = await authFetch("/doctors");
        if (!res.ok) throw new Error("Failed to load doctors");
        const data = await res.json();
        doctorsCache = data;

        const addDropdown  = document.getElementById("doctorSelect");
        const apptDropdown = document.getElementById("doctorSelectAppointment");

        if (addDropdown) {
            addDropdown.innerHTML = `<option value="">Select Doctor</option>`;
            data.forEach(d => {
                addDropdown.innerHTML += `<option value="${d.id}" data-avail="${d.availability || ''}" data-fee="${d.fee || ''}">
                    Dr. ${d.name}${d.specialty ? ' — ' + d.specialty : ''}
                </option>`;
            });
        }

        if (apptDropdown) {
            apptDropdown.innerHTML = `<option value="">Select Doctor</option>`;
            data.forEach(d => {
                apptDropdown.innerHTML += `<option value="${d.id}">Dr. ${d.name}${d.specialty ? ' — ' + d.specialty : ''}</option>`;
            });
        }

        // Update stat
        updateStat("statDoctors", data.length);
    } catch (err) {
        console.error("loadDoctors:", err);
    }
}

// Auto-fill availability and fee when doctor is selected
function fillDoctorInfo() {
    const select = document.getElementById("doctorSelect");
    const selected = select.options[select.selectedIndex];
    const avail = selected?.dataset?.avail || "";
    const fee   = selected?.dataset?.fee   || "";

    const availInput = document.getElementById("availability");
    const feeInput   = document.getElementById("fee");
    if (availInput) availInput.value = avail;
    if (feeInput)   feeInput.value   = fee ? `₹${fee}` : "";
}

// ═══════════════════════════════════════════════════════════
//  PATIENTS
// ═══════════════════════════════════════════════════════════
async function loadPatients() {
    try {
        const res = await authFetch("/patients");
        if (!res.ok) throw new Error("Failed to load patients");
        const data = await res.json();

        renderPatientTable(data);
        populatePatientDropdown(data);
        updateStat("statPatients", data.length);
    } catch (err) {
        console.error("loadPatients:", err);
        showToast("Failed to load patients", "error");
    }
}

function renderPatientTable(data) {
    const table = document.getElementById("patientTable");
    if (!table) return;

    if (!data.length) {
        table.innerHTML = `<tr><td colspan="8" class="empty-row">No patients found.</td></tr>`;
        return;
    }

    table.innerHTML = data.map(p => `
        <tr>
            <td><strong>#${p.id}</strong></td>
            <td>${escapeHtml(p.name)}</td>
            <td>${p.age}</td>
            <td>${p.gender}</td>
            <td>${escapeHtml(p.disease)}</td>
            <td>${escapeHtml(p.doctor_name || "—")}</td>
            <td><strong>${p.amount ? '₹' + p.amount : '—'}</strong></td>
            <td>
                <button class="btn-edit" onclick="editPatient(${p.id})">✏️ Edit</button>
                <button class="btn-delete" onclick="deletePatient(${p.id})">🗑 Delete</button>
            </td>
        </tr>
    `).join("");
}

function populatePatientDropdown(data) {
    const dropdown = document.getElementById("patientSelect");
    if (!dropdown) return;
    dropdown.innerHTML = `<option value="">Select Patient</option>`;
    data.forEach(p => {
        dropdown.innerHTML += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
    });
}

// ─── Search / Filter ───────────────────────────────────────
function setupSearch() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;

    let searchTimeout;
    searchInput.addEventListener("input", () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const q = searchInput.value.trim().toLowerCase();
            const res = await authFetch("/patients");
            const data = await res.json();
            const filtered = q
                ? data.filter(p =>
                    p.name.toLowerCase().includes(q) ||
                    p.disease.toLowerCase().includes(q) ||
                    (p.doctor_name || "").toLowerCase().includes(q)
                  )
                : data;
            renderPatientTable(filtered);
        }, 300);
    });
}

// ─── Add / Edit Patient ────────────────────────────────────
document.getElementById("patientForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const editId = document.getElementById("editId").value;
    const feeRaw = document.getElementById("fee").value.replace(/[₹,\s]/g, "");

    const patient = {
        name:      document.getElementById("name").value.trim(),
        age:       document.getElementById("age").value,
        gender:    document.getElementById("gender").value,
        disease:   document.getElementById("disease").value.trim(),
        doctor_id: document.getElementById("doctorSelect").value,
        amount:    feeRaw
    };

    if (!patient.name || !patient.age || !patient.gender || !patient.disease || !patient.doctor_id) {
        showToast("Please fill in all required fields.", "warning");
        return;
    }

    try {
        let res;
        if (editId) {
            res = await authFetch(`/update-patient/${editId}`, {
                method: "PUT",
                body: JSON.stringify(patient)
            });
        } else {
            res = await authFetch("/add-patient", {
                method: "POST",
                body: JSON.stringify(patient)
            });
        }

        if (!res.ok) throw new Error("Save failed");

        showToast(editId ? "Patient updated successfully!" : "Patient added successfully!", "success");
        cancelEdit();
        loadPatients();
    } catch (err) {
        console.error("Save patient:", err);
        showToast("Failed to save patient record.", "error");
    }
});

// ─── Edit Patient (fill form) ──────────────────────────────
async function editPatient(id) {
    try {
        const res = await authFetch("/patients");
        const data = await res.json();
        const p = data.find(x => x.id === id);
        if (!p) return showToast("Patient not found.", "error");

        document.getElementById("editId").value     = p.id;
        document.getElementById("name").value       = p.name;
        document.getElementById("age").value        = p.age;
        document.getElementById("gender").value     = p.gender;
        document.getElementById("disease").value    = p.disease;
        document.getElementById("doctorSelect").value = p.doctor_id || "";
        document.getElementById("availability").value = p.availability || "";
        document.getElementById("fee").value        = p.amount ? `₹${p.amount}` : "";

        // Update UI
        const card = document.querySelector(".card");
        card?.classList.add("edit-mode");
        document.getElementById("formTitle").textContent   = "✏️ Edit Patient";
        document.getElementById("formBadge").textContent   = "Editing Record";
        document.getElementById("submitBtn").textContent   = "💾 Update Patient";
        document.getElementById("cancelBtn").style.display = "inline-flex";

        card?.scrollIntoView({ behavior: "smooth", block: "start" });
        document.getElementById("name").focus();
    } catch (err) {
        showToast("Could not load patient for editing.", "error");
    }
}

// ─── Cancel Edit ───────────────────────────────────────────
function cancelEdit() {
    document.getElementById("patientForm").reset();
    document.getElementById("editId").value = "";

    const card = document.querySelector(".card");
    card?.classList.remove("edit-mode");
    document.getElementById("formTitle").textContent   = "➕ Add New Patient";
    document.getElementById("formBadge").textContent   = "New Record";
    document.getElementById("submitBtn").textContent   = "➕ Add Patient";
    document.getElementById("cancelBtn").style.display = "none";
    document.getElementById("availability").value      = "";
    document.getElementById("fee").value               = "";
}

// ─── Delete Patient ────────────────────────────────────────
async function deletePatient(id) {
    if (!confirm("Delete this patient record?")) return;
    try {
        const res = await authFetch(`/delete-patient/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");
        showToast("Patient deleted.", "success");
        loadPatients();
    } catch (err) {
        showToast("Failed to delete patient.", "error");
    }
}

// ═══════════════════════════════════════════════════════════
//  APPOINTMENTS  — THE BIG FIX IS HERE
//  The original code had a backend Express route accidentally
//  placed in this frontend file. Replaced with proper fetch.
// ═══════════════════════════════════════════════════════════
document.getElementById("appointmentForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const patient_id       = document.getElementById("patientSelect").value;
    const doctor_id        = document.getElementById("doctorSelectAppointment").value;
    const appointment_date = document.getElementById("appointmentDate").value;
    const time_slot        = document.getElementById("timeSlot").value;

    if (!patient_id || !doctor_id || !appointment_date || !time_slot) {
        showToast("Please fill in all appointment fields.", "warning");
        return;
    }

    try {
        const res = await authFetch("/book-appointment", {
            method: "POST",
            body: JSON.stringify({ patient_id, doctor_id, appointment_date, time_slot })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || "Booking failed");
        }

        showToast("Appointment booked successfully! 📅", "success");
        document.getElementById("appointmentForm").reset();
        loadAppointments();
    } catch (err) {
        console.error("Book appointment:", err);
        showToast(`Failed to book appointment: ${err.message}`, "error");
    }
});

// ─── Load Appointments ─────────────────────────────────────
async function loadAppointments() {
    try {
        const res = await authFetch("/appointments");
        if (!res.ok) throw new Error("Failed to load appointments");
        allAppointments = await res.json();

        renderAppointmentTable(allAppointments);
        updateStats(allAppointments);
    } catch (err) {
        console.error("loadAppointments:", err);
        showToast("Failed to load appointments.", "error");
    }
}

function renderAppointmentTable(data) {
    const table = document.getElementById("appointmentTable");
    if (!table) return;

    if (!data.length) {
        table.innerHTML = `<tr><td colspan="7" class="empty-row">No appointments yet.</td></tr>`;
        return;
    }

    table.innerHTML = data.map(a => {
        const status = a.status || "Booked";
        const statusClass = `status-${status.toLowerCase()}`;
        const dateFormatted = a.appointment_date
            ? new Date(a.appointment_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
            : "—";

        return `
            <tr>
                <td><strong>#${a.id}</strong></td>
                <td>${escapeHtml(a.patient_name || "—")}</td>
                <td>${escapeHtml(a.doctor_name || "—")}</td>
                <td>${dateFormatted}</td>
                <td>${a.time_slot || "—"}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td>
                    ${status !== "Completed"
                        ? `<button class="btn-edit" onclick="markCompleted(${a.id})">✔ Done</button>`
                        : ""}
                    <button class="btn-delete" onclick="deleteAppointment(${a.id})">🗑 Delete</button>
                </td>
            </tr>
        `;
    }).join("");
}

// ─── Filter appointments by status ────────────────────────
function filterAppointments() {
    const filter = document.getElementById("statusFilter")?.value || "";
    const filtered = filter
        ? allAppointments.filter(a => (a.status || "Booked") === filter)
        : allAppointments;
    renderAppointmentTable(filtered);
}

// ─── Mark Appointment as Completed ─────────────────────────
async function markCompleted(id) {
    try {
        const res = await authFetch(`/update-appointment/${id}`, {
            method: "PUT",
            body: JSON.stringify({ status: "Completed" })
        });
        if (!res.ok) throw new Error("Update failed");
        showToast("Appointment marked as completed ✔", "success");
        loadAppointments();
    } catch (err) {
        showToast("Failed to update appointment status.", "error");
    }
}

// ─── Delete Appointment ─────────────────────────────────────
async function deleteAppointment(id) {
    if (!confirm("Delete this appointment?")) return;
    try {
        const res = await authFetch(`/delete-appointment/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");
        showToast("Appointment deleted.", "success");
        loadAppointments();
    } catch (err) {
        showToast("Failed to delete appointment.", "error");
    }
}

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════
function updateStat(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function updateStats(appointments) {
    updateStat("statAppointments", appointments.length);
    const completed = appointments.filter(a => (a.status || "") === "Completed").length;
    updateStat("statCompleted", completed);
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}