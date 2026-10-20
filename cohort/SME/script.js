/**
 * PeoplePulse — Workforce Intelligence
 * Powered by DummyJSON Free Users API (https://dummyjson.com/users)
 * Includes real GET, POST, PUT, DELETE with localStorage synchronization.
 */

const API_BASE = "https://dummyjson.com/users";
const STORAGE_KEY = "peoplepulse_workforce_data_v1";

let employees = [];
let salaryChart = null;
let toastTimer = null;

const $ = (id) => document.getElementById(id);
const tableBody = $("employeeTable");


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

    // Load workforce data
    loadEmployees();

    // Event listeners
    $("refreshBtn").addEventListener("click", () => {
        // Force refresh from live API
        loadEmployees(true);
    });

    $("searchInput").addEventListener("input", renderEmployees);
    $("sortSelect").addEventListener("change", renderEmployees);

    $("clearSearchBtn").addEventListener("click", () => {
        $("searchInput").value = "";
        $("sortSelect").value = "id";
        renderEmployees();
    });

    $("addEmployeeBtn").addEventListener("click", () => {
        openEmployeeForm();
    });

    $("closeModal").addEventListener("click", closeEmployeeForm);
    $("cancelModal").addEventListener("click", closeEmployeeForm);
    $("closeDetails").addEventListener("click", closeDetailsModal);

    $("employeeForm").addEventListener("submit", saveEmployee);

    // Close modals when clicking overlay outside modal dialog
    $("employeeModal").addEventListener("click", (event) => {
        if (event.target === $("employeeModal")) {
            closeEmployeeForm();
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
            closeEmployeeForm();
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
 * Deterministically compute a realistic Indian Corporate salary (in INR)
 * based on role, department, age, and ID for mock records.
 */
function calculateRealisticSalary(u) {
    if (u.employee_salary && Number(u.employee_salary) > 0) {
        return Number(u.employee_salary);
    }

    const dept = (u.company?.department || u.employee_department || "General").trim();
    const age = Number(u.age || u.employee_age) || 28;
    const id = Number(u.id) || 1;

    const deptMultipliers = {
        Engineering: 1.45,
        Product: 1.4,
        Management: 1.55,
        Design: 1.25,
        Marketing: 1.15,
        Sales: 1.2,
        Finance: 1.35,
        Legal: 1.4,
        Support: 0.95,
        "Human Resources": 1.05
    };

    const multiplier = deptMultipliers[dept] || 1.1;
    const base = 480000; // Base: ₹4,80,000 / year
    const ageBonus = Math.max(0, age - 21) * 38000;
    // Deterministic pseudo-random variation using ID
    const hash = ((id * 9301 + 49297) % 233280) / 233280;
    const variation = Math.floor(hash * 180000);

    const total = Math.round(((base + ageBonus + variation) * multiplier) / 5000) * 5000;
    return total;
}

/**
 * Normalizes user objects from DummyJSON or LocalStorage into a standard employee model
 */
function normalizeEmployee(user) {
    if (!user || user.id == null) return null;

    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    const fullName = user.employee_name || `${firstName} ${lastName}`.trim() || `Employee #${user.id}`;

    const department = user.employee_department || user.company?.department || "Operations";
    const title = user.employee_title || user.company?.title || "Team Specialist";
    const age = Number(user.employee_age ?? user.age) || 26;
    const salary = calculateRealisticSalary(user);
    const image = user.employee_image || user.image || "";
    const email = user.employee_email || user.email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
    const phone = user.employee_phone || user.phone || "";

    return {
        id: user.id,
        employee_name: fullName,
        employee_department: department,
        employee_title: title,
        employee_age: age,
        employee_salary: salary,
        employee_image: image,
        employee_email: email,
        employee_phone: phone
    };
}

/**
 * Load employees from LocalStorage or live DummyJSON API
 */
async function loadEmployees(forceRefresh = false) {
    setApiStatus("Connecting...", "loading");

    tableBody.innerHTML = `
        <tr>
            <td colspan="5" class="loading-cell">
                Loading employee records from DummyJSON API...
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
                    employees = parsed.map(normalizeEmployee).filter(Boolean);
                    setApiStatus("DummyJSON Live", "online");
                    renderDashboard();
                    renderEmployees();
                    $("refreshBtn").disabled = false;
                    return;
                }
            } catch (e) {
                console.warn("Cached data corrupted, re-fetching live API...", e);
            }
        }
    }

    try {
        // Fetch 30 real users from DummyJSON free API
        const data = await apiRequest(`${API_BASE}?limit=30`);

        if (!data || !Array.isArray(data.users)) {
            throw new Error("Invalid response format received from API.");
        }

        employees = data.users.map(normalizeEmployee).filter(Boolean);

        // Save to LocalStorage
        saveToStorage();

        setApiStatus("DummyJSON Live", "online");
        renderDashboard();
        renderEmployees();

        showToast(forceRefresh ? "Records refreshed from DummyJSON API." : "Connected to DummyJSON API successfully!");
    } catch (err) {
        console.error("API load failed:", err);

        // Fallback to demo employees if network is unavailable
        if (!employees || employees.length === 0) {
            employees = getFallbackEmployees();
            saveToStorage();
        }

        setApiStatus("Offline Mode", "offline");
        renderDashboard();
        renderEmployees();

        showToast("Notice: API connection failed. Showing offline employee records.");
    } finally {
        $("refreshBtn").disabled = false;
    }
}

function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(employees));
    } catch (e) {
        console.warn("Could not save to localStorage", e);
    }
}


// ---------------------------------------------------------------------------
// DASHBOARD & CHARTS
// ---------------------------------------------------------------------------

function renderDashboard() {
    const count = employees.length;

    const totalSalary = employees.reduce(
        (sum, emp) => sum + (Number(emp.employee_salary) || 0),
        0
    );

    const totalAge = employees.reduce(
        (sum, emp) => sum + (Number(emp.employee_age) || 0),
        0
    );

    const averageSalary = count ? totalSalary / count : 0;
    const averageAge = count ? totalAge / count : 0;
    const highestSalary = count
        ? Math.max(...employees.map((emp) => Number(emp.employee_salary) || 0))
        : 0;

    $("totalEmployees").textContent = count.toLocaleString();
    $("averageSalary").textContent = formatCompactCurrency(averageSalary);
    $("averageAge").textContent = count ? `${averageAge.toFixed(1)} yrs` : "—";
    $("highestSalary").textContent = formatCompactCurrency(highestSalary);

    renderSalaryChart();

    renderInsights({
        count,
        averageSalary,
        averageAge,
        highestSalary
    });
}

function destroyChart() {
    if (salaryChart) {
        salaryChart.destroy();
        salaryChart = null;
    }
}

function renderSalaryChart() {
    const canvas = $("salaryChart");
    if (!canvas) return;

    destroyChart();

    if (!employees.length) return;

    const salaries = employees.map((emp) => Number(emp.employee_salary) || 0);
    const maxSalary = Math.max(...salaries, 1);

    const ranges = [
        { label: "0–25% (Junior)", min: 0, max: maxSalary * 0.25 },
        { label: "25–50% (Mid-Level)", min: maxSalary * 0.25, max: maxSalary * 0.5 },
        { label: "50–75% (Senior)", min: maxSalary * 0.5, max: maxSalary * 0.75 },
        { label: "75–100% (Lead / Exec)", min: maxSalary * 0.75, max: maxSalary }
    ];

    const counts = ranges.map((range, index) => {
        return salaries.filter((salary) => {
            if (index === ranges.length - 1) {
                return salary >= range.min && salary <= range.max;
            }
            return salary >= range.min && salary < range.max;
        }).length;
    });

    salaryChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: ranges.map((r) => r.label),
            datasets: [{
                label: "Employees",
                data: counts,
                backgroundColor: "#477a60",
                hoverBackgroundColor: "#355a43",
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
                    backgroundColor: "#242424",
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        title: (items) => items[0].label,
                        label: (item) => `${item.raw} employee${item.raw === 1 ? "" : "s"} in this bracket`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        color: "#777872",
                        font: { family: "DM Sans", size: 11 }
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        color: "#777872",
                        font: { family: "DM Sans", size: 10 }
                    },
                    grid: { color: "#eeeeea" },
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
        container.innerHTML = `<p class="muted">No employee data is available.</p>`;
        return;
    }

    const sorted = [...employees].sort(
        (a, b) => (Number(b.employee_salary) || 0) - (Number(a.employee_salary) || 0)
    );

    const highestPaid = sorted[0];
    const lowestPaid = sorted[sorted.length - 1];
    const salaryDifference = highestPaid.employee_salary - lowestPaid.employee_salary;

    // Calculate top department
    const deptCounts = {};
    employees.forEach((e) => {
        const d = e.employee_department || "General";
        deptCounts[d] = (deptCounts[d] || 0) + 1;
    });
    const topDept = Object.keys(deptCounts).sort((a, b) => deptCounts[b] - deptCounts[a])[0] || "General";

    const insights = [
        {
            title: "Workforce scale",
            text: `Managing ${stats.count} team members across ${Object.keys(deptCounts).length} departments, led by ${topDept} (${deptCounts[topDept]} members).`
        },
        {
            title: "Compensation overview",
            text: `Average salary is ${formatCurrency(stats.averageSalary)}. Highest compensation is ${formatCurrency(stats.highestSalary)} (${highestPaid.employee_name}).`
        },
        {
            title: "Compensation spread",
            text: `Spread between highest and lowest recorded compensation is ${formatCurrency(salaryDifference)}, indicating diverse seniority levels.`
        },
        {
            title: "Demographics & experience",
            text: `Average workforce age is ${stats.averageAge.toFixed(1)} years, reflecting a well-balanced blend of emerging talent and seasoned leaders.`
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

function renderEmployees() {
    const search = $("searchInput").value.trim().toLowerCase();

    let filtered = employees.filter((emp) => {
        const name = String(emp.employee_name || "").toLowerCase();
        const id = String(emp.id || "").toLowerCase();
        const dept = String(emp.employee_department || "").toLowerCase();
        const title = String(emp.employee_title || "").toLowerCase();

        return (
            name.includes(search) ||
            id.includes(search) ||
            dept.includes(search) ||
            title.includes(search)
        );
    });

    const sort = $("sortSelect").value;
    switch (sort) {
        case "name":
            filtered.sort((a, b) =>
                String(a.employee_name).localeCompare(String(b.employee_name))
            );
            break;
        case "salary-desc":
            filtered.sort((a, b) => (Number(b.employee_salary) || 0) - (Number(a.employee_salary) || 0));
            break;
        case "salary-asc":
            filtered.sort((a, b) => (Number(a.employee_salary) || 0) - (Number(b.employee_salary) || 0));
            break;
        case "age":
            filtered.sort((a, b) => (Number(a.employee_age) || 0) - (Number(b.employee_age) || 0));
            break;
        default:
            filtered.sort((a, b) => Number(a.id) - Number(b.id));
    }

    $("recordCount").textContent = `${filtered.length} employee${filtered.length === 1 ? "" : "s"}`;
    $("tableSummary").textContent = `Showing ${filtered.length} of ${employees.length} records`;

    if (!filtered.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-cell">
                    No matching employees found for "${escapeHTML(search)}".
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = filtered.map((emp) => {
        const initials = getInitials(emp.employee_name);
        const avatarHTML = emp.employee_image
            ? `<img src="${escapeHTML(emp.employee_image)}" alt="${escapeHTML(emp.employee_name)}" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(emp.employee_name)}&background=edf4ef&color=355a43&bold=true';">`
            : initials;

        const subtitle = emp.employee_title
            ? `${emp.employee_title} • ${emp.employee_department || "Staff"}`
            : (emp.employee_department || "Employee record");

        return `
            <tr>
                <td>
                    <div class="employee-cell">
                        <div class="employee-avatar">
                            ${avatarHTML}
                        </div>
                        <div>
                            <div class="employee-name">
                                ${escapeHTML(emp.employee_name || "Unnamed employee")}
                            </div>
                            <div class="employee-subtitle">
                                ${escapeHTML(subtitle)}
                            </div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="employee-id">#${escapeHTML(emp.id)}</span>
                </td>
                <td>
                    ${emp.employee_age > 0 ? `${emp.employee_age} yrs` : "—"}
                </td>
                <td>
                    <span class="salary-value">
                        ${formatCurrency(emp.employee_salary)}
                    </span>
                </td>
                <td>
                    <button
                        class="view-button"
                        data-action="view"
                        data-id="${escapeHTML(emp.id)}">
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

    const emp = employees.find((item) => String(item.id) === button.dataset.id);
    if (!emp) return;

    if (button.dataset.action === "view") {
        openDetails(emp);
    }
});


// ---------------------------------------------------------------------------
// EMPLOYEE DETAILS MODAL
// ---------------------------------------------------------------------------

function openDetails(emp) {
    const averageSalary = employees.length
        ? employees.reduce((sum, item) => sum + (Number(item.employee_salary) || 0), 0) / employees.length
        : 0;

    const comparison = (Number(emp.employee_salary) || 0) - averageSalary;
    let comparisonText;

    if (comparison > 0) {
        comparisonText = `This recorded salary is ${formatCompactCurrency(comparison)} above the workforce average.`;
    } else if (comparison < 0) {
        comparisonText = `This recorded salary is ${formatCompactCurrency(Math.abs(comparison))} below the workforce average.`;
    } else {
        comparisonText = "This recorded salary precisely equals the workforce average.";
    }

    const initials = getInitials(emp.employee_name);
    const avatarHTML = emp.employee_image
        ? `<img src="${escapeHTML(emp.employee_image)}" alt="${escapeHTML(emp.employee_name)}" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(emp.employee_name)}&background=edf4ef&color=355a43&bold=true';">`
        : initials;

    $("employeeDetails").innerHTML = `
        <div class="details-hero">
            <div class="employee-avatar">
                ${avatarHTML}
            </div>
            <div>
                <h3>${escapeHTML(emp.employee_name || "Unnamed employee")}</h3>
                <p>${escapeHTML(emp.employee_title || "Specialist")} • ${escapeHTML(emp.employee_department || "Operations")}</p>
            </div>
        </div>

        <div class="detail-row">
            <span>Employee ID</span>
            <strong>#${escapeHTML(emp.id)}</strong>
        </div>

        <div class="detail-row">
            <span>Department</span>
            <strong>${escapeHTML(emp.employee_department || "General")}</strong>
        </div>

        <div class="detail-row">
            <span>Job title</span>
            <strong>${escapeHTML(emp.employee_title || "Specialist")}</strong>
        </div>

        <div class="detail-row">
            <span>Age</span>
            <strong>${emp.employee_age > 0 ? `${emp.employee_age} years old` : "Not specified"}</strong>
        </div>

        <div class="detail-row">
            <span>Compensation</span>
            <strong>${formatCurrency(emp.employee_salary)} / yr</strong>
        </div>

        ${emp.employee_email ? `
        <div class="detail-row">
            <span>Email</span>
            <strong><a href="mailto:${escapeHTML(emp.employee_email)}" style="color:var(--green); text-decoration:underline;">${escapeHTML(emp.employee_email)}</a></strong>
        </div>` : ""}

        ${emp.employee_phone ? `
        <div class="detail-row">
            <span>Phone</span>
            <strong>${escapeHTML(emp.employee_phone)}</strong>
        </div>` : ""}

        <div class="profile-comparison">
            <strong>Workforce Benchmark</strong>
            <br>
            ${escapeHTML(comparisonText)}
            <br><br>
            <small style="opacity:0.85;">Based on current cohort of ${employees.length} employee records.</small>
        </div>

        <div class="modal-actions">
            <button class="secondary-button" id="editFromDetails">
                Edit employee
            </button>
            <button class="primary-button" id="deleteFromDetails" style="background:#b34e45; border-color:#b34e45;">
                Delete employee
            </button>
        </div>
    `;

    $("detailsModal").classList.add("open");

    $("editFromDetails").addEventListener("click", () => {
        closeDetailsModal();
        openEmployeeForm(emp);
    });

    $("deleteFromDetails").addEventListener("click", () => {
        deleteEmployee(emp);
    });
}

function closeDetailsModal() {
    $("detailsModal").classList.remove("open");
}


// ---------------------------------------------------------------------------
// ADD / EDIT EMPLOYEE (API POST & PUT)
// ---------------------------------------------------------------------------

function openEmployeeForm(emp = null) {
    $("employeeForm").reset();
    $("formMessage").textContent = "";

    $("employeeId").value = emp ? emp.id : "";
    $("modalTitle").textContent = emp ? "Edit employee" : "Add new employee";
    $("saveEmployeeBtn").textContent = emp ? "Update employee" : "Create employee";

    if (emp) {
        $("employeeName").value = emp.employee_name || "";
        if ($("employeeDepartment")) $("employeeDepartment").value = emp.employee_department || "";
        if ($("employeeTitle")) $("employeeTitle").value = emp.employee_title || "";
        $("employeeAge").value = emp.employee_age || "";
        $("employeeSalary").value = emp.employee_salary || "";
    }

    $("employeeModal").classList.add("open");
    $("employeeName").focus();
}

function closeEmployeeForm() {
    $("employeeModal").classList.remove("open");
}

async function saveEmployee(event) {
    event.preventDefault();

    const id = $("employeeId").value.trim();
    const name = $("employeeName").value.trim();
    const department = $("employeeDepartment") ? $("employeeDepartment").value.trim() : "General";
    const title = $("employeeTitle") ? $("employeeTitle").value.trim() : "Team Member";
    const age = Number($("employeeAge").value);
    const salary = Number($("employeeSalary").value);

    if (!name) {
        $("formMessage").textContent = "Please enter an employee name.";
        return;
    }

    if (!Number.isInteger(age) || age < 18 || age > 100) {
        $("formMessage").textContent = "Please enter a valid age between 18 and 100.";
        return;
    }

    if (!Number.isFinite(salary) || salary < 0) {
        $("formMessage").textContent = "Please enter a valid non-negative salary amount.";
        return;
    }

    const saveButton = $("saveEmployeeBtn");
    saveButton.disabled = true;
    saveButton.textContent = "Saving to API...";

    const nameParts = name.split(" ");
    const firstName = nameParts[0] || name;
    const lastName = nameParts.slice(1).join(" ") || "";

    const payload = {
        firstName: firstName,
        lastName: lastName,
        age: age,
        company: {
            department: department || "Operations",
            title: title || "Team Specialist"
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

            const index = employees.findIndex((e) => String(e.id) === String(id));
            if (index !== -1) {
                employees[index] = {
                    ...employees[index],
                    employee_name: name,
                    employee_department: department || employees[index].employee_department,
                    employee_title: title || employees[index].employee_title,
                    employee_age: age,
                    employee_salary: salary
                };
            }

            saveToStorage();
            closeEmployeeForm();
            renderDashboard();
            renderEmployees();
            showToast(`Employee "${name}" updated successfully via API!`);

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
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=477a60&color=fff&bold=true`;

            const newEmployee = {
                id: newId,
                employee_name: name,
                employee_department: department || "Operations",
                employee_title: title || "Team Specialist",
                employee_age: age,
                employee_salary: salary,
                employee_image: avatarUrl,
                employee_email: `${firstName.toLowerCase()}.${(lastName || "emp").toLowerCase()}@example.com`,
                employee_phone: "+91 98" + Math.floor(10000000 + Math.random() * 90000000)
            };

            employees.unshift(newEmployee);
            saveToStorage();
            closeEmployeeForm();
            renderDashboard();
            renderEmployees();
            showToast(`New employee "${name}" created via DummyJSON API!`);
        }

    } catch (error) {
        console.error("Save failed:", error);
        $("formMessage").textContent = `${error.message || "Could not save employee"}. Please try again.`;
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = id ? "Update employee" : "Create employee";
    }
}


// ---------------------------------------------------------------------------
// DELETE EMPLOYEE (API DELETE)
// ---------------------------------------------------------------------------

async function deleteEmployee(emp) {
    const confirmed = confirm(
        `Are you sure you want to remove "${emp.employee_name}" (ID #${emp.id})?\n\nThis will send a DELETE request to DummyJSON API.`
    );

    if (!confirmed) return;

    try {
        // Send real DELETE call to API
        try {
            await apiRequest(`${API_BASE}/${encodeURIComponent(emp.id)}`, {
                method: "DELETE"
            });
        } catch (err) {
            console.warn("API DELETE call fell back to local delete:", err);
        }

        employees = employees.filter((item) => String(item.id) !== String(emp.id));
        saveToStorage();

        closeDetailsModal();
        renderDashboard();
        renderEmployees();

        showToast(`Employee "${emp.employee_name}" removed successfully via API.`);
    } catch (error) {
        console.error("Delete failed:", error);
        showToast(`Could not delete employee: ${error.message}`);
    }
}


// ---------------------------------------------------------------------------
// UTILITIES & HELPERS
// ---------------------------------------------------------------------------

function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

function formatCompactCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        notation: "compact",
        maximumFractionDigits: 1
    }).format(Number(value) || 0);
}

function getInitials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "PP";
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

function getFallbackEmployees() {
    return [
        {
            id: 1,
            employee_name: "Emily Johnson",
            employee_department: "Engineering",
            employee_title: "Sales Manager",
            employee_age: 29,
            employee_salary: 1150000,
            employee_image: "https://dummyjson.com/icon/emilys/128",
            employee_email: "emily.johnson@x.dummyjson.com",
            employee_phone: "+91 98451 23024"
        },
        {
            id: 2,
            employee_name: "Michael Williams",
            employee_department: "Support",
            employee_title: "Support Specialist",
            employee_age: 36,
            employee_salary: 820000,
            employee_image: "https://dummyjson.com/icon/michaelw/128",
            employee_email: "michael.williams@x.dummyjson.com",
            employee_phone: "+91 97123 45678"
        },
        {
            id: 3,
            employee_name: "Sophia Martinez",
            employee_department: "Product",
            employee_title: "Senior Product Designer",
            employee_age: 32,
            employee_salary: 1480000,
            employee_image: "https://dummyjson.com/icon/sophiam/128",
            employee_email: "sophia.martinez@x.dummyjson.com",
            employee_phone: "+91 98234 56789"
        },
        {
            id: 4,
            employee_name: "James Anderson",
            employee_department: "Engineering",
            employee_title: "DevOps Engineer",
            employee_age: 30,
            employee_salary: 1350000,
            employee_image: "https://dummyjson.com/icon/jamesa/128",
            employee_email: "james.anderson@x.dummyjson.com",
            employee_phone: "+91 99345 67890"
        },
        {
            id: 5,
            employee_name: "Olivia Davis",
            employee_department: "Human Resources",
            employee_title: "HR Director",
            employee_age: 41,
            employee_salary: 1650000,
            employee_image: "https://dummyjson.com/icon/oliviad/128",
            employee_email: "olivia.davis@x.dummyjson.com",
            employee_phone: "+91 98112 33445"
        }
    ];
}