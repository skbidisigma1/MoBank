async function loadAdminContent() {
    await window.auth0Promise;
    const user = await getUser();
    const roles = user && user['https://mo-bank.vercel.app/roles'] || [];

    if (!roles.includes('admin')) {
        window.location.href = '/pages/dashboard.html';
        return;
    }

    document.getElementById('admin-content').classList.remove('hidden');

    const addStudentForm = document.getElementById('add-student-form');
    addStudentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!roles.includes('admin')) {
            alert("You do not have permission to perform this action.");
            return;
        }
        const studentName = document.getElementById('student-name').value;
        alert("Student added successfully! (Implement backend logic)");
        addStudentForm.reset();
    });
}

loadAdminContent();
