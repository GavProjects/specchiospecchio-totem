// Configurazione Supabase
const SUPABASE_URL = 'https://pkhpqpmdhlzyrdamogqs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraHBxcG1kaGx6eXJkYW1vZ3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4Njk4NDcsImV4cCI6MjA2MTQ0NTg0N30.9q80FVtshlig5S97EkJT2fzQ0DM0eAkKIt6hwQTLeOY';

// Configurazione Firebase
const firebaseConfig = {
  apiKey: "AIzaSyADQIbSx6Whwj4689z5WRM8y3x3O5ec5R0",
  authDomain: "specchiospecchio-mvp.firebaseapp.com",
  databaseURL: "https://specchiospecchio-mvp-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "specchiospecchio-mvp",
  storageBucket: "specchiospecchio-mvp.appspot.com",
  messagingSenderId: "267990022905",
  appId: "1:267990022905:web:aedee6093706fc86bf0028"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const webcamElement = document.getElementById("camera");
const canvasElement = document.getElementById("canvas");
const webcam = new Webcam(webcamElement, "user", canvasElement, {
  facingMode: "user",
  width: 1080,
  height: 1920
});

async function initWebcam() {
  try {
    await webcam.start();
    console.log("🎥 Webcam avviata correttamente");
  } catch (err) {
    console.error("❌ Errore avvio webcam:", err);
  }
}

function base64ToBlob(base64, contentType = "image/jpeg") {
  const byteCharacters = atob(base64.split(',')[1]);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  return new Blob(byteArrays, { type: contentType });
}

async function uploadPhotoToSupabase(base64image, sessionId) {
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/photos/${sessionId}.jpg`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true'
    },
    body: base64ToBlob(base64image, 'image/jpeg')
  });

  if (!response.ok) {
    throw new Error('Errore upload Supabase: ' + (await response.text()));
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/photos/${sessionId}.jpg`;
  console.log("✅ Foto caricata su:", publicUrl);
  return publicUrl;
}

async function gestisciSessione(data, sessionId) {
  const stato = data.status;
  console.log("📡 Stato ricevuto:", stato);

  if (!stato || stato === "initialized") {
    showStandby();
    return;
  }

  if (stato === "inserted-name") {
    hideAll();
    showSaluto(data.name || "Utente");
  } else if (stato === "selected-mood") {
    hideAll();
    showImage(`assets/mood_${data.mood || "default"}.jpg`);
  } else if (stato === "selected-items") {
    hideAll();
    showImage("assets/outfit_selection.jpg");
  } else if (stato === "ready-for-photo") {
    hideAll();
    showCamera();
    await countdown(3);

    try {
      const videoWidth = webcamElement.videoWidth;
      const videoHeight = webcamElement.videoHeight;
      canvasElement.width = videoWidth;
      canvasElement.height = videoHeight;

      const ctx = canvasElement.getContext('2d');
      ctx.drawImage(webcamElement, 0, 0, videoWidth, videoHeight);

      const picture = canvasElement.toDataURL('image/jpeg', 0.9);

      hideCamera();
      showLoading();

      const uploadedImageUrl = await uploadPhotoToSupabase(picture, sessionId);

      await db.ref(`sessions/${sessionId}`).update({
        status: "photo-uploaded",
        uploadedImageUrl: uploadedImageUrl,
        photo_timestamp: Date.now()
      });

      showImage(uploadedImageUrl);

    } catch (err) {
      console.error("❌ Errore durante l'upload:", err);
      showError();
    }
  }
}

function showStandby() {
  document.getElementById("standby-container").style.display = "block";
  document.getElementById("content-container").style.display = "none";
  document.getElementById("saluto-container").style.display = "none";
}

function hideAll() {
  document.getElementById("standby-container").style.display = "none";
  document.getElementById("content-container").style.display = "none";
  document.getElementById("saluto-container").style.display = "none";
}

function showSaluto(nome) {
  const saluto = document.getElementById("saluto-container");
  document.getElementById("user-name").innerText = nome;
  saluto.style.display = "flex";
}

function showImage(url) {
  const imageContainer = document.getElementById("image");
  imageContainer.innerHTML = `<img src="${url}" style="width: 100%; height: 100vh; object-fit: contain; display: block; margin: 0 auto;">`;
  document.getElementById("content-container").style.display = "block";
}

function clearImage() {
  document.getElementById("image").innerHTML = "";
}

function showCamera() {
  webcamElement.style.display = "block";
  clearImage();
  document.getElementById("content-container").style.display = "block";
}

function hideCamera() {
  webcamElement.style.display = "none";
}

function showLoading() {
  clearImage();
  document.getElementById("image").innerHTML = "<div style='color:white;font-size:3em;'>Caricamento foto...</div>";
  document.getElementById("content-container").style.display = "block";
}

function showError() {
  clearImage();
  document.getElementById("image").innerHTML = "<div style='color:red;font-size:3em;'>Errore caricamento!</div>";
  document.getElementById("content-container").style.display = "block";
}

function countdown(seconds) {
  return new Promise((resolve) => {
    const counter = document.getElementById("countdown");
    let current = seconds;
    const interval = setInterval(() => {
      counter.innerText = current;
      current--;
      if (current < 0) {
        clearInterval(interval);
        counter.innerText = "";
        resolve();
      }
    }, 1000);
  });
}

function listenToLatestSession() {
  const sessionsRef = db.ref("sessions");

  sessionsRef.orderByChild("timestamp").limitToLast(1).on("child_added", (snapshot) => {
    const sessionId = snapshot.key;
    console.log("🎯 Sessione trovata:", sessionId);

    const singleSessionRef = db.ref(`sessions/${sessionId}`);
    singleSessionRef.on("value", (snapshot) => {
      const data = snapshot.val();
      if (data) {
        gestisciSessione(data, sessionId);
      }
    });
  });
}

initWebcam();
listenToLatestSession();
