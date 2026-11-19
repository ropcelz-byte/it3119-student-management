import './style.css';
import { supabase } from './supabaseClient.js';

// AUTH ELEMENTS
const authForm = document.querySelector('#auth-form');
const emailInput = document.querySelector('#auth-email');
const passwordInput = document.querySelector('#auth-password');
const signupButton = document.querySelector('#signup-button');
const signoutButton = document.querySelector('#signout-button');
const signinButton = document.querySelector('#signin-button');
const authStatus = document.querySelector('#auth-status');

// STUDENT RECORD ELEMENTS
const recordsPanel = document.querySelector('#records-panel');
const studentForm = document.querySelector('#student-form');
const studentId = document.querySelector('#student-id');
const studentNo = document.querySelector('#student-no');
const fullName = document.querySelector('#full-name');
const studentEmail = document.querySelector('#student-email');
const appStatus = document.querySelector('#app-status');
const studentList = document.querySelector('#student-list');

let currentUser = null;

// DISPLAY MESSAGE
function showMessage(element, message) {
    element.textContent = message;
}

// CLEAR STUDENT FORM
function clearStudentForm() {
    studentForm.reset();
    studentId.value = '';
}

// LOAD STUDENT RECORDS
async function loadStudents() {
    if (!currentUser) return;

    showMessage(appStatus, 'Loading records...');

    const { data, error } = await supabase
        .from('students')
        .select('id, student_no, full_name, email, created_at')
        .order('full_name');

    if (error) {
        showMessage(appStatus, `Could not load records: ${error.message}`);
        return;
    }

    studentList.replaceChildren();

    if (!data || data.length === 0) {
        showMessage(appStatus, 'No records yet. Add your first test record.');
        return;
    }

    for (const student of data) {
        const li = document.createElement('li');
        const details = document.createElement('span');

        details.textContent =
            `${student.student_no} — ${student.full_name}` +
            (student.email ? ` (${student.email})` : '');

        li.append(details);

        // EDIT BUTTON
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.textContent = 'Edit';

        editButton.addEventListener('click', () => {
            studentId.value = student.id;
            studentNo.value = student.student_no;
            fullName.value = student.full_name;
            studentEmail.value = student.email || '';

            showMessage(appStatus, 'Editing selected record.');
            studentNo.focus();
        });

        // DELETE BUTTON
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.textContent = 'Delete';

        deleteButton.addEventListener('click', async () => {
            if (!confirm(`Delete ${student.full_name}? This cannot be undone.`)) {
                return;
            }

            const { error: deleteError } = await supabase
                .from('students')
                .delete()
                .eq('id', student.id);

            if (deleteError) {
                showMessage(appStatus, `Delete failed: ${deleteError.message}`);
            } else {
                showMessage(appStatus, 'Record deleted.');
                await loadStudents();
            }
        });

        li.append(' ', editButton, ' ', deleteButton);
        studentList.append(li);
    }

    showMessage(appStatus, `${data.length} record(s) loaded.`);
}

// UPDATE LOGIN SESSION
async function updateSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        showMessage(authStatus, error.message);
        return;
    }

    currentUser = data.session?.user ?? null;

    recordsPanel.hidden = !currentUser;
    signoutButton.hidden = !currentUser;
    signupButton.hidden = !!currentUser;
    signinButton.hidden = !!currentUser;

    emailInput.disabled = !!currentUser;
    passwordInput.disabled = !!currentUser;

    if (currentUser) {
        showMessage(authStatus, `Signed in as ${currentUser.email}`);
        await loadStudents();
    } else {
        showMessage(authStatus, 'Sign in or create a test account to continue.');
        studentList.replaceChildren();
        showMessage(appStatus, '');
    }
}

// SIGN IN
authForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const { error } = await supabase.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passwordInput.value
    });

    if (error) {
        showMessage(authStatus, `Sign in failed: ${error.message}`);
        return;
    }

    showMessage(authStatus, 'Signed in successfully.');
    await updateSession();
});

// SIGN UP
signupButton.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage(authStatus, 'Please enter your email and password.');
        return;
    }

    if (password.length < 6) {
        showMessage(authStatus, 'Password must be at least 6 characters.');
        return;
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password
    });

    if (error) {
        showMessage(authStatus, `Sign up failed: ${error.message}`);
        return;
    }

    if (data.session) {
        showMessage(authStatus, 'Account created successfully.');
        await updateSession();
    } else {
        showMessage(
            authStatus,
            'Account created! Please check your email to confirm your account.'
        );
    }
});

// SIGN OUT
signoutButton.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
        showMessage(authStatus, `Sign out failed: ${error.message}`);
        return;
    }

    currentUser = null;
    clearStudentForm();
    showMessage(authStatus, 'Signed out successfully.');

    await updateSession();
});

// ADD OR UPDATE STUDENT
studentForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!currentUser) {
        showMessage(appStatus, 'Please sign in first.');
        return;
    }

    const studentData = {
        student_no: studentNo.value.trim(),
        full_name: fullName.value.trim(),
        email: studentEmail.value.trim() || null
    };

    if (!studentData.student_no || !studentData.full_name) {
        showMessage(appStatus, 'Please complete the required fields.');
        return;
    }

    let result;

    if (studentId.value) {
        // UPDATE EXISTING RECORD
        result = await supabase
            .from('students')
            .update(studentData)
            .eq('id', studentId.value);
    } else {
        // INSERT NEW RECORD
        result = await supabase
            .from('students')
            .insert([studentData]);
    }

    if (result.error) {
        showMessage(appStatus, `Save failed: ${result.error.message}`);
        return;
    }

    showMessage(
        appStatus,
        studentId.value ? 'Student updated successfully.' : 'Student added successfully.'
    );

    clearStudentForm();
    await loadStudents();
});

// INITIALIZE APPLICATION
updateSession();

// LISTEN FOR AUTH CHANGES
supabase.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user ?? null;

    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        updateSession();
    }
});
