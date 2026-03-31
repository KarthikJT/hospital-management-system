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
 
window.onload = () => {
    loadDoctors();
    loadPatients();
};
 
// ─── Load Doctors ────────────────────────────────────────────
async function loadDoctors() {
    const res = await fetch("/doctors");
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
 
// ─── Add / Edit Patient (form submit) ────────────────────────
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
        // UPDATE existing patient
        await fetch(`/update-patient/${editId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patient)
        });
        cancelEdit();
    } else {
        // ADD new patient
        await fetch("/add-patient", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
    const res = await fetch("/patients");
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
 
    // Scroll to form
    form.scrollIntoView({ behavior: "smooth" });
 
    // Fill form fields
    editIdInput.value = patient.id;
    document.getElementById("name").value = patient.name;
    document.getElementById("age").value = patient.age;
    document.getElementById("gender").value = patient.gender;
    document.getElementById("disease").value = patient.disease;
    doctorSelect.value = patient.doctor_id;
 
    // Trigger doctor change to fill availability & fee
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
 
    await fetch(`/delete-patient/${id}`, { method: "DELETE" });
    loadPatients();
}
 