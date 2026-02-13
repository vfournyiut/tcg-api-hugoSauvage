import { Request, Response, Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from "../../src/database";

export const authRouter = Router();

/**
 * Route POST pour l'inscription d'un nouvel utilisateur
 * 
 * @route POST /auth/sign-up
 * @access Public - Aucune authentification requise
 * 
 * @param {Request} req - Objet Request d'Express
 * @param {string} req.body.email - Adresse email de l'utilisateur (unique, obligatoire)
 * @param {string} req.body.username - Nom d'utilisateur (obligatoire)
 * @param {string} req.body.password - Mot de passe en clair (obligatoire, sera hashé avec bcrypt)
 * 
 * @param {Response} res - Objet Response d'Express
 * 
 * @returns {Promise<Response>} 201 - Utilisateur créé avec succès
 * @returns {string} message - Message de confirmation
 * @returns {string} token - JWT token valide pour 7 jours
 * @returns {object} user - Informations de l'utilisateur créé
 * @returns {number} user.id - ID de l'utilisateur
 * @returns {string} user.name - Nom d'utilisateur
 * @returns {string} user.email - Email de l'utilisateur
 * 
 * @throws {400} Données manquantes (email, username ou password)
 * @throws {409} Un utilisateur avec cet email existe déjà
 * @throws {500} Erreur serveur lors de l'inscription
 * 
 * @description
 * Cette route permet l'inscription d'un nouvel utilisateur dans le système.
 * Processus d'inscription :
 * 1. Validation de la présence de toutes les données requises
 * 2. Vérification de l'unicité de l'email
 * 3. Hachage du mot de passe avec bcrypt (salt rounds: 10)
 * 4. Création de l'utilisateur en base de données
 * 5. Génération d'un JWT token valide 7 jours
 * 6. Retour du token et des informations utilisateur
 * 
 * Sécurité :
 * - Le mot de passe est hashé avec bcrypt (coût: 10)
 * - Le JWT est signé avec une clé secrète (JWT_SECRET)
 * - Le mot de passe n'est jamais retourné dans la réponse
 * - L'email doit être unique (contrainte base de données)
 * 
 */
authRouter.post('/sign-up', async (req: Request, res: Response) => {
    const { email, username, password } = req.body;

    try {
        // 1. Vérifier que toutes les données sont présentes
        if (!email || !username || !password) {
            return res.status(400).json({ error: "Donnée manquante" });
        }

        // 2. Vérifier que l'utilisateur n'existe pas déjà
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(409).json({ error: 'Un utilisateur avec cet email existe déjà' });
        }

        // 3. Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 4. Création de l'utilisateur
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                email,
            }
        });

        // 5. Générer le JWT
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
            },
            process.env.JWT_SECRET as string,
            { expiresIn: '7d' },
        );

        // 6. Retourner le token
        return res.status(201).json({
            message: 'Utilisateur créé avec succès',
            token,
            user: {
                id: user.id,
                name: user.username,
                email: user.email,
            },
        });
    } catch (error) {
        console.error('Erreur lors de l\'inscription:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * Route POST pour la connexion d'un utilisateur existant
 * 
 * @route POST /auth/sign-in
 * @access Public - Aucune authentification requise
 * 
 * @param {Request} req - Objet Request d'Express
 * @param {string} req.body.email - Adresse email de l'utilisateur (obligatoire)
 * @param {string} req.body.password - Mot de passe en clair (obligatoire)
 * 
 * @param {Response} res - Objet Response d'Express
 * 
 * @returns {Promise<Response>} 200 - Connexion réussie
 * @returns {string} message - Message de confirmation
 * @returns {string} token - JWT token valide pour 7 jours
 * @returns {object} user - Informations de l'utilisateur connecté
 * @returns {number} user.id - ID de l'utilisateur
 * @returns {string} user.name - Nom d'utilisateur
 * @returns {string} user.email - Email de l'utilisateur
 * 
 * @throws {400} Données manquantes (email ou password)
 * @throws {401} Email ou mot de passe incorrect (utilisateur non trouvé)
 * @throws {401} Email ou mot de passe incorrect (mot de passe invalide)
 * @throws {500} Erreur serveur lors de la connexion
 * 
 * @description
 * Cette route permet la connexion d'un utilisateur existant.
 * Processus de connexion :
 * 1. Validation de la présence de l'email et du mot de passe
 * 2. Recherche de l'utilisateur par email
 * 3. Vérification du mot de passe avec bcrypt.compare()
 * 4. Génération d'un nouveau JWT token valide 7 jours
 * 5. Retour du token et des informations utilisateur
 * 
 * Sécurité :
 * - Utilise bcrypt.compare() pour vérifier le mot de passe hashé
 * - Retourne le même message d'erreur que l'utilisateur existe ou non (évite l'énumération)
 * - Génère un nouveau token à chaque connexion
 * - Le mot de passe n'est jamais retourné dans la réponse
 * - Code 401 (Unauthorized) pour les erreurs d'authentification
 * 
 */
authRouter.post('/sign-in', async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        // 1. Vérifier que toutes les données sont présentes
        if (!email || !password) {
            return res.status(400).json({ error: "Donnée manquante" });
        }

        // 2. Vérifier que l'utilisateur existe (SANS le password dans le where!)
        const user = await prisma.user.findUnique({
            where: { email },  // ← CORRIGÉ: on cherche seulement par email
        });

        if (!user) {
            return res.status(401).json({ error: "Email ou mot de passe incorrect" });
        }

        // 3. Vérifier le mot de passe
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: "Email ou mot de passe incorrect" });
        }

        // 4. Générer le JWT
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
            },
            process.env.JWT_SECRET as string,
            { expiresIn: '7d' },
        );

        // 5. Retourner le token
        return res.status(200).json({
            message: 'Connexion réussie',
            token,
            user: {
                id: user.id,
                name: user.username,
                email: user.email,
            },
        });
    } catch (error) {
        console.error('Erreur lors de la connexion:', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
});