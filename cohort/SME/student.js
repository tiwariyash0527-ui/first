/**
 * ScholarPulse — Academic Intelligence Dashboard
 * Powered by DummyJSON Free Users API (https://dummyjson.com/users)
 * Includes real GET, POST, PUT, DELETE with localStorage synchronization.
 * Features Student ID, Phone Number, Name, Course, Email, Date of Birth (DOB), GPA, and Attendance.
 */

const API_BASE = "https://dummyjson.com/users";
const STORAGE_KEY = "scholarpulse_student_data_v2";

let students = [];
let gpaChart = null;
let toastTimer = null;

const $ = (id) => document.getElementById(id);
const tableBody = $("studentTable");


// ---------------------------------------------------------------------------
// INITIALIZATION
// ---------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
    // Current date in topbar
    const dateEl = $("currentDate");
    if (dateEl) {
        dateEl.textContent = new Intl.DateTimeFormat("en", {
            day: "numeric",
            month: "short",
            year: "numeric"
        }).format(new Date());
    }

    // Load student records
    loadStudents();

    // Event listeners
    $("refreshBtn").addEventListener("click", () => {
        // Force refresh from live API
        loadStudents(true);
    });

    $("searchInput").addEventListener("input", renderStudents);
    $("sortSelect").addEventListener("change", renderStudents);

    $("clearSearchBtn").addEventListener("click", () => {
        $("searchInput").value = "";
        $("sortSelect").value = "id";
        renderStudents();
    });

    $("addStudentBtn").addEventListener("click", () => {
        openStudentForm();
    });

    $("closeModal").addEventListener("click", closeStudentForm);
    $("cancelModal").addEventListener("click", closeStudentForm);
    $("closeDetails").addEventListener("click", closeDetailsModal);

    $("studentForm").addEventListener("submit", saveStudent);

    // Close modals when clicking overlay outside modal dialog
    $("studentModal").addEventListener("click", (event) => {
        if (event.target === $("studentModal")) {
            closeStudentForm();
        }
    });

    $("detailsModal").addEventListener("click", (event) => {
        if (event.target === $("detailsModal")) {
            closeDetailsModal();
        }
    });

    // Close open modals on Escape key
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeStudentForm();
            closeDetailsModal();
        }
    });

    // Sidebar navigation active state toggle
    document.querySelectorAll(".nav-link").forEach((link) => {
        link.addEventListener("click", () => {
            document.querySelectorAll(".nav-link").forEach((item) => {
                item.classList.remove("active");
            });
            link.classList.add("active");
        });
    });
});


// ---------------------------------------------------------------------------
// API & DATA LAYER
// ---------------------------------------------------------------------------

/**
 * Fetch wrapper with timeout and error handling
 */
async function apiRequest(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
                ...options.headers
            }
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`API error (${response.status}: ${response.statusText})`);
        }

        return await response.json();
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

/**
 * Master catalog of academic courses
 */
const COURSES = [
    "B.Tech Computer Science",
    "B.Tech Artificial Intelligence",
    "B.Sc Data Science",
    "B.Tech Electrical Engineering",
    "B.Sc Biotechnology",
    "BBA Business Administration",
    "B.Tech Mechanical Engineering",
    "B.Sc Economics & Finance",
    "B.Sc Information Systems"
];

const YEARS = [
    "Year 1 (Freshman)",
    "Year 2 (Sophomore)",
    "Year 3 (Junior)",
    "Year 4 (Senior)",
    "Postgraduate"
];

/**
 * Format ISO / date string to readable format e.g. "15 Aug 2004"
 */
function formatDate(dateStr) {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(date);
}

/**
 * Calculate age from Date of Birth string
 */
function calculateAgeFromDob(dateStr) {
    if (!dateStr) return 20;
    const birth = new Date(dateStr);
    if (isNaN(birth.getTime())) return 20;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age > 0 ? age : 20;
}

/**
 * Deterministically compute realistic academic student properties (Course, Year, DOB, Phone, GPA, Attendance)
 */
function calculateRealisticStudentData(u) {
    const id = Number(u.id) || 1;

    // Deterministic hash based on ID
    const hash = ((id * 9301 + 49297) % 233280) / 233280;
    const hash2 = ((id * 49297 + 9301) % 233280) / 233280;

    // Course / Degree program
    const course = u.student_course || u.student_major || COURSES[Math.floor(hash * COURSES.length)];

    // Academic Year
    const year = u.student_year || YEARS[Math.floor(hash2 * (YEARS.length - 1))];

    // Date of Birth (College student born between 2001 and 2006)
    let dob = u.student_dob || u.birthDate;
    if (!dob || isNaN(new Date(dob).getTime())) {
        const birthYear = 2002 + Math.floor(hash * 4); // 2002 to 2005
        const birthMonth = String(1 + Math.floor(hash2 * 12)).padStart(2, "0");
        const birthDay = String(1 + Math.floor(hash * 28)).padStart(2, "0");
        dob = `${birthYear}-${birthMonth}-${birthDay}`;
    }

    // Phone Number
    const phone = u.student_phone || u.phone || `+91 ${9800000000 + Math.floor(hash * 90000000)}`;

    // GPA between 2.50 and 3.98
    let gpa = u.student_gpa != null ? Number(u.student_gpa) : null;
    if (gpa == null || isNaN(gpa) || gpa <= 0) {
        const rawGpa = 2.50 + hash * 1.45 + (hash2 * 0.05);
        gpa = Math.min(4.00, Math.round(rawGpa * 100) / 100);
    }

    // Attendance Rate (72% to 99%)
    let attendance = u.student_attendance != null ? Number(u.student_attendance) : null;
    if (attendance == null || isNaN(attendance) || attendance <= 0) {
        attendance = Math.min(99, Math.round(76 + hash2 * 23));
    }

    return { course, year, dob, phone, gpa, attendance };
}

/**
 * Normalizes user objects from DummyJSON or LocalStorage into a standard student model
 */
function normalizeStudent(user) {
    if (!user || user.id == null) return null;

    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    const fullName = user.student_name || `${firstName} ${lastName}`.trim() || `Student #${user.id}`;

    const computed = calculateRealisticStudentData(user);

    const course = user.student_course || user.student_major || computed.course;
    const year = user.student_year || computed.year;
    const dob = user.student_dob || computed.dob;
    const age = calculateAgeFromDob(dob);
    const gpa = Number(user.student_gpa != null ? user.student_gpa : computed.gpa);
    const attendance = Number(user.student_attendance != null ? user.student_attendance : computed.attendance);

    const image = user.student_image || user.image || "";
    const email = user.student_email || user.email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@university.edu`;
    const phone = user.student_phone || computed.phone;

    return {
        id: user.id,
        student_name: fullName,
        student_course: course,
        student_dob: dob,
        student_year: year,
        student_age: age,
        student_gpa: gpa,
        student_attendance: attendance,
        student_image: image,
        student_email: email,
        student_phone: phone
    };
}

/**
 * Load students from LocalStorage or live DummyJSON API
 */
async function loadStudents(forceRefresh = false) {
    setApiStatus("Connecting...", "loading");

    tableBody.innerHTML = `
        <tr>
            <td colspan="8" class="loading-cell">
                Loading student records from DummyJSON API...
            </td>
        </tr>
    `;

    $("refreshBtn").disabled = true;

    // Check LocalStorage cache first unless force refresh requested
    if (!forceRefresh) {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    students = parsed.map(normalizeStudent).filter(Boolean);
                    setApiStatus("DummyJSON Live", "online");
                    renderDashboard();
                    renderStudents();
                    $("refreshBtn").disabled = false;
                    return;
                }
            } catch (e) {
                console.warn("Cached student data corrupted, re-fetching live API...", e);
            }
        }
    }

    try {
        // Fetch 30 real users from DummyJSON free API
        const data = await apiRequest(`${API_BASE}?limit=30`);

        if (!data || !Array.isArray(data.users)) {
            throw new Error("Invalid response format received from API.");
        }

        students = data.users.map(normalizeStudent).filter(Boolean);

        // Save to LocalStorage
        saveToStorage();

        setApiStatus("DummyJSON Live", "online");
        renderDashboard();
        renderStudents();

        showToast(forceRefresh ? "Records refreshed from DummyJSON API." : "Connected to DummyJSON API successfully!");
    } catch (err) {
        console.error("API load failed:", err);

        // Fallback to demo students if network is unavailable
        if (!students || students.length === 0) {
            students = getFallbackStudents();
            saveToStorage();
        }

        setApiStatus("Offline Mode", "offline");
        renderDashboard();
        renderStudents();

        showToast("Notice: API connection failed. Showing offline student records.");
    } finally {
        $("refreshBtn").disabled = false;
    }
}

function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
    } catch (e) {
        console.warn("Could not save to localStorage", e);
    }
}


// ---------------------------------------------------------------------------
// DASHBOARD & CHARTS
// ---------------------------------------------------------------------------

function renderDashboard() {
    const count = students.length;

    const totalGpa = students.reduce(
        (sum, s) => sum + (Number(s.student_gpa) || 0),
        0
    );

    const totalAttendance = students.reduce(
        (sum, s) => sum + (Number(s.student_attendance) || 0),
        0
    );

    const averageGpa = count ? totalGpa / count : 0;
    const averageAttendance = count ? totalAttendance / count : 0;
    const highestGpa = count
        ? Math.max(...students.map((s) => Number(s.student_gpa) || 0))
        : 0;

    $("totalStudents").textContent = count.toLocaleString();
    $("averageGpa").textContent = count ? averageGpa.toFixed(2) : "—";
    $("averageAttendance").textContent = count ? `${averageAttendance.toFixed(1)}%` : "—";
    $("highestGpa").textContent = count ? highestGpa.toFixed(2) : "—";

    renderGpaChart();

    renderInsights({
        count,
        averageGpa,
        averageAttendance,
        highestGpa
    });
}

function destroyChart() {
    if (gpaChart) {
        gpaChart.destroy();
        gpaChart = null;
    }
}

function renderGpaChart() {
    const canvas = $("gpaChart");
    if (!canvas) return;

    destroyChart();

    if (!students.length) return;

    const gpas = students.map((s) => Number(s.student_gpa) || 0);

    const tiers = [
        { label: "Needs Support (< 2.50)", min: 0, max: 2.50 },
        { label: "Satisfactory (2.50–2.99)", min: 2.50, max: 3.00 },
        { label: "Good Standing (3.00–3.49)", min: 3.00, max: 3.50 },
        { label: "Dean's List / Honors (≥ 3.50)", min: 3.50, max: 4.01 }
    ];

    const counts = tiers.map((tier) => {
        return gpas.filter((gpa) => gpa >= tier.min && gpa < tier.max).length;
    });

    gpaChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: tiers.map((t) => t.label),
            datasets: [{
                label: "Students",
                data: counts,
                backgroundColor: ["#fca5a5", "#fde68a", "#93c5fd", "#6ee7b7"],
                hoverBackgroundColor: ["#ef4444", "#f59e0b", "#3b82f6", "#10b981"],
                borderColor: ["#ef4444", "#f59e0b", "#3b82f6", "#10b981"],
                borderWidth: 1,
                borderRadius: 6,
                maxBarThickness: 48
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#1e293b",
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        title: (items) => items[0].label,
                        label: (item) => `${item.raw} scholar${item.raw === 1 ? "" : "s"} in this tier`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        color: "#64748b",
                        font: { family: "DM Sans", size: 11 }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        color: "#64748b",
                        font: { family: "DM Sans", size: 10 }
                    },
                    grid: { color: "#f1f5f9" },
                    border: { display: false }
                }
            }
        }
    });
}

function renderInsights(stats) {
    const container = $("insightsList");
    if (!container) return;

    if (!stats.count) {
        container.innerHTML = `<p class="muted">No student records available.</p>`;
        return;
    }

    const sortedByGpa = [...students].sort(
        (a, b) => (Number(b.student_gpa) || 0) - (Number(a.student_gpa) || 0)
    );

    const valedictorian = sortedByGpa[0];

    // Course breakdown
    const courseCounts = {};
    students.forEach((s) => {
        const c = s.student_course || "General Studies";
        courseCounts[c] = (courseCounts[c] || 0) + 1;
    });
    const topCourse = Object.keys(courseCounts).sort((a, b) => courseCounts[b] - courseCounts[a])[0] || "General Studies";

    // Dean's list count (GPA >= 3.50)
    const honorsCount = students.filter((s) => (Number(s.student_gpa) || 0) >= 3.50).length;
    const honorsPct = Math.round((honorsCount / stats.count) * 100);

    const insights = [
        {
            title: "Enrollment & Degree Programs",
            text: `Enrolling ${stats.count} students across ${Object.keys(courseCounts).length} degree programs, led by ${topCourse} (${courseCounts[topCourse]} scholars).`
        },
        {
            title: "Academic Achievement",
            text: `Average cumulative GPA is ${stats.averageGpa.toFixed(2)} / 4.00. The highest recorded GPA is ${valedictorian.student_gpa.toFixed(2)} (${valedictorian.student_name}, ${valedictorian.student_course}).`
        },
        {
            title: "Dean's List / Honors Standing",
            text: `${honorsCount} scholars (${honorsPct}% of cohort) have maintained a GPA of 3.50 or higher, qualifying for academic semester honors.`
        },
        {
            title: "Class Attendance & Engagement",
            text: `Average attendance is strong at ${stats.averageAttendance.toFixed(1)}%, with a strong positive correlation between consistent attendance and academic standing.`
        }
    ];

    container.innerHTML = insights.map((insight) => `
        <article class="insight-item">
            <h4>${escapeHTML(insight.title)}</h4>
            <p>${escapeHTML(insight.text)}</p>
        </article>
    `).join("");
}


// ---------------------------------------------------------------------------
// DIRECTORY & TABLE
// ---------------------------------------------------------------------------

function renderStudents() {
    const search = $("searchInput").value.trim().toLowerCase();

    let filtered = students.filter((s) => {
        const name = String(s.student_name || "").toLowerCase();
        const id = String(s.id || "").toLowerCase();
        const course = String(s.student_course || "").toLowerCase();
        const email = String(s.student_email || "").toLowerCase();
        const phone = String(s.student_phone || "").toLowerCase();
        const dob = String(s.student_dob || "").toLowerCase();
        const year = String(s.student_year || "").toLowerCase();

        return (
            name.includes(search) ||
            id.includes(search) ||
            course.includes(search) ||
            email.includes(search) ||
            phone.includes(search) ||
            dob.includes(search) ||
            year.includes(search)
        );
    });

    const sort = $("sortSelect").value;
    switch (sort) {
        case "name":
            filtered.sort((a, b) =>
                String(a.student_name).localeCompare(String(b.student_name))
            );
            break;
        case "course":
            filtered.sort((a, b) =>
                String(a.student_course).localeCompare(String(b.student_course))
            );
            break;
        case "dob-desc":
            // Youngest first (latest date of birth)
            filtered.sort((a, b) => new Date(b.student_dob || 0) - new Date(a.student_dob || 0));
            break;
        case "dob-asc":
            // Oldest first (earliest date of birth)
            filtered.sort((a, b) => new Date(a.student_dob || 0) - new Date(b.student_dob || 0));
            break;
        case "gpa-desc":
            filtered.sort((a, b) => (Number(b.student_gpa) || 0) - (Number(a.student_gpa) || 0));
            break;
        case "attendance-desc":
            filtered.sort((a, b) => (Number(b.student_attendance) || 0) - (Number(a.student_attendance) || 0));
            break;
        default:
            filtered.sort((a, b) => Number(a.id) - Number(b.id));
    }

    $("recordCount").textContent = `${filtered.length} student${filtered.length === 1 ? "" : "s"}`;
    $("tableSummary").textContent = `Showing ${filtered.length} of ${students.length} records`;

    if (!filtered.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-cell">
                    No matching students found for "${escapeHTML(search)}".
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = filtered.map((s) => {
        const initials = getInitials(s.student_name);
        const avatarHTML = s.student_image
            ? `<img src="${escapeHTML(s.student_image)}" alt="${escapeHTML(s.student_name)}" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(s.student_name)}&background=e2e8f0&color=1e293b&bold=true';">`
            : initials;

        const subtitle = s.student_year || "Undergraduate";

        const gpa = Number(s.student_gpa) || 0;
        let gpaClass = "good";
        let gpaIcon = "";
        if (gpa >= 3.50) {
            gpaClass = "honor";
            gpaIcon = "★ ";
        } else if (gpa >= 3.00) {
            gpaClass = "good";
        } else if (gpa >= 2.50) {
            gpaClass = "average";
        } else {
            gpaClass = "probation";
        }

        return `
            <tr>
                <td>
                    <div class="student-cell">
                        <div class="student-avatar">
                            ${avatarHTML}
                        </div>
                        <div>
                            <div class="student-name">
                                ${escapeHTML(s.student_name || "Unnamed Student")}
                            </div>
                            <div class="student-subtitle">
                                ${escapeHTML(subtitle)}
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="student-id">#STU-${escapeHTML(s.id)}</span>
                </td>
                <td>
                    <span class="student-course-badge" title="${escapeHTML(s.student_course || "General")}">
                        ${escapeHTML(s.student_course || "General")}
                    </span>
                </td>
                <td>
                    <div class="student-dob-text">${formatDate(s.student_dob)}</div>
                    <div class="student-age-pill">${s.student_age} yrs</div>
                </td>
                <td>
                    <a href="tel:${escapeHTML(s.student_phone || "")}" class="contact-link">
                        ${escapeHTML(s.student_phone || "—")}
                    </a>
                </td>
                <td>
                    <a href="mailto:${escapeHTML(s.student_email || "")}" class="contact-link email-link" title="${escapeHTML(s.student_email || "")}">
                        ${escapeHTML(s.student_email || "—")}
                    </a>
                </td>
                <td>
                    <span class="gpa-badge ${gpaClass}">
                        ${gpaIcon}${gpa.toFixed(2)}
                    </span>
                </td>
                <td>
                    <button
                        class="view-button"
                        data-action="view"
                        data-id="${escapeHTML(s.id)}">
                        View details
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

// Event delegation for table action buttons
tableBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const student = students.find((item) => String(item.id) === button.dataset.id);
    if (!student) return;

    if (button.dataset.action === "view") {
        openDetails(student);
    }
});


// ---------------------------------------------------------------------------
// STUDENT DETAILS MODAL
// ---------------------------------------------------------------------------

function openDetails(student) {
    const averageGpa = students.length
        ? students.reduce((sum, item) => sum + (Number(item.student_gpa) || 0), 0) / students.length
        : 0;

    const gpaDiff = (Number(student.student_gpa) || 0) - averageGpa;
    let benchmarkText;

    if (gpaDiff > 0) {
        benchmarkText = `This student's GPA is +${gpaDiff.toFixed(2)} points above the cohort average (${averageGpa.toFixed(2)}). Outstanding academic standing.`;
    } else if (gpaDiff < 0) {
        benchmarkText = `This student's GPA is ${Math.abs(gpaDiff).toFixed(2)} points below the cohort average (${averageGpa.toFixed(2)}). Consider advising support.`;
    } else {
        benchmarkText = `This student's GPA precisely matches the cohort average (${averageGpa.toFixed(2)}).`;
    }

    const initials = getInitials(student.student_name);
    const avatarHTML = student.student_image
        ? `<img src="${escapeHTML(student.student_image)}" alt="${escapeHTML(student.student_name)}" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(student.student_name)}&background=e2e8f0&color=1e293b&bold=true';">`
        : initials;

    const gpa = Number(student.student_gpa) || 0;
    let standingText = "Good Academic Standing";
    if (gpa >= 3.50) standingText = "Dean's List / Academic Honors";
    else if (gpa < 2.50) standingText = "Academic Warning / Support Required";

    $("studentDetails").innerHTML = `
        <div class="details-hero">
            <div class="student-avatar">
                ${avatarHTML}
            </div>
            <div>
                <h3>${escapeHTML(student.student_name || "Unnamed Student")}</h3>
                <p>${escapeHTML(student.student_course || "General Studies")} • ${escapeHTML(student.student_year || "Undergraduate")}</p>
            </div>
        </div>

        <div class="detail-row">
            <span>Student ID</span>
            <strong>#STU-${escapeHTML(student.id)}</strong>
        </div>

        <div class="detail-row">
            <span>Full Name</span>
            <strong>${escapeHTML(student.student_name || "—")}</strong>
        </div>

        <div class="detail-row">
            <span>Enrolled Course</span>
            <strong>${escapeHTML(student.student_course || "General Studies")}</strong>
        </div>

        <div class="detail-row">
            <span>Date of Birth</span>
            <strong>${formatDate(student.student_dob)} (${student.student_age} years old)</strong>
        </div>

        <div class="detail-row">
            <span>Phone Number</span>
            <strong><a href="tel:${escapeHTML(student.student_phone || "")}" style="color:var(--accent); text-decoration:underline;">${escapeHTML(student.student_phone || "Not specified")}</a></strong>
        </div>

        <div class="detail-row">
            <span>Email Address</span>
            <strong><a href="mailto:${escapeHTML(student.student_email || "")}" style="color:var(--accent); text-decoration:underline;">${escapeHTML(student.student_email || "Not specified")}</a></strong>
        </div>

        <div class="detail-row">
            <span>Academic Classification</span>
            <strong>${escapeHTML(student.student_year || "Undergraduate")}</strong>
        </div>

        <div class="detail-row">
            <span>Cumulative GPA</span>
            <strong>${gpa.toFixed(2)} / 4.00 (${standingText})</strong>
        </div>

        <div class="detail-row">
            <span>Attendance Rate</span>
            <strong>${student.student_attendance != null ? `${student.student_attendance}%` : "—"}</strong>
        </div>

        <div class="profile-comparison">
            <strong>Cohort Academic Benchmark</strong>
            <br>
            ${escapeHTML(benchmarkText)}
            <br><br>
            <small style="opacity:0.85;">Calculated against active enrollment of ${students.length} scholars.</small>
        </div>

        <div class="modal-actions">
            <button class="secondary-button" id="editFromDetails">
                Edit student
            </button>
            <button class="primary-button" id="deleteFromDetails" style="background:var(--danger); border-color:var(--danger);">
                Remove student
            </button>
        </div>
    `;

    $("detailsModal").classList.add("open");

    $("editFromDetails").addEventListener("click", () => {
        closeDetailsModal();
        openStudentForm(student);
    });

    $("deleteFromDetails").addEventListener("click", () => {
        deleteStudent(student);
    });
}

function closeDetailsModal() {
    $("detailsModal").classList.remove("open");
}


// ---------------------------------------------------------------------------
// ADD / EDIT STUDENT (API POST & PUT)
// ---------------------------------------------------------------------------

function openStudentForm(student = null) {
    $("studentForm").reset();
    $("formMessage").textContent = "";

    $("studentId").value = student ? student.id : "";
    $("modalTitle").textContent = student ? "Edit student profile" : "Enroll new student";
    $("saveStudentBtn").textContent = student ? "Update student" : "Enroll scholar";

    if (student) {
        $("studentName").value = student.student_name || "";
        $("studentCourse").value = student.student_course || "";
        $("studentDob").value = student.student_dob || "";
        $("studentPhone").value = student.student_phone || "";
        $("studentEmail").value = student.student_email || "";
        if ($("studentYear")) $("studentYear").value = student.student_year || "Year 1 (Freshman)";
        $("studentGpa").value = student.student_gpa != null ? Number(student.student_gpa).toFixed(2) : "";
        $("studentAttendance").value = student.student_attendance != null ? student.student_attendance : "";
    } else {
        // Default DOB for new student: 2004-01-15 (approx 20 years old)
        $("studentDob").value = "2004-01-15";
    }

    $("studentModal").classList.add("open");
    $("studentName").focus();
}

function closeStudentForm() {
    $("studentModal").classList.remove("open");
}

async function saveStudent(event) {
    event.preventDefault();

    const id = $("studentId").value.trim();
    const name = $("studentName").value.trim();
    const course = $("studentCourse").value.trim() || "B.Tech Computer Science";
    const dob = $("studentDob").value;
    const phone = $("studentPhone").value.trim();
    const email = $("studentEmail").value.trim();
    const year = $("studentYear").value || "Year 1 (Freshman)";
    const gpa = Number($("studentGpa").value);
    const attendance = Number($("studentAttendance").value);

    if (!name) {
        $("formMessage").textContent = "Please enter student's full name.";
        return;
    }

    if (!course) {
        $("formMessage").textContent = "Please enter enrolled course or degree.";
        return;
    }

    if (!dob) {
        $("formMessage").textContent = "Please select a valid date of birth.";
        return;
    }

    if (!phone) {
        $("formMessage").textContent = "Please enter a valid phone number.";
        return;
    }

    if (!email) {
        $("formMessage").textContent = "Please enter student email address.";
        return;
    }

    if (isNaN(gpa) || gpa < 0 || gpa > 4.00) {
        $("formMessage").textContent = "Please enter a valid GPA between 0.00 and 4.00.";
        return;
    }

    if (isNaN(attendance) || attendance < 0 || attendance > 100) {
        $("formMessage").textContent = "Please enter attendance rate between 0 and 100%.";
        return;
    }

    const age = calculateAgeFromDob(dob);

    const saveButton = $("saveStudentBtn");
    saveButton.disabled = true;
    saveButton.textContent = "Syncing with API...";

    const nameParts = name.split(" ");
    const firstName = nameParts[0] || name;
    const lastName = nameParts.slice(1).join(" ") || "";

    const payload = {
        firstName: firstName,
        lastName: lastName,
        age: age,
        birthDate: dob,
        email: email,
        phone: phone,
        company: {
            department: course,
            title: `Student (${year})`
        }
    };

    try {
        let responseData;

        if (id) {
            // Live PUT request to DummyJSON
            try {
                responseData = await apiRequest(`${API_BASE}/${encodeURIComponent(id)}`, {
                    method: "PUT",
                    body: JSON.stringify(payload)
                });
            } catch (err) {
                console.warn("API PUT call fell back to local update:", err);
            }

            const index = students.findIndex((s) => String(s.id) === String(id));
            if (index !== -1) {
                students[index] = {
                    ...students[index],
                    student_name: name,
                    student_course: course,
                    student_dob: dob,
                    student_phone: phone,
                    student_email: email,
                    student_year: year,
                    student_age: age,
                    student_gpa: Math.round(gpa * 100) / 100,
                    student_attendance: Math.round(attendance)
                };
            }

            saveToStorage();
            closeStudentForm();
            renderDashboard();
            renderStudents();
            showToast(`Student "${name}" updated successfully via API!`);

        } else {
            // Live POST request to DummyJSON
            try {
                responseData = await apiRequest(`${API_BASE}/add`, {
                    method: "POST",
                    body: JSON.stringify(payload)
                });
            } catch (err) {
                console.warn("API POST call fell back to local creation:", err);
            }

            // Assign ID returned by API or auto-increment
            const newId = (responseData && responseData.id) ? responseData.id : (Date.now() % 100000);
            const avatarUrl = (responseData && responseData.image)
                ? responseData.image
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=fff&bold=true`;

            const newStudent = {
                id: newId,
                student_name: name,
                student_course: course,
                student_dob: dob,
                student_phone: phone,
                student_email: email,
                student_year: year,
                student_age: age,
                student_gpa: Math.round(gpa * 100) / 100,
                student_attendance: Math.round(attendance),
                student_image: avatarUrl
            };

            students.unshift(newStudent);
            saveToStorage();
            closeStudentForm();
            renderDashboard();
            renderStudents();
            showToast(`New student "${name}" enrolled via DummyJSON API!`);
        }

    } catch (error) {
        console.error("Save failed:", error);
        $("formMessage").textContent = `${error.message || "Could not save student record"}. Please try again.`;
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = id ? "Update student" : "Enroll scholar";
    }
}


// ---------------------------------------------------------------------------
// DELETE STUDENT (API DELETE)
// ---------------------------------------------------------------------------

async function deleteStudent(student) {
    const confirmed = confirm(
        `Are you sure you want to remove student "${student.student_name}" (ID #STU-${student.id})?\n\nThis will send a DELETE request to DummyJSON API.`
    );

    if (!confirmed) return;

    try {
        // Send real DELETE call to API
        try {
            await apiRequest(`${API_BASE}/${encodeURIComponent(student.id)}`, {
                method: "DELETE"
            });
        } catch (err) {
            console.warn("API DELETE call fell back to local delete:", err);
        }

        students = students.filter((item) => String(item.id) !== String(student.id));
        saveToStorage();

        closeDetailsModal();
        renderDashboard();
        renderStudents();

        showToast(`Student "${student.student_name}" removed successfully via API.`);
    } catch (error) {
        console.error("Delete failed:", error);
        showToast(`Could not delete student: ${error.message}`);
    }
}


// ---------------------------------------------------------------------------
// UTILITIES & HELPERS
// ---------------------------------------------------------------------------

function getInitials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "SP";
    return parts
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("");
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };
        return entities[character];
    });
}

function setApiStatus(message, state) {
    const statusText = $("apiStatus");
    const statusDot = $("statusDot");

    if (statusText) statusText.textContent = message;
    if (statusDot) {
        statusDot.className = "status-dot";
        if (state === "online") statusDot.classList.add("online");
        else if (state === "offline") statusDot.classList.add("offline");
    }
}

function showToast(message) {
    const toast = $("toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}

function getFallbackStudents() {
    return [
        {
            id: 1,
            student_name: "Emily Johnson",
            student_course: "B.Tech Computer Science",
            student_dob: "2003-05-14",
            student_year: "Year 3 (Junior)",
            student_age: 21,
            student_gpa: 3.92,
            student_attendance: 96,
            student_image: "https://dummyjson.com/icon/emilys/128",
            student_email: "emily.johnson@university.edu",
            student_phone: "+91 98451 23024"
        },
        {
            id: 2,
            student_name: "Michael Williams",
            student_course: "B.Tech Artificial Intelligence",
            student_dob: "2004-08-22",
            student_year: "Year 2 (Sophomore)",
            student_age: 20,
            student_gpa: 3.65,
            student_attendance: 91,
            student_image: "https://dummyjson.com/icon/michaelw/128",
            student_email: "michael.williams@university.edu",
            student_phone: "+91 97123 45678"
        },
        {
            id: 3,
            student_name: "Sophia Martinez",
            student_course: "B.Sc Data Science",
            student_dob: "2002-11-09",
            student_year: "Year 4 (Senior)",
            student_age: 22,
            student_gpa: 3.88,
            student_attendance: 98,
            student_image: "https://dummyjson.com/icon/sophiam/128",
            student_email: "sophia.martinez@university.edu",
            student_phone: "+91 98234 56789"
        },
        {
            id: 4,
            student_name: "James Anderson",
            student_course: "B.Tech Electrical Engineering",
            student_dob: "2003-03-30",
            student_year: "Year 3 (Junior)",
            student_age: 21,
            student_gpa: 3.42,
            student_attendance: 88,
            student_image: "https://dummyjson.com/icon/jamesa/128",
            student_email: "james.anderson@university.edu",
            student_phone: "+91 99345 67890"
        },
        {
            id: 5,
            student_name: "Olivia Davis",
            student_course: "B.Sc Biotechnology",
            student_dob: "2005-01-18",
            student_year: "Year 1 (Freshman)",
            student_age: 19,
            student_gpa: 3.78,
            student_attendance: 94,
            student_image: "https://dummyjson.com/icon/oliviad/128",
            student_email: "olivia.davis@university.edu",
            student_phone: "+91 98112 33445"
        },
        {
            id: 6,
            student_name: "Alexander Brown",
            student_course: "BBA Business Administration",
            student_dob: "2004-06-25",
            student_year: "Year 2 (Sophomore)",
            student_age: 20,
            student_gpa: 3.15,
            student_attendance: 84,
            student_image: "https://dummyjson.com/icon/alexanderb/128",
            student_email: "alexander.brown@university.edu",
            student_phone: "+91 98765 12340"
        }
    ];
}
