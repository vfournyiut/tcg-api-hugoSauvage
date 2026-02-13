import { createServer } from "http";
import { env } from "./env";
import express from "express";
import cors from "cors";
import 'dotenv/config';
import swaggerUi from "swagger-ui-express";

import { authRouter } from "../src/auth/auth.route";
import CardRoute from "./cards/cards.route";
import { decksRoute } from "./deck/deck.route";
import { swaggerDocument } from "./docs";

// Create Express app
export const app = express();

// Middlewares
app.use(
    cors({
        origin: true,
        credentials: true,
    }),
);

app.use(express.json());

// Serve static files
app.use(express.static('public'));

// Swagger Documentation
app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: "TCG API Documentation",
    })
);

// Route d'accueil
app.get("/", (_req, res) => {
    res.status(200).send("Bienvenue sur le serveur TCG Backend 🚀");
});

// ✅ Route GET pour éviter "Cannot GET /api/auth"
app.get("/api/auth", (_req, res) => {
    res.status(200).json({
        message: "Auth route is accessible 🚀",
        info: "Use POST /api/auth/login or /api/auth/register"
    });
});

// Health check endpoint
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", message: "TCG Backend Server is running" });
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/cards", CardRoute);
app.use("/api/decks", decksRoute);

// Start server only if run directly
if (require.main === module) {
    const httpServer = createServer(app);

    try {
        httpServer.listen(env.PORT, () => {
            console.log(`\n🚀 Server is running on http://localhost:${env.PORT}`);
            console.log(`📚 Swagger docs at http://localhost:${env.PORT}/api-docs`);
            console.log(`🔐 Auth routes at http://localhost:${env.PORT}/api/auth`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}
