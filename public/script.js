const form = document.getElementById("patientForm");
const doctorSelect = document.getElementById("doctorSelect");
const availabilityInput = document.getElementById("availability");
const feeInput = document.getElementById("fee");
const table = document.getElementById("patientTable");

let doctorsData = [];

window.onload = () => {
    loadDoctors();
    loadPatients();
};

// Load Doctors
async function loadDoctors() {
    const res = await fetch("/doctors");
    doctorsData = await res.json();

    doctorSelect.innerHTML = '<option value="">Select Doctor</option>';

    doctorsData.forEach(doc => {
        doctorSelect.innerHTML += `
            <option value="${doc.id}">
                ${doc.name} (${doc.specialization})
            </option>
        `;
    });
}

// When Doctor Changes
doctorSelect.addEventListener("change", function () {
    const selectedDoctor = doctorsData.find(
        doc => doc.id == this.value
    );

    if (selectedDoctor) {
        availabilityInput.value = selectedDoctor.availability;
        feeInput.value = selectedDoctor.consultation_fee;
    } else {
        availabilityInput.value = "";
        feeInput.value = "";
    }
});

// Add Patient
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

    await fetch("/add-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patient)
    });

    form.reset();
    availabilityInput.value = "";
    feeInput.value = "";
    loadPatients();
});

// Load Patients
async function loadPatients() {
    const res = await fetch("/patients");
    const data = await res.json();

    table.innerHTML = "";

    data.forEach(p => {
        table.innerHTML += `
            <tr>
                <td>${p.id}</td>
                <td>${p.name}</td>
                <td>${p.disease}</td>
                <td>${p.doctor_name || "N/A"}</td>
                <td>${p.amount}</td>
            </tr>
        `;
    });
}