import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDc5vPF3PuqCU5M6DlQaVtuY5ITarg6MVA",
  authDomain: "yoga-3f3f1.firebaseapp.com",
  projectId: "yoga-3f3f1",
  storageBucket: "yoga-3f3f1.firebasestorage.app",
  messagingSenderId: "142685495279",
  appId: "1:142685495279:web:6a5ba0c0a5b2ac7b80e01a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ADMIN UID list (you'll need to update this with your real UIDs)
const adminUIDs = [
  // Replace these after first login with actual UID
];

// DOM Elements
const calendar = document.getElementById("calendar");
const courseList = document.getElementById("courseList");
const monthYear = document.getElementById("monthYear");
const courseForm = document.getElementById("courseForm");
const courseTime = document.getElementById("courseTime");
const courseTitle = document.getElementById("courseTitle");
const adminPanel = document.getElementById("adminPanel");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let selectedDate = null;
let currentUser = null;
let calendarData = {};

function updateCalendar() {
  calendar.innerHTML = "";
  monthYear.textContent = `${new Date(currentYear, currentMonth).toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}`;

  const firstDay = new Date(currentYear, currentMonth, 1).getDay() || 7;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  for (let i = 1; i < firstDay; i++) {
    calendar.appendChild(document.createElement("div"));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayDiv = document.createElement("div");
    dayDiv.textContent = day;

    if (calendarData[dateStr]) {
      dayDiv.classList.add("course-day");
    }

    dayDiv.addEventListener("click", () => {
      selectedDate = dateStr;
      displayCourses(dateStr);
    });

    calendar.appendChild(dayDiv);
  }
}

function displayCourses(dateStr) {
  const courses = calendarData[dateStr] || [];
  if (courses.length === 0) {
    courseList.textContent = "Aucun cours pour ce jour.";
    return;
  }

  courseList.innerHTML = "";
  courses.forEach(course => {
    const div = document.createElement("div");
    div.textContent = `${course.time} - ${course.title}`;
    courseList.appendChild(div);
  });
}

courseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!selectedDate) return;

  const course = {
    time: courseTime.value,
    title: courseTitle.value
  };

  calendarData[selectedDate] = calendarData[selectedDate] || [];
  calendarData[selectedDate].push(course);

  await saveCoursesToFirestore();

  courseTime.value = "";
  courseTitle.value = "";
  displayCourses(selectedDate);
  updateCalendar();
});

async function saveCoursesToFirestore() {
  await setDoc(doc(db, "calendars", "main"), calendarData);
}

async function loadCoursesFromFirestore() {
  const docSnap = await getDoc(doc(db, "calendars", "main"));
  if (docSnap.exists()) {
    calendarData = docSnap.data();
  }
  updateCalendar();
}

// Auth logic
loginBtn.addEventListener("click", async () => {
  const email = emailInput.value;
  const password = passwordInput.value;

  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    currentUser = userCred.user;
    toggleAdminUI(true);
  } catch (e) {
    alert("Échec de la connexion.");
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  currentUser = null;
  toggleAdminUI(false);
});

function toggleAdminUI(isAdmin) {
  if (isAdmin) {
    adminPanel.style.display = "block";
    logoutBtn.style.display = "inline-block";
    loginBtn.style.display = "none";
  } else {
    adminPanel.style.display = "none";
    logoutBtn.style.display = "none";
    loginBtn.style.display = "inline-block";
  }
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    toggleAdminUI(true);
  } else {
    currentUser = null;
    toggleAdminUI(false);
  }
});

document.getElementById("prevMonth").addEventListener("click", () => {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  updateCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  updateCalendar();
});

loadCoursesFromFirestore();
