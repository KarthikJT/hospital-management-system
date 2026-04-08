const form = document.getElementById("patientForm");
const doctorSelect = document.getElementById("doctorSelect");
const availabilityInput = document.getElementById("availability");
const feeInput = document.getElementById("fee");
const table = document.getElementById("patientTable");
const searchInput = document.getElementById("searchInput");
const submitBtn = document.getElementById("submitBtn");
const cancelBtn = document.getElementById("cancelBtn");
const editIdInput = document.getElementById("editId");
 
let doctorsData = [];
let allPatients = [];
 
// ─── Auth Guard ───────────────────────────────────────────────
const token = localStorage.getItem("token");
if (!token) window.location.href = "/login.html";
 
// Show logged-in username
const username = localStorage.getItem("username");
if (username && document.getElementById("loggedInUser")) {
    document.getElementById("loggedInUser").textContent = `👤 ${username}`;
}
 
// ─── Helper: Authenticated fetch ─────────────────────────────
function authFetch(url, options = {}) {
    return fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            ...(options.headers || {})
        }
    }).then(res => {
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("username");
            window.location.href = "/login.html";
        }
        return res;
    });
}
 
// ─── Logout ───────────────────────────────────────────────────
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.href = "/login.html";
}
 
window.onload = () => {
    loadDoctors();
    loadPatients();
};
 
// ─── Load Doctors ────────────────────────────────────────────
async function loadDoctors() {
    const res = await authFetch("/doctors");
    doctorsData = await res.json();
 
    doctorSelect.innerHTML = '<option value="">Select Doctor</option>';
    doctorsData.forEach(doc => {
        doctorSelect.innerHTML += `
            <option value="${doc.id}">${doc.name} (${doc.specialization})</option>
        `;
    });
}
 
// ─── Doctor Change ───────────────────────────────────────────
doctorSelect.addEventListener("change", function () {
    const selectedDoctor = doctorsData.find(doc => doc.id == this.value);
    if (selectedDoctor) {
        availabilityInput.value = selectedDoctor.availability;
        feeInput.value = selectedDoctor.consultation_fee;
    } else {
        availabilityInput.value = "";
        feeInput.value = "";
    }
});
 
// ─── Add / Edit Patient ───────────────────────────────────────
form.addEventListener("submit", async (e) => {
    e.preventDefault();
 
    const patient = {
        name: document.getElementById("name").value,
        age: document.getElementById("age").value,
        gender: document.getElementById("gender").value,
        disease: document.getElementById("disease").value,
        doctor_id: doctorSelect.value,
        amount: feeInput.value
    };
 
    const editId = editIdInput.value;
 
    if (editId) {
        await authFetch(`/update-patient/${editId}`, {
            method: "PUT",
            body: JSON.stringify(patient)
        });
        cancelEdit();
    } else {
        await authFetch("/add-patient", {
            method: "POST",
            body: JSON.stringify(patient)
        });
    }
 
    form.reset();
    availabilityInput.value = "";
    feeInput.value = "";
    loadPatients();
});
 
// ─── Cancel Edit ─────────────────────────────────────────────
cancelBtn.addEventListener("click", cancelEdit);
 
function cancelEdit() {
    editIdInput.value = "";
    form.reset();
    availabilityInput.value = "";
    feeInput.value = "";
    submitBtn.textContent = "Add Patient";
    cancelBtn.style.display = "none";
    form.classList.remove("edit-mode");
}
 
// ─── Load Patients ───────────────────────────────────────────
async function loadPatients() {
    const res = await authFetch("/patients");
    allPatients = await res.json();
    renderTable(allPatients);
}
 
// ─── Render Table ────────────────────────────────────────────
function renderTable(patients) {
    table.innerHTML = "";
 
    if (patients.length === 0) {
        table.innerHTML = `<tr><td colspan="8" style="color:#aaa; padding:20px;">No patients found.</td></tr>`;
        return;
    }
 
    patients.forEach(p => {
        table.innerHTML += `
            <tr>
                <td>${p.id}</td>
                <td>${p.name}</td>
                <td>${p.age}</td>
                <td>${p.gender}</td>
                <td>${p.disease}</td>
                <td>${p.doctor_name || "N/A"}</td>
                <td>₹${p.amount}</td>
                <td>
                    <button class="btn-edit" onclick="editPatient(${p.id})">✏️ Edit</button>
                    <button class="btn-delete" onclick="deletePatient(${p.id})">🗑️ Delete</button>
                </td>
            </tr>
        `;
    });
}
 
// ─── Search ──────────────────────────────────────────────────
searchInput.addEventListener("input", function () {
    const query = this.value.toLowerCase().trim();
    const filtered = allPatients.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.disease.toLowerCase().includes(query)
    );
    renderTable(filtered);
});
 
// ─── Edit Patient ────────────────────────────────────────────
function editPatient(id) {
    const patient = allPatients.find(p => p.id === id);
    if (!patient) return;
 
    form.scrollIntoView({ behavior: "smooth" });
 
    editIdInput.value = patient.id;
    document.getElementById("name").value = patient.name;
    document.getElementById("age").value = patient.age;
    document.getElementById("gender").value = patient.gender;
    document.getElementById("disease").value = patient.disease;
    doctorSelect.value = patient.doctor_id;
 
    const selectedDoctor = doctorsData.find(doc => doc.id == patient.doctor_id);
    if (selectedDoctor) {
        availabilityInput.value = selectedDoctor.availability;
        feeInput.value = selectedDoctor.consultation_fee;
    }
 
    submitBtn.textContent = "Update Patient";
    cancelBtn.style.display = "inline-block";
    form.classList.add("edit-mode");
}
 
// ─── Delete Patient ───────────────────────────────────────────
async function deletePatient(id) {
    const confirmed = confirm("Are you sure you want to delete this patient?");
    if (!confirmed) return;
 
    await authFetch(`/delete-patient/${id}`, { method: "DELETE" });
    loadPatients();
}
 