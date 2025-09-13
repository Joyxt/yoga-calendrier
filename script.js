// Firebase config et initialisation
const firebaseConfig = {
  apiKey: "AIzaSyDc5vPF3PuqCU5M6DlQaVtuY5ITarg6MVA",
  authDomain: "yoga-3f3f1.firebaseapp.com",
  projectId: "yoga-3f3f1",
  storageBucket: "yoga-3f3f1.firebasestorage.app",
  messagingSenderId: "142685495279",
  appId: "1:142685495279:web:6a5ba0c0a5b2ac7b80e01a"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Variables globales
const monthNames = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre"
];

let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();

let coursesData = {}; // données des cours chargées depuis Firestore

const calendarDays = document.getElementById("calendarDays");
const monthYearLabel = document.getElementById("monthYearLabel");
const coursesInfo = document.getElementById("coursesInfo");

const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const adminEmailInput = document.getElementById("adminEmail");
const adminPasswordInput = document.getElementById("adminPassword");
const adminPanel = document.getElementById("adminPanel");
const adminContent = document.getElementById("adminContent");
const authMessage = document.getElementById("authMessage");

let selectedDayElement = null;
let selectedDate = null;
let adminConnected = false;
let currentUser = null; // firebase user object

// Fonction pour charger les données Firestore dans coursesData
async function loadCoursesFromFirestore() {
  coursesData = {};
  try {
    const snapshot = await db.collection("cours").get();
    snapshot.forEach(doc => {
      coursesData[doc.id] = doc.data().cours;
    });
    console.log("Données Firestore chargées :", coursesData);
  } catch (error) {
    console.error("Erreur lors du chargement Firestore :", error);
  }
}

// Fonction pour vérifier si une UID est admin (collection 'admins', doc id = uid)
async function checkIfAdmin(uid) {
  if (!uid) return false;
  try {
    const doc = await db.collection("admins").doc(uid).get();
    return doc.exists;
  } catch (err) {
    console.error("Erreur check admin:", err);
    return false;
  }
}

// Fonction pour sauvegarder un jour dans Firestore (vérifie admin côté client)
function saveDayToFirestore(dateStr) {
  if (!adminConnected || !currentUser) {
    return Promise.reject(new Error("Accès refusé : non connecté en tant qu'admin."));
  }

  if(coursesData[dateStr] && coursesData[dateStr].length > 0) {
    return db.collection("cours").doc(dateStr).set({ cours: coursesData[dateStr] })
      .then(() => console.log(`Sauvegarde Firestore réussie pour ${dateStr}`))
      .catch(err => console.error("Erreur sauvegarde Firestore :", err));
  } else {
    // Supprime le document si pas de cours
    return db.collection("cours").doc(dateStr).delete()
      .then(() => console.log(`Document supprimé pour ${dateStr}`))
      .catch(() => {}); // Ignore si doc pas existant
  }
}

// Fonction pour afficher le calendrier
function renderCalendar(month, year) {
  calendarDays.innerHTML = "";

  monthYearLabel.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay();
  startDay = (startDay === 0) ? 7 : startDay;

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 1; i < startDay; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.classList.add("day");
    emptyCell.style.visibility = "hidden";
    calendarDays.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayDiv = document.createElement("div");
    dayDiv.classList.add("day");
    dayDiv.textContent = day;

    const dateStr = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    
    // Ajout de la classe si cours ce jour
    if(coursesData[dateStr]) {
      dayDiv.classList.add("has-course");
    }

    dayDiv.addEventListener("click", () => {
      if(selectedDayElement) selectedDayElement.classList.remove("selected");
      dayDiv.classList.add("selected");
      selectedDayElement = dayDiv;
      selectedDate = dateStr;

      afficherCours(dateStr);

      if(adminConnected) {
        renderAdminPanel(dateStr);
      }
    });

    calendarDays.appendChild(dayDiv);
  }
}

// Afficher les cours pour une date donnée
function afficherCours(dateStr) {
  if(!coursesData[dateStr]) {
    coursesInfo.innerHTML = "<strong>Horaires des cours</strong><br>Sélectionne un jour pour voir les cours.";
    return;
  }

  let html = `<strong>Horaires des cours pour le ${dateStr} :</strong><br><ul>`;
  coursesData[dateStr].forEach(cours => {
    html += `<li>${cours.heure} - ${cours.titre}</li>`;
  });
  html += "</ul>";
  coursesInfo.innerHTML = html;
}

// Affiche le panneau admin pour gérer les cours
function renderAdminPanel(dateStr) {
  if(!adminConnected || !currentUser) {
    adminPanel.style.display = "none";
    return;
  }

  adminPanel.style.display = "block";

  if(!dateStr) {
    adminContent.innerHTML = "<p>Sélectionne un jour pour gérer ses cours.</p>";
    return;
  }

  const coursDuJour = coursesData[dateStr] || [];

  let html = `
    <p><strong>Gestion des cours pour le ${dateStr}</strong></p>
    <ul>
      ${coursDuJour.map((c, i) => `<li>${c.heure} - ${c.titre} <button data-index="${i}" id="delCourseBtn${i}">X</button></li>`).join('') || '<li>(Aucun)</li>'}
    </ul>

    <label for="newCourseTime">Heure :</label>
    <input type="time" id="newCourseTime" required />

    <label for="newCourseTitle">Titre :</label>
    <input type="text" id="newCourseTitle" placeholder="Nom du cours" required />

    <button id="addCourseBtn">Ajouter un cours</button>
  `;

  adminContent.innerHTML = html;

  // Supprimer un cours
  coursDuJour.forEach((c, i) => {
    const delBtn = document.getElementById(`delCourseBtn${i}`);
    if (delBtn) {
      delBtn.addEventListener("click", async () => {
        // Re-vérification côté client
        if(!adminConnected) { alert("Accès refusé."); return; }
        coursDuJour.splice(i, 1);
        if(coursDuJour.length === 0) {
          delete coursesData[dateStr];
        } else {
          coursesData[dateStr] = coursDuJour;
        }
        try {
          await saveDayToFirestore(dateStr);
          renderCalendar(currentMonth, currentYear);
          afficherCours(dateStr);
          renderAdminPanel(dateStr);
        } catch (err) {
          alert("Erreur lors de la suppression : " + err.message);
        }
      });
    }
  });

  // Ajouter un cours
  const addBtn = document.getElementById("addCourseBtn");
  addBtn.addEventListener("click", async () => {
    if(!adminConnected) { alert("Accès refusé."); return; }

    const timeInput = document.getElementById("newCourseTime");
    const titleInput = document.getElementById("newCourseTitle");

    const heure = timeInput.value;
    const titre = titleInput.value.trim();

    if(!heure || !titre) {
      alert("Veuillez renseigner l'heure et le titre du cours.");
      return;
    }

    if(!coursesData[dateStr]) {
      coursesData[dateStr] = [];
    }
    coursesData[dateStr].push({ heure, titre });
    coursesData[dateStr].sort((a,b) => a.heure.localeCompare(b.heure));

    timeInput.value = "";
    titleInput.value = "";

    try {
      await saveDayToFirestore(dateStr);
      renderCalendar(currentMonth, currentYear);
      afficherCours(dateStr);
      renderAdminPanel(dateStr);
    } catch (err) {
      alert("Erreur lors de l'ajout : " + err.message);
    }
  });
}

// Navigation mois
prevMonthBtn.addEventListener("click", () => {
  currentMonth--;
  if(currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderCalendar(currentMonth, currentYear);
  coursesInfo.innerHTML = "<strong>Horaires des cours</strong><br>Sélectionne un jour pour voir les cours.";
  if(selectedDayElement) selectedDayElement.classList.remove("selected");
  selectedDayElement = null;
  selectedDate = null;
});

nextMonthBtn.addEventListener("click", () => {
  currentMonth++;
  if(currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCalendar(currentMonth, currentYear);
  coursesInfo.innerHTML = "<strong>Horaires des cours</strong><br>Sélectionne un jour pour voir les cours.";
  if(selectedDayElement) selectedDayElement.classList.remove("selected");
  selectedDayElement = null;
  selectedDate = null;
});

// Connexion admin (email/password)
loginBtn.addEventListener("click", async () => {
  const email = adminEmailInput.value.trim();
  const password = adminPasswordInput.value;
  authMessage.textContent = "";
  if(!email || !password) {
    authMessage.style.color = "red";
    authMessage.textContent = "Renseigne email et mot de passe.";
    return;
  }

  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged gérera le reste (check admin)
  } catch (err) {
    console.error("Erreur connexion :", err);
    authMessage.style.color = "red";
    switch(err.code) {
      case "auth/wrong-password":
        authMessage.textContent = "Mot de passe incorrect.";
        break;
      case "auth/user-not-found":
        authMessage.textContent = "Aucun utilisateur avec cet email.";
        break;
      case "auth/invalid-email":
        authMessage.textContent = "Email invalide.";
        break;
      default:
        authMessage.textContent = err.message;
    }
  }
});

// Déconnexion admin
logoutBtn.addEventListener("click", () => {
  auth.signOut();
});

// Ecouteur d'état d'auth (gère connexion/déconnexion)
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  if (user) {
    // Vérifier si uid est admin (collection 'admins')
    const isAdmin = await checkIfAdmin(user.uid);
    if (isAdmin) {
      adminConnected = true;
      adminPanel.style.display = "block";
      logoutBtn.style.display = "inline-block";
      loginBtn.style.display = "none";
      adminEmailInput.style.display = "none";
      adminPasswordInput.style.display = "none";
      authMessage.style.color = "green";
      authMessage.textContent = "Connecté en tant qu'admin: " + (user.email || user.uid);
      if(selectedDate) renderAdminPanel(selectedDate);
    } else {
      // utilisateur connecté mais pas admin
      adminConnected = false;
      adminPanel.style.display = "none";
      logoutBtn.style.display = "inline-block";
      loginBtn.style.display = "none";
      adminEmailInput.style.display = "none";
      adminPasswordInput.style.display = "none";
      authMessage.style.color = "red";
      authMessage.textContent = "Connecté mais pas autorisé comme admin.";
    }
  } else {
    // pas connecté
    adminConnected = false;
    currentUser = null;
    adminPanel.style.display = "none";
    adminContent.innerHTML = "";
    loginBtn.style.display = "inline-block";
    adminEmailInput.style.display = "inline-block";
    adminPasswordInput.style.display = "inline-block";
    logoutBtn.style.display = "none";
    adminEmailInput.value = "";
    adminPasswordInput.value = "";
    authMessage.textContent = "";
    renderCalendar(currentMonth, currentYear);
  }
});

// Initialisation : charger depuis Firestore puis afficher calendrier
loadCoursesFromFirestore().then(() => {
  renderCalendar(currentMonth, currentYear);
});
