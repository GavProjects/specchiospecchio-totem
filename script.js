// Configurazione Firebase (solo per autenticazione e real-time db)
const firebaseConfig = {
  apiKey: "AIzaSyADQIbSx6Whwj4689z5WRM8y3x3O5ec5R0",
  authDomain: "specchiospecchio-mvp.firebaseapp.com",
  databaseURL: "https://specchiospecchio-mvp-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "specchiospecchio-mvp",
  storageBucket: "specchiospecchio-mvp.appspot.com",
  messagingSenderId: "267990022905",
  appId: "1:267990022905:web:aedee6093706fc86bf0028"
};

// Configurazione Supabase
const SUPABASE_URL = 'https://pkhpqpmdhlzyrdamogqs.supabase.co';
// IMPORTANTE: Sostituisci questa chiave con quella completa
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraHBxcG1kaGx6eXJkYW1vZ3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4Njk4NDcsImV4cCI6MjA2MTQ0NTg0N30.9q80FVtshlig5S97EkJT2fzQ0DM0eAkKIt6hwQTLeOY';

// Configurazione generale
const AUTO_RESTART_DELAY = 10000; // 10 secondi prima di riavviare (aumentato a 10 secondi)
const COUNTDOWN_SECONDS = 5; // 5 secondi di countdown prima dello scatto

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Variabili di stato
let restartTimer = null;
let lastProcessedStatus = null;

// Struttura del DOM
function setupDOM() {
  // Crea wrapper per webcam con dimensioni specifiche
  const webcamContainerHTML = `
    <div id="webcam-square-container" style="width:100%; height:100vh; overflow:hidden; background-color:#F4F2E9; position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center;">
      <img src="https://gavprojects.com/specchio_specchio.png" style="width:40vw; max-width:500px; margin-bottom:40px; z-index:100; position:relative; top:40px;">
      <div id="webcam-inner" style="width:1080px; height:1080px; max-width:90vw; max-height:70vh; overflow:hidden; position:relative;">
        <video id="webcam-video" autoplay playsinline style="width:100%; height:100%; object-fit:cover;"></video>
      </div>
      <div id="countdown-display" style="position:absolute; font-size:6em; color:#d72638; font-weight:bold; z-index:200; display:none;"></div>
    </div>
  `;
  
  // Sostituisce il video e canvas esistenti con la nuova struttura
  document.getElementById("image").innerHTML = webcamContainerHTML;
}

// Variabili globali
let mediaStream = null;

// Inizializza la webcam
async function startWebcam() {
  try {
    // Ottieni accesso alla webcam
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false 
    });
    
    // Salva lo stream per chiuderlo in seguito
    mediaStream = stream;
    
    // Imposta la sorgente del video
    const videoElement = document.getElementById("webcam-video");
    videoElement.srcObject = stream;
    
    console.log("🎥 Webcam avviata correttamente");
    return true;
  } catch (error) {
    console.error("❌ Errore avvio webcam:", error);
    return false;
  }
}

// Ferma la webcam
function stopWebcam() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
}

// Cattura screenshot del video
async function takePicture(sessionId) {
  return new Promise((resolve, reject) => {
    try {
      const video = document.getElementById("webcam-video");
      
      // Crea un elemento video temporaneo
      const tempVideo = document.createElement('video');
      tempVideo.srcObject = mediaStream;
      tempVideo.autoplay = true;
      tempVideo.muted = true;
      tempVideo.style.position = 'fixed';
      tempVideo.style.left = '-9999px';
      tempVideo.style.top = '-9999px';
      document.body.appendChild(tempVideo);
      
      // Quando il video è pronto, prendiamo lo screenshot
      tempVideo.onloadedmetadata = () => {
        tempVideo.play();
        
        setTimeout(() => {
          try {
            const canvas = document.createElement('canvas');
            // Utilizziamo dimensioni fisse 1080x1080
            canvas.width = 1080;
            canvas.height = 1080;
            
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = "#F4F2E9";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Calcoliamo le dimensioni corrette per mantenere un quadrato centrato
            const size = Math.min(tempVideo.videoWidth, tempVideo.videoHeight);
            const offsetX = (tempVideo.videoWidth - size) / 2;
            const offsetY = (tempVideo.videoHeight - size) / 2;
            
            // Disegniamo il video sul canvas
            ctx.drawImage(tempVideo, offsetX, offsetY, size, size, 0, 0, canvas.width, canvas.height);
            
            // Aggiungiamo il logo al canvas
            const logoImg = new Image();
            logoImg.crossOrigin = "anonymous";
            logoImg.onload = () => {
              // Logo più grande
              const logoWidth = canvas.width * 0.4;
              const logoHeight = logoWidth * (logoImg.height / logoImg.width);
              
              // Posiziona il logo più in alto
              ctx.drawImage(logoImg, (canvas.width - logoWidth) / 2, 40, logoWidth, logoHeight);
              
              // Converti in base64
              try {
                const dataURL = canvas.toDataURL('image/jpeg', 0.95);
                document.body.removeChild(tempVideo);
                
                // Carica su Supabase
                uploadImageToSupabase(dataURL, sessionId).then(url => {
                  resolve(url);
                }).catch(error => {
                  console.error("Errore upload Supabase:", error);
                  // In caso di errore, restituisci almeno l'immagine base64
                  resolve(dataURL);
                });
              } catch (canvasError) {
                console.error("Errore canvas:", canvasError);
                document.body.removeChild(tempVideo);
                reject(canvasError);
              }
            };
            
            logoImg.onerror = (err) => {
              console.warn("Logo non caricato:", err);
              
              try {
                const dataURL = canvas.toDataURL('image/jpeg', 0.95);
                document.body.removeChild(tempVideo);
                
                uploadImageToSupabase(dataURL, sessionId).then(url => {
                  resolve(url);
                }).catch(error => {
                  console.error("Errore upload Supabase:", error);
                  resolve(dataURL);
                });
              } catch (canvasError) {
                console.error("Errore canvas:", canvasError);
                document.body.removeChild(tempVideo);
                reject(canvasError);
              }
            };
            
            logoImg.src = "https://gavprojects.com/specchio_specchio.png";
          } catch (error) {
            console.error("Errore nella creazione del canvas:", error);
            document.body.removeChild(tempVideo);
            reject(error);
          }
        }, 300); // Aumentato il tempo per assicurarci che il video sia pronto
      };
    } catch (error) {
      console.error("Errore generale nella cattura:", error);
      reject(error);
    }
  });
}

// Converte base64 a Blob
function base64ToBlob(base64, contentType = "image/jpeg") {
  try {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = Array.from(slice).map(c => c.charCodeAt(0));
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays, { type: contentType });
  } catch (e) {
    console.error("Errore nella conversione base64 a blob:", e);
    throw e;
  }
}

// Carica immagine su Supabase
async function uploadImageToSupabase(base64Image, sessionId) {
  try {
    console.log("Inizio caricamento su Supabase...");
    
    const blob = base64ToBlob(base64Image);
    
    // Endpoint dell'API Supabase Storage per il bucket "photos"
    const endpoint = `${SUPABASE_URL}/storage/v1/object/photos/${sessionId}.jpg`;
    
    console.log("Endpoint Supabase:", endpoint);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true'
      },
      body: blob
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Risposta da Supabase: ${response.status} ${errorText}`);
      throw new Error(`Errore upload Supabase: ${response.status} ${errorText}`);
    }
    
    // URL pubblico corretto per il bucket "photos"
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/photos/${sessionId}.jpg`;
    console.log("✅ Foto caricata su Supabase:", publicUrl);
    return publicUrl;
  } catch (error) {
    console.error("❌ Errore dettagliato upload Supabase:", error);
    throw error;
  }
}

// Riavvia il totem tornando allo stato iniziale
function restartTotem() {
  // Pulisci eventuali timer precedenti
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  
  // Ferma la webcam se attiva
  stopWebcam();
  
  // Torna alla schermata standby
  showStandby();
  
  // Reimposta la variabile che tiene traccia dell'ultimo stato processato
  lastProcessedStatus = null;
  
  console.log("🔄 Totem riavviato e pronto per una nuova sessione");
}

// Programma il riavvio automatico
function scheduleRestart() {
  console.log(`⏱️ Programmato riavvio automatico tra ${AUTO_RESTART_DELAY/1000} secondi`);
  
  // Pulisci eventuali timer precedenti
  if (restartTimer) {
    clearTimeout(restartTimer);
  }
  
  // Imposta il nuovo timer
  restartTimer = setTimeout(restartTotem, AUTO_RESTART_DELAY);
}

// Funzioni di visualizzazione
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
  document.getElementById("user-name").innerText = nome;
  document.getElementById("saluto-container").style.display = "flex";
}

// Funzione migliorata per mostrare l'immagine con debug e gestione errori
function showImage(url) {
  console.log("Tentativo di mostrare immagine:", url);
  stopWebcam();
  
  // Prepara HTML con gestione errori
  const imgHTML = `
    <img 
      id="result-image"
      src="${url}" 
      style="width: 100%; height: 100vh; object-fit: contain; display: block; margin: 0 auto;"
      onerror="console.error('Errore caricamento immagine:', this.src); document.getElementById('error-info').style.display = 'block';"
    />
    <div id="error-info" style="position: absolute; bottom: 20px; left: 0; right: 0; text-align: center; background: rgba(255,0,0,0.7); color: white; padding: 10px; display: none;">
      Errore caricamento immagine. URL: ${url}
    </div>
  `;
  
  document.getElementById("image").innerHTML = imgHTML;
  document.getElementById("content-container").style.display = "block";
}

// Funzione che mostra l'immagine con un messaggio informativo per l'utente
function showResultImage(url, sessionId) {
  console.log("Mostro immagine risultato:", url);
  stopWebcam();
  
  // Prepara HTML con info per l'utente che l'immagine è disponibile nell'app
  const imgHTML = `
    <div style="width: 100%; height: 100vh; position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center;">
      <img 
        id="result-image"
        src="${url}" 
        style="width: 100%; height: 90vh; object-fit: contain; display: block; margin: 0 auto;"
        onerror="console.error('Errore caricamento immagine:', this.src); document.getElementById('error-info').style.display = 'block';"
      />
      <div style="position: absolute; bottom: 20px; left: 0; right: 0; text-align: center; background: rgba(0,0,0,0.7); color: white; padding: 15px; font-size: 1.5em;">
        La tua foto è disponibile nell'app! 📱
      </div>
      <div id="error-info" style="position: absolute; bottom: 20px; left: 0; right: 0; text-align: center; background: rgba(255,0,0,0.7); color: white; padding: 10px; display: none;">
        Errore caricamento immagine.
      </div>
    </div>
  `;
  
  document.getElementById("image").innerHTML = imgHTML;
  document.getElementById("content-container").style.display = "block";
}

// Funzione che mostra l'immagine con fallback automatico in caso di errore
function showImageWithFallback(url, fallbackUrl, sessionId, timeout = 5000) {
  console.log("Tentativo di mostrare immagine con fallback:", url);
  stopWebcam();
  
  // Mostra inizialmente l'URL principale
  document.getElementById("image").innerHTML = `
    <div style="width: 100%; height: 100vh; position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center;">
      <img 
        id="result-image"
        src="${url}" 
        style="width: 100%; height: 90vh; object-fit: contain; display: block; margin: 0 auto;"
        onerror="console.error('Errore caricamento immagine principale:', this.src); this.src='${fallbackUrl}'; console.log('Fallback a immagine originale');"
      />
      <div style="position: absolute; bottom: 20px; left: 0; right: 0; text-align: center; background: rgba(0,0,0,0.7); color: white; padding: 15px; font-size: 1.5em;">
        La tua foto è disponibile nell'app! 📱
      </div>
    </div>
  `;
  
  document.getElementById("content-container").style.display = "block";
  
  // Imposta un timeout per il fallback
  setTimeout(() => {
    const img = document.getElementById("result-image");
    if (!img || !img.complete || img.naturalWidth === 0) {
      console.warn("Timeout caricamento immagine, fallback all'originale");
      if (img) img.src = fallbackUrl;
    }
  }, timeout);
}

function showCamera() {
  console.log("Preparazione webcam...");
  
  // Setup DOM structure
  setupDOM();
  
  // Start webcam
  startWebcam().then(success => {
    if (success) {
      console.log("Webcam avviata con successo, contenitore mostrato");
    } else {
      console.error("Webcam non avviata correttamente");
    }
    
    // Show container
    document.getElementById("content-container").style.display = "block";
  });
}

function showLoading(message = "Caricamento foto...") {
  stopWebcam();
  document.getElementById("image").innerHTML = `<div style='color:black;font-size:3em;text-align:center;margin-top:40vh;'>${message}</div>`;
  document.getElementById("content-container").style.display = "block";
}

function showError(message = "Errore caricamento!") {
  stopWebcam();
  document.getElementById("image").innerHTML = `<div style='color:red;font-size:3em;text-align:center;margin-top:40vh;'>${message}</div>`;
  document.getElementById("content-container").style.display = "block";
  
  // Anche in caso di errore, programmiamo il riavvio
  scheduleRestart();
}

// Countdown prima dello scatto
function countdown(seconds) {
  return new Promise(resolve => {
    let remaining = seconds;
    const countdownElement = document.getElementById("countdown-display");
    countdownElement.style.display = "block";
    
    const interval = setInterval(() => {
      countdownElement.innerText = remaining;
      remaining--;
      
      if (remaining < 0) {
        clearInterval(interval);
        countdownElement.style.display = "none";
        resolve();
      }
    }, 1000);
  });
}

// Gestione della sessione e stati
async function gestisciSessione(data, sessionId) {
  const stato = data.status;
  console.log("📡 Stato ricevuto:", stato, "per sessione:", sessionId);

  // Se riceviamo lo stesso stato per la stessa sessione, non processiamo di nuovo
  // eccetto per lo stato ready-for-photo che deve essere sempre processato
  if (stato === lastProcessedStatus && stato !== "ready-for-photo") {
    console.log("Stato già processato, ignoro:", stato);
    return;
  }
  
  // Aggiorna l'ultimo stato processato
  lastProcessedStatus = stato;
  
  // Cancella eventuali timer di riavvio quando riceviamo un nuovo evento
  if (restartTimer && stato !== "photo-uploaded" && stato !== "photo-error") {
    clearTimeout(restartTimer);
    restartTimer = null;
    console.log("Timer di riavvio cancellato per nuovo evento:", stato);
  }

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
    
    try {
      // MODIFICATO: Prima mostriamo la camera in modo asincrono
      showCamera();
      console.log("Webcam avviata, inizio countdown di " + COUNTDOWN_SECONDS + " secondi");
      
      // Breve pausa per assicurarsi che la webcam sia inizializzata
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Countdown prima dello scatto (aumentato a 5 secondi)
      await countdown(COUNTDOWN_SECONDS);
      
      // Scatta la foto e ottieni l'URL
      console.log("Scatto foto...");
      const photoURL = await takePicture(sessionId);
      console.log("Foto scattata, inizia gestione risultato");
      
      // Nascondi camera e mostra caricamento
      stopWebcam();
      showLoading();
      
      // Aggiorna stato in Firebase
      console.log("Aggiornamento stato in Firebase...");
      await db.ref(`sessions/${sessionId}`).update({
        status: "photo-uploaded",
        uploadedImageUrl: photoURL,
        photo_timestamp: Date.now()
      });
      console.log("Stato aggiornato in Firebase");
      
      // Mostra l'immagine
      showImage(photoURL);
      // Mostra caricamento AI
      showLoading("Generazione outfit AI in corso...");

      try {
        console.log("Invio richiesta a Fashn.ai con URL immagine:", photoURL);
        
        // Implementazione dell'API fashn.ai con il flusso di lavoro completo
        // 1. Prima richiesta per iniziare l'elaborazione e ottenere l'ID
        // 2. Polling dello stato fino al completamento
        // 3. Recupero dell'immagine finale
        
        // MODIFICATO: Rimosso il parametro enable_pose_enhancement che causava l'errore
        const requestBody = {
          model_image: photoURL,
          garment_image: "https://specchio.gavprojects.com/vestiti/camicia.jpg",
          category: "tops",
          mode: "quality",
          num_samples: 1
        };
        
        console.log("Corpo richiesta iniziale:", JSON.stringify(requestBody));
        
        try {
          // Step 1: Invia la richiesta iniziale per ottenere l'ID
          const runResponse = await fetch("https://api.fashn.ai/v1/run", {
            method: "POST",
            headers: {
              "Authorization": "Bearer fa-K5eH1DV6BuZg-lMpUcEojYPyA7kEWit4s02XX",
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify(requestBody)
          });
          
          if (!runResponse.ok) {
            const errorText = await runResponse.text();
            console.error(`Risposta non valida da Fashn.ai (run): ${runResponse.status} ${errorText}`);
            throw new Error(`Errore API Fashn.ai (run): ${runResponse.status} ${errorText}`);
          }
          
          const runData = await runResponse.json();
          console.log("Risposta iniziale:", runData);
          
          if (!runData.id) {
            throw new Error("Nessun ID ricevuto nella risposta iniziale");
          }
          
          // Step 2: Inizia il polling dello stato
          const predictionId = runData.id;
          console.log("ID predizione:", predictionId);
          
          // Aggiorna lo stato in Firebase per mostrare che stiamo elaborando
          await db.ref(`sessions/${sessionId}`).update({
            status: "ai-processing",
            ai_prediction_id: predictionId
          });
          
          // Mostra messaggio di caricamento aggiornato
          showLoading("Elaborazione immagine AI in corso...");
          
          // Funzione per verificare lo stato
          const checkStatus = async () => {
            const statusResponse = await fetch(`https://api.fashn.ai/v1/status/${predictionId}`, {
              method: "GET",
              headers: {
                "Authorization": "Bearer fa-K5eH1DV6BuZg-lMpUcEojYPyA7kEWit4s02XX",
                "Accept": "application/json"
              }
            });
            
            if (!statusResponse.ok) {
              const errorText = await statusResponse.text();
              console.error(`Risposta non valida da Fashn.ai (status): ${statusResponse.status} ${errorText}`);
              throw new Error(`Errore API Fashn.ai (status): ${statusResponse.status} ${errorText}`);
            }
            
            const statusData = await statusResponse.json();
            console.log("Stato attuale:", statusData);
            
            return statusData;
          };
          
          // Loop di polling con timeout e backoff
          let attempts = 0;
          const maxAttempts = 30; // 30 tentativi = circa 5 minuti max
          let delay = 5000; // Inizia con 5 secondi
          
          while (attempts < maxAttempts) {
            attempts++;
            const statusData = await checkStatus();
            
            if (statusData.status === "completed" && statusData.output && statusData.output.length > 0) {
              // Success! Abbiamo l'URL dell'immagine generata
              const resultUrl = statusData.output[0];
              console.log("🎨 Immagine AI generata:", resultUrl);
              
              // Aggiorna lo stato in Firebase con l'URL dell'immagine AI generata
              await db.ref(`sessions/${sessionId}`).update({
                status: "ai-generated",
                ai_image_url: resultUrl,
                processing_complete: true
              });
              
              // Mostra l'immagine con il messaggio che è disponibile nell'app
              showResultImage(resultUrl, sessionId);
              
              // Programma il riavvio per quando l'immagine è stata mostrata
              scheduleRestart();
              return; // Usciamo dal try-catch
            } else if (statusData.status === "failed") {
              // L'elaborazione è fallita, estraiamo informazioni più dettagliate sull'errore
              let errorMessage = "Errore sconosciuto";
              if (statusData.error) {
                try {
                  // Se l'errore è un oggetto, proviamo a convertirlo in una stringa leggibile
                  if (typeof statusData.error === 'object') {
                    errorMessage = JSON.stringify(statusData.error);
                  } else {
                    errorMessage = statusData.error;
                  }
                } catch (e) {
                  console.error("Errore nel parsing dell'errore:", e);
                  errorMessage = "Errore durante l'elaborazione AI";
                }
              }
              console.error("Elaborazione AI fallita:", errorMessage);
              
              // MODIFICATO: Non lanciamo un'eccezione, ma mostriamo l'immagine originale
              console.warn("API fallita, utilizzo immagine originale");
              await db.ref(`sessions/${sessionId}`).update({
                status: "photo-displayed",
                note: `AI generation failed: ${errorMessage}`,
                processing_complete: true
              });
              showResultImage(photoURL, sessionId);
              scheduleRestart();
              return;
            } else if (["starting", "in_queue", "processing"].includes(statusData.status)) {
              // Ancora in elaborazione, aggiorna il messaggio e continua il polling
              const statusMessage = {
                "starting": "Inizializzazione AI...",
                "in_queue": "In coda per elaborazione...",
                "processing": "Elaborazione immagine in corso..."
              };
              
              showLoading(statusMessage[statusData.status] || "Elaborazione in corso...");
              
              // Aspetta prima del prossimo tentativo con backoff esponenziale (ma max 15 secondi)
              await new Promise(resolve => setTimeout(resolve, delay));
              delay = Math.min(delay * 1.5, 15000); // Aumenta il delay ma max 15 secondi
            } else {
              // Stato sconosciuto
              console.warn(`Stato sconosciuto: ${statusData.status}`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
          
          // Se arriviamo qui, abbiamo superato il numero massimo di tentativi
          console.error("Timeout durante l'attesa dell'elaborazione AI");
          await db.ref(`sessions/${sessionId}`).update({
            status: "photo-displayed",
            note: "AI generation timeout",
            processing_complete: true
          });
          showResultImage(photoURL, sessionId);
          scheduleRestart();
          
        } catch (err) {
          console.error("❌ Errore chiamata Fashn.ai:", err);
          console.warn("API fallita, utilizzo immagine originale");
          await db.ref(`sessions/${sessionId}`).update({
            status: "photo-displayed",
            note: `AI generation failed: ${err.message}`,
            processing_complete: true
          });
          showResultImage(photoURL, sessionId);
          scheduleRestart();
        }
      } catch (err) {
        console.error("❌ Errore generale:", err);
        showError("Errore connessione con AI: " + err.message);
        scheduleRestart();
      }
      
    } catch (err) {
      console.error("❌ Errore durante il processo:", err);
      showError("Si è verificato un errore. Riprova.");
      
      // Aggiorniamo lo stato in Firebase anche in caso di errore
      await db.ref(`sessions/${sessionId}`).update({
        status: "photo-error",
        error_message: err.message,
        error_timestamp: Date.now()
      });
      
      scheduleRestart();
    }
  }
}

// Ascolta le sessioni da Firebase
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

// Inizializzazione
listenToLatestSession();

// Pulizia quando la pagina si chiude
window.addEventListener('beforeunload', () => {
  stopWebcam();
  if (restartTimer) {
    clearTimeout(restartTimer);
  }
});