const form = document.getElementById("patientForm");
const table = document.getElementById("patientTable");

window.onload = loadPatients;

// ➕ Add Patient
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const patient = {
        name: document.getElementById("name").value,
        age: document.getElementById("age").value,
        gender: document.getElementById("gender").value,
        disease: document.getElementById("disease").value
    };

    await fetch("/add-patient", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(patient)
    });

    form.reset();
    loadPatients();
});

// 📄 Load Patients
async function loadPatients() {
    const response = await fetch("/patients");
    const data = await response.json();

    table.innerHTML = "";

    data.forEach(patient => {
        table.innerHTML += `
            <tr>
                <td>${patient.id}</td>
                <td>${patient.name}</td>
                <td>${patient.age}</td>
                <td>${patient.gender}</td>
                <td>${patient.disease}</td>
                <td>
                    <button onclick="deletePatient(${patient.id})">Delete</button>
                </td>
            </tr>
        `;
    });
}

// ❌ Delete Patient
async function deletePatient(id) {
    await fetch(`/delete-patient/${id}`, {
        method: "DELETE"
    });

    loadPatients();
}