
const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json({ limit: "10mb" }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.post("/upload", (req, res) => {
  const { imageBase64 } = req.body;

  if (!imageBase64 || !imageBase64.startsWith("data:image")) {
    return res.status(400).json({ message: "Formato immagine non valido." });
  }

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const timestamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);
  const filePath = path.join(__dirname, "input", `scatto_${timestamp}.jpg`);

  fs.writeFile(filePath, base64Data, "base64", (err) => {
    if (err) {
      console.error("Errore salvataggio file:", err);
      return res.status(500).json({ message: "Errore durante il salvataggio." });
    }
    console.log("✅ Foto salvata in:", filePath);
    res.json({ message: "Foto ricevuta e salvata con successo.", filePath });
  });
});

app.listen(PORT, () => {
  console.log(`📡 Server in ascolto su http://localhost:${PORT}`);
});
