import express from "express";
import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.static("public"));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SECRET = process.env.AGENTE_SECRET || "dev-secret";

// 🔑 función que firma el userId
function signUserId(userId) {
  return crypto.createHmac("sha256", SECRET).update(userId).digest("hex");
}

// 📌 endpoint para firmar usuario y devolver metadata
app.get("/sign", (req, res) => {
  const {
    userId,
    userName,
    userSurname,
    userEmail,
    account,
    location,
    language,
    error
  } = req.query;

  const user_id = userId || "user-12345";
  const user_hash = signUserId(user_id);

  res.json({
    user_id,
    user_hash,
    user_metadata: {
      ...(userName   && { name: userName }),
      ...(userSurname && { surname: userSurname }),
      ...(userEmail  && { email: userEmail }),
      ...(account    && { account }),
      ...(location   && { location }),
      ...(language   && { language }),
      ...(error      && { error })
    }
  });
});

// 📌 redirigir raíz "/" a index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});