/* ==========================================================
   Student Productivity Dashboard - JavaScript
   Features:
   1. Live Clock & Dynamic Greeting
   2. Pomodoro Timer with Audio Alert
   3. Task & Assignment Tracker with LocalStorage
   4. Daily Task Completion Progress Bar
   5. Quick Notes with Auto-Save
   ========================================================== */

// --- 1. Live Clock & Dynamic Greeting ---
function updateClockAndGreeting() {
    const timeDisplay = document.getElementById("live-time");
    const dateDisplay = document.getElementById("live-date");
    const greeting = document.getElementById("greeting");

    const now = new Date();

    // Time formatting (12-hour format with AM/PM)
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;

    timeDisplay.textContent = `${hours}:${minutes}:${seconds} ${ampm}`;

    // Date formatting (e.g., Wednesday, Oct 1, 2026)
    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    dateDisplay.textContent = now.toLocaleDateString(undefined, options);

    // Dynamic greeting based on current hour
    const currentHour = now.getHours();
    if (currentHour < 12) {
        greeting.textContent = "Good Morning! Ready to learn today?";
    } else if (currentHour < 18) {
        greeting.textContent = "Good Afternoon! Keep up the momentum.";
    } else {
        greeting.textContent = "Good Evening! Finish strong tonight.";
    }
}

// Run clock every second
setInterval(updateClockAndGreeting, 1000);
updateClockAndGreeting();


// --- 2. Pomodoro Study Timer ---
let timerDuration = 25 * 60; // in seconds
let timeLeft = timerDuration;
let timerInterval = null;
let isRunning = false;

const timerDisplay = document.getElementById("timer-display");
const startBtn = document.getElementById("start-btn");
const pauseBtn = document.getElementById("pause-btn");
const resetBtn = document.getElementById("reset-btn");
const modeButtons = document.querySelectorAll(".mode-btn");
const sessionCountDisplay = document.getElementById("session-count");

// Load completed sessions from localStorage
let completedSessions = parseInt(localStorage.getItem("pomodoro_sessions")) || 0;
sessionCountDisplay.textContent = completedSessions;

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimerDisplay() {
    timerDisplay.textContent = formatTime(timeLeft);
}

// Simple beep sound using Web Audio API (No external sound files required)
function playAlarmSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(650, audioCtx.currentTime); // 650 Hz tone
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.8); // play for 0.8s
    } catch (e) {
        console.log("Audio alert not supported or blocked by browser.");
    }
}

function startTimer() {
    if (isRunning) return;

    isRunning = true;
    startBtn.disabled = true;
    pauseBtn.disabled = false;

    timerInterval = setInterval(() => {
        if (timeLeft > 0) {
            timeLeft--;
            updateTimerDisplay();
        } else {
            clearInterval(timerInterval);
            isRunning = false;
            startBtn.disabled = false;
            pauseBtn.disabled = true;

            playAlarmSound();
            alert("Timer finished! Great job!");

            // If it was a study session (25 mins), increment session count
            if (timerDuration === 25 * 60) {
                completedSessions++;
                sessionCountDisplay.textContent = completedSessions;
                localStorage.setItem("pomodoro_sessions", completedSessions);
            }
        }
    }, 1000);
}

function pauseTimer() {
    if (!isRunning) return;
    clearInterval(timerInterval);
    isRunning = false;
    startBtn.disabled = false;
    pauseBtn.disabled = true;
}

function resetTimer() {
    pauseTimer();
    timeLeft = timerDuration;
    updateTimerDisplay();
}

// Mode switch (Study, Short Break, Long Break)
modeButtons.forEach(button => {
    button.addEventListener("click", () => {
        modeButtons.forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");

        const minutes = parseInt(button.getAttribute("data-time"));
        timerDuration = minutes * 60;
        resetTimer();
    });
});

startBtn.addEventListener("click", startTimer);
pauseBtn.addEventListener("click", pauseTimer);
resetBtn.addEventListener("click", resetTimer);


// --- 3. Assignment & Task Tracker with LocalStorage ---
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const taskSubject = document.getElementById("task-subject");
const taskDueDate = document.getElementById("task-due-date");
const taskPriority = document.getElementById("task-priority");
const taskList = document.getElementById("task-list");
const filterButtons = document.querySelectorAll(".filter-btn");

let currentFilter = "all";

// Default starter tasks for demonstration if nothing is saved
const defaultTasks = [
    {
        id: 1,
        title: "Mathematics Chapter 5 Exercises",
        subject: "Mathematics",
        dueDate: "2026-10-02",
        priority: "High",
        completed: false
    },
    {
        id: 2,
        title: "Read Computer Science Lab Manual",
        subject: "Computer Science",
        dueDate: "2026-10-04",
        priority: "Normal",
        completed: true
    },
    {
        id: 3,
        title: "Submit Physics Assignment Report",
        subject: "Science",
        dueDate: "2026-10-05",
        priority: "Normal",
        completed: false
    }
];

// Load tasks from localStorage or use defaultTasks
let tasks = JSON.parse(localStorage.getItem("student_tasks")) || defaultTasks;

function saveTasksToStorage() {
    localStorage.setItem("student_tasks", JSON.stringify(tasks));
}

function renderTasks() {
    taskList.innerHTML = "";

    // Filter tasks
    const filteredTasks = tasks.filter(task => {
        if (currentFilter === "pending") return !task.completed;
        if (currentFilter === "completed") return task.completed;
        return true;
    });

    if (filteredTasks.length === 0) {
        taskList.innerHTML = `<li class="empty-task-msg">No tasks found in this view.</li>`;
    } else {
        filteredTasks.forEach(task => {
            const li = document.createElement("li");
            li.className = `task-item ${task.completed ? 'completed' : ''}`;

            li.innerHTML = `
                <div class="task-left">
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}">
                    <div class="task-info">
                        <span class="task-title">${escapeHtml(task.title)}</span>
                        <div class="task-meta">
                            <span class="badge badge-subject">${escapeHtml(task.subject)}</span>
                            <span class="badge badge-priority-${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span>
                            <span>Due: ${escapeHtml(task.dueDate)}</span>
                        </div>
                    </div>
                </div>
                <button class="btn btn-danger delete-task-btn" data-id="${task.id}">Delete</button>
            `;

            taskList.appendChild(li);
        });
    }

    // Attach event listeners for checkboxes and delete buttons
    document.querySelectorAll(".task-checkbox").forEach(chk => {
        chk.addEventListener("change", (e) => {
            const taskId = parseInt(e.target.getAttribute("data-id"));
            toggleTaskComplete(taskId);
        });
    });

    document.querySelectorAll(".delete-task-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const taskId = parseInt(e.target.getAttribute("data-id"));
            deleteTask(taskId);
        });
    });

    updateProgress();
}

// Add new task
taskForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const title = taskInput.value.trim();
    const subject = taskSubject.value;
    const dueDate = taskDueDate.value;
    const priority = taskPriority.value;

    if (!title || !subject || !dueDate) return;

    const newTask = {
        id: Date.now(),
        title: title,
        subject: subject,
        dueDate: dueDate,
        priority: priority,
        completed: false
    };

    tasks.unshift(newTask);
    saveTasksToStorage();
    renderTasks();

    // Reset input fields
    taskInput.value = "";
    taskSubject.value = "";
    taskDueDate.value = "";
    taskPriority.value = "Normal";
});

// Toggle complete
function toggleTaskComplete(id) {
    tasks = tasks.map(task => {
        if (task.id === id) {
            return { ...task, completed: !task.completed };
        }
        return task;
    });
    saveTasksToStorage();
    renderTasks();
}

// Delete task
function deleteTask(id) {
    if (confirm("Are you sure you want to delete this task?")) {
        tasks = tasks.filter(task => task.id !== id);
        saveTasksToStorage();
        renderTasks();
    }
}

// Filter buttons
filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        filterButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.getAttribute("data-filter");
        renderTasks();
    });
});

// Helper function to prevent XSS in student user inputs
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}


// --- 4. Today's Progress Bar & Counters ---
function updateProgress() {
    const totalCount = tasks.length;
    const completedCount = tasks.filter(t => t.completed).length;
    const pendingCount = totalCount - completedCount;

    document.getElementById("stat-total").textContent = totalCount;
    document.getElementById("stat-completed").textContent = completedCount;
    document.getElementById("stat-pending").textContent = pendingCount;

    const percentage = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
    const progressBar = document.getElementById("task-progress-bar");
    progressBar.style.width = `${percentage}%`;
}


// --- 5. Quick Notes with Auto-Save ---
const notesTextarea = document.getElementById("quick-notes");
const saveStatus = document.getElementById("save-status");
const clearNotesBtn = document.getElementById("clear-notes-btn");

// Load saved notes
const savedNotes = localStorage.getItem("student_notes") || "";
notesTextarea.value = savedNotes;

let saveTimeout = null;

notesTextarea.addEventListener("input", () => {
    saveStatus.textContent = "Saving...";
    saveStatus.style.color = "#f39c12";

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        localStorage.setItem("student_notes", notesTextarea.value);
        saveStatus.textContent = "Saved";
        saveStatus.style.color = "#27ae60";
    }, 500); // 500ms debounce
});

clearNotesBtn.addEventListener("click", () => {
    if (confirm("Do you want to clear your quick notes?")) {
        notesTextarea.value = "";
        localStorage.removeItem("student_notes");
        saveStatus.textContent = "Cleared";
        saveStatus.style.color = "#7f8c8d";
    }
});


// Initial render on page load
renderTasks();
