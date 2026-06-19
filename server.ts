import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
const app = express();
const PORT = 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "A0406081020";

const SUBMISSIONS_FILE = path.join(process.cwd(), "submissions.json");

// Helper to read submissions
function readSubmissions(): any[] {
  try {
    if (!fs.existsSync(SUBMISSIONS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(SUBMISSIONS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading submissions file:", error);
    return [];
  }
}

// Helper to write submissions
function writeSubmissions(submissions: any[]): void {
  try {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing submissions file:", error);
  }
}

// Increase payload size limit to support base64 image uploads
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// API Routes
// 1. Submit form data to local file-based storage
app.post("/api/submissions", async (req, res) => {
  try {
    const { username, imageProof, gamepassLink } = req.body;

    if (!username) {
      return res.status(400).json({ error: "Roblox username is required" });
    }

    if (!imageProof) {
      return res.status(400).json({ error: "Proof photo is required" });
    }

    const newSubmission = {
      id: Date.now().toString(),
      username: username.trim(),
      usernameLower: username.trim().toLowerCase(),
      imageProof,
      gamepassLink: gamepassLink || "",
      status: "pending", // pending, approved, rejected
      createdAt: new Date().toISOString(),
    };

    const submissions = readSubmissions();
    submissions.push(newSubmission);
    writeSubmissions(submissions);

    res.status(201).json({ success: true, submission: newSubmission });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to submit data" });
  }
});

// 2. Fetch Roblox Username Details & Avatar (Proxy to bypass CORS)
app.get("/api/roblox-user/:username", async (req, res) => {
  const { username } = req.params;
  try {
    // Stage 1: Get User ID from Username
    const userSearchUrl = `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=1`;
    const searchResponse = await fetch(userSearchUrl);
    
    if (!searchResponse.ok) {
      throw new Error(`Roblox API returned status ${searchResponse.status}`);
    }
    
    const searchData: any = await searchResponse.json();
    if (!searchData.data || searchData.data.length === 0) {
      return res.status(404).json({ error: "Roblox user not found" });
    }

    const user = searchData.data[0];
    const userId = user.id;
    const displayName = user.displayName;

    // Stage 2: Get Avatar Headshot
    const avatarUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=true`;
    const avatarResponse = await fetch(avatarUrl);
    let imageUrl = "";

    if (avatarResponse.ok) {
      const avatarData: any = await avatarResponse.json();
      if (avatarData.data && avatarData.data.length > 0) {
        imageUrl = avatarData.data[0].imageUrl;
      }
    }

    res.json({
      id: userId,
      username: user.name,
      displayName,
      avatarUrl: imageUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(username)}`,
    });
  } catch (error: any) {
    // If standard Roblox API is down/rate-limited, return fallback with standard dicebear avatar
    res.json({
      id: "fallback",
      username,
      displayName: username,
      avatarUrl: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(username)}`,
      warning: "Fallback triggered",
    });
  }
});

// 2.5. Check Status of submission by username (Public lookup for checking status via local JSON file)
app.get("/api/submissions/status/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const lowerUsername = username.trim().toLowerCase();
    
    const submissions = readSubmissions();
    const userSubmissions = submissions.filter(
      (sub) => sub.usernameLower === lowerUsername
    );
    
    // Sort newest first
    userSubmissions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ submissions: userSubmissions });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to search status" });
  }
});

// 2.6. Check multiple submission statuses by ID list (Device checks via local JSON file)
app.post("/api/submissions/check-statuses", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: "IDs must be an array" });
    }
    if (ids.length === 0) {
      return res.json({ submissions: [] });
    }

    const submissions = readSubmissions();
    const matches = submissions.filter((sub) => ids.includes(sub.id));

    matches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ submissions: matches });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to check device status" });
  }
});

// Admin Middleware Check
const checkAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers["x-admin-password"];
  if (authHeader === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized access. Invalid password." });
  }
};

// 3. Get all submissions (Admin only via local JSON file)
app.get("/api/submissions", checkAdminAuth, async (req, res) => {
  try {
    const submissions = readSubmissions();
    // Sort newest first
    submissions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ submissions });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to retrieve submissions" });
  }
});

// 4. Update status of a submission (Admin only via local JSON file)
app.put("/api/submissions/:id/status", checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const submissions = readSubmissions();
    const index = submissions.findIndex((sub) => sub.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "Submission not found" });
    }

    submissions[index].status = status;
    writeSubmissions(submissions);

    res.json({ success: true, submission: submissions[index] });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update submission" });
  }
});

// 5. Delete specific submission (Admin only via local JSON file)
app.delete("/api/submissions/:id", checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const submissions = readSubmissions();
    const index = submissions.findIndex((sub) => sub.id === id);

    if (index === -1) {
      return res.status(404).json({ error: "Submission not found" });
    }

    submissions.splice(index, 1);
    writeSubmissions(submissions);
    res.json({ success: true, message: "Submission deleted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete submission" });
  }
});

// 6. Clear all submissions (Admin only via local JSON file)
app.post("/api/submissions/clear", checkAdminAuth, async (req, res) => {
  try {
    writeSubmissions([]);
    res.json({ success: true, message: "All submissions cleared" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to clear submissions" });
  }
});

// 7. Verify Admin Password
app.post("/api/admin/verify", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Password salah!" });
  }
});

// Integration with Vite
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
