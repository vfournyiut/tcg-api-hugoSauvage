import { Request, Response, Router } from "express";
import { prisma } from "../database";
import { authenticateToken } from "../auth/auth.middleware";

export const decksRoute = Router();

/**
 * Route POST pour créer un nouveau deck de cartes Pokémon
 * 
 * @route POST /decks
 * @middleware authenticateToken - Vérifie l'authentification de l'utilisateur
 * 
 * @param {Request} req - Objet Request d'Express
 * @param {string} req.body.name - Nom du deck (obligatoire)
 * @param {number[]} req.body.cards - Tableau de 10 numéros Pokédex (obligatoire)
 * @param {number} req.user.userId - ID de l'utilisateur authentifié (ajouté par le middleware)
 * 
 * @param {Response} res - Objet Response d'Express
 * 
 * @returns {Promise<Response>} 201 - Deck créé avec succès
 * @returns {object} deck - Objet du deck créé
 * @returns {number} deck.id - ID du deck
 * @returns {string} deck.name - Nom du deck
 * @returns {Array} deck.cards - Liste des cartes associées au deck
 * 
 * @throws {400} L'ID de l'utilisateur est invalide
 * @throws {400} Le nom du deck est manquant
 * @throws {400} La liste des cartes n'est pas un tableau
 * @throws {400} Le deck ne contient pas exactement 10 cartes
 * @throws {400} Une ou plusieurs cartes n'existent pas en base de données
 * @throws {500} Erreur serveur lors de la création du deck
 */
decksRoute.post("/", authenticateToken, async (req: Request, res: Response) => {
    try {
        const { name, cards } = req.body;
        const userId = req.user?.userId;

        if(!userId){
            return res.status(400).json({ error: "l'id de l'utilisateur est invaide" });

        }

        // Nom manquant
        if (!name) {
            return res.status(400).json({ error: "Le nom du deck est obligatoire" });
        }

        // Cards invalide ou pas un tableau
        if (!Array.isArray(cards)) {
            return res.status(400).json({ error: "La liste des cartes est invalide" });
        }


        if (cards.length !== 10) {
            return res.status(400).json({ error: "Un deck doit contenir exactement 10 cartes" });
        }

        // Vérifier que les cartes existent en base
        const existingCards = await prisma.card.findMany({
            where: {
                pokedexNumber: { in: cards },
            },
        });

        if (existingCards.length !== 10) {
            return res.status(400).json({ error: "Une ou plusieurs cartes sont invalides" });
        }

        // Création du deck
        const deck = await prisma.deck.create({
            data: {
                name,
                userId,
                cards: {
                    create: existingCards.map((existingCards) => ({ cardId:existingCards.id })),
                },
            },
            select: {
                id: true,
                name: true,
                cards: true,
            },
        });
    return res.status(201).json(deck);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erreur serveur" });
    }

    
});


/**
 * Route GET pour récupérer tous les decks de l'utilisateur authentifié
 * 
 * @route GET /decks/mine
 * @middleware authenticateToken - Vérifie l'authentification de l'utilisateur
 * 
 * @param {Request} req - Objet Request d'Express
 * @param {number} req.user.userId - ID de l'utilisateur authentifié (ajouté par le middleware)
 * 
 * @param {Response} res - Objet Response d'Express
 * 
 * @returns {Promise<Response>} 200 - Liste des decks récupérée avec succès
 * @returns {Array<object>} decks - Tableau des decks de l'utilisateur
 * @returns {number} decks[].id - ID du deck
 * @returns {string} decks[].name - Nom du deck
 * @returns {number} decks[].userId - ID du propriétaire
 * @returns {Date} decks[].createdAt - Date de création
 * @returns {Array} decks[].cards - Liste des cartes avec leurs détails complets
 * 
 * @throws {401} Utilisateur non authentifié (normalement géré par le middleware)
 * @throws {500} Erreur serveur lors de la récupération des decks
 * 
 */
decksRoute.get('/mine', authenticateToken, async (req: Request, res: Response) => {  
    try {
        const userId = req.user?.userId;

        // Si pas d'userId (normalement impossible avec authenticateToken, mais par sécurité)
        if (!userId) {
            return res.status(401).json({ error: "Utilisateur non authentifié" });
        }

        // Récupérer les decks de l'utilisateur avec leurs cartes
        const decks = await prisma.deck.findMany({
            where: {
                userId: userId
            },
            include: {
                cards: {
                    include: {
                        card: true  // Inclure les détails complets de chaque carte
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        return res.status(200).json(decks);
    } catch (error) {
        console.error('Erreur lors de la récupération des decks :', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * Route GET pour récupérer un deck spécifique par son ID
 * 
 * @route GET /decks/:id
 * @middleware authenticateToken - Vérifie l'authentification de l'utilisateur
 * 
 * @param {Request} req - Objet Request d'Express
 * @param {string} req.params.id - ID du deck à récupérer
 * @param {number} req.user.userId - ID de l'utilisateur authentifié (ajouté par le middleware)
 * 
 * @param {Response} res - Objet Response d'Express
 * 
 * @returns {Promise<Response>} 200 - Deck récupéré avec succès
 * @returns {object} deck - Objet du deck
 * @returns {number} deck.id - ID du deck
 * @returns {string} deck.name - Nom du deck
 * @returns {number} deck.userId - ID du propriétaire
 * @returns {Date} deck.createdAt - Date de création
 * @returns {Array} deck.cards - Liste des cartes avec leurs détails complets
 * 
 * @throws {400} L'ID du deck n'est pas un nombre valide
 * @throws {401} Utilisateur non authentifié
 * @throws {404} Le deck n'existe pas ou n'appartient pas à l'utilisateur
 * @throws {500} Erreur serveur lors de la récupération du deck
 */
decksRoute.get('/:id', authenticateToken, async (req: Request, res: Response) => {  
    try {
        const userId = req.user?.userId;
        const deckId = parseInt(req.params.id);

        // Vérifier que l'ID est un nombre valide
        if (isNaN(deckId)) {
            return res.status(400).json({ error: "ID de deck invalide" });
        }

        // Si pas d'userId
        if (!userId) {
            return res.status(401).json({ error: "Utilisateur non authentifié" });
        }

        // Récupérer le deck avec vérification du propriétaire
        const deck = await prisma.deck.findFirst({
            where: {
                id: deckId,
                userId: userId  // S'assurer que le deck appartient à l'utilisateur
            },
            include: {
                cards: {
                    include: {
                        card: true
                    }
                }
            }
        });

        // Si le deck n'existe pas ou n'appartient pas à l'utilisateur
        if (!deck) {
            return res.status(404).json({ error: "Deck non trouvé" });
        }
        
        return res.status(200).json(deck);
    } catch (error) {
        console.error('Erreur lors de la récupération du deck :', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * Route GET pour récupérer toutes les cartes disponibles
 * Note: Cette route devrait probablement être dans un fichier cards.route.ts
 * 
 * @route GET /decks
 * @access Public - Aucune authentification requise
 * 
 * @param {Request} _req - Objet Request d'Express (non utilisé)
 * @param {Response} res - Objet Response d'Express
 * 
 * @returns {Promise<Response>} 200 - Liste des cartes récupérée avec succès
 * @returns {Array<object>} cards - Tableau de toutes les cartes triées par numéro Pokédex
 * @returns {number} cards[].id - ID de la carte
 * @returns {number} cards[].pokedexNumber - Numéro du Pokédex
 * @returns {string} cards[].name - Nom du Pokémon
 * @returns {string} cards[].type - Type du Pokémon
 * @returns {number} cards[].hp - Points de vie
 * @returns {number} cards[].attack - Points d'attaque
 * @returns {number} cards[].defense - Points de défense
 * @returns {string} cards[].imageUrl - URL de l'image
 * 
 * @throws {500} Erreur serveur lors de la récupération des cartes
 * 
 */
decksRoute.get('/', async (_req: Request, res: Response) => {  
    try {
        const cards = await prisma.card.findMany({
            orderBy: { pokedexNumber: 'asc' }
        })
        
        return res.status(200).json(cards)
    } catch (error) {
        console.error('Erreur lors de la recherche :', error)
        return res.status(500).json({error: 'Erreur serveur'})
    }
})

/**
 * Route PATCH pour modifier un deck existant (nom et/ou cartes)
 * 
 * @route PATCH /decks/:id
 * @middleware authenticateToken - Vérifie l'authentification de l'utilisateur
 * 
 * @param {Request} req - Objet Request d'Express
 * @param {string} req.params.id - ID du deck à modifier
 * @param {number} req.user.userId - ID de l'utilisateur authentifié (ajouté par le middleware)
 * @param {string} [req.body.name] - Nouveau nom du deck (optionnel)
 * @param {number[]} [req.body.cards] - Nouveau tableau de 10 numéros Pokédex (optionnel)
 * 
 * @param {Response} res - Objet Response d'Express
 * 
 * @returns {Promise<Response>} 200 - Deck modifié avec succès
 * @returns {object} deck - Objet du deck mis à jour
 * @returns {number} deck.id - ID du deck
 * @returns {string} deck.name - Nom du deck (nouveau si modifié)
 * @returns {Array} deck.cards - Liste des cartes avec leurs détails complets
 * 
 * @throws {400} L'ID du deck n'est pas un nombre valide
 * @throws {400} La liste des cartes n'est pas un tableau
 * @throws {400} Le deck ne contient pas exactement 10 cartes
 * @throws {400} Une ou plusieurs cartes n'existent pas en base de données
 * @throws {401} Utilisateur non authentifié
 * @throws {403} Le deck n'appartient pas à l'utilisateur
 * @throws {404} Le deck n'existe pas
 * @throws {500} Erreur serveur lors de la modification du deck
 * 
 */
decksRoute.patch('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const deckId = parseInt(req.params.id);
        const { name, cards } = req.body;

        // Vérifier que l'ID est un nombre valide
        if (isNaN(deckId)) {
            return res.status(400).json({ error: "ID de deck invalide" });
        }

        // Si pas d'userId
        if (!userId) {
            return res.status(401).json({ error: "Utilisateur non authentifié" });
        }

        // Vérifier que le deck existe et appartient à l'utilisateur
        const existingDeck = await prisma.deck.findUnique({
            where: { id: deckId }
        });
        console.log(existingDeck)
        
        if (!existingDeck) {
            return res.status(404).json({ error: "Deck non trouvé" });
        }

        if (existingDeck.userId !== userId) {
            return res.status(403).json({ error: "Accès interdit : ce deck ne vous appartient pas" });
        }

        // Validation des cartes si elles sont fournies
        if (cards !== undefined) {
            // Vérifier que c'est un tableau
            if (!Array.isArray(cards)) {
                return res.status(400).json({ error: "La liste des cartes est invalide" });
            }

            // Vérifier qu'il y a exactement 10 cartes
            if (cards.length !== 10) {
                return res.status(400).json({ error: "Un deck doit contenir exactement 10 cartes" });
            }

            // Vérifier que les cartes existent en base
            const validCards = await prisma.card.findMany({
                where: {
                    pokedexNumber: { in: cards }
                }
            });

            if (validCards.length !== 10) {
                return res.status(400).json({ error: "Une ou plusieurs cartes sont invalides" });
            }

            // Supprimer les anciennes associations et créer les nouvelles
            await prisma.deckCard.deleteMany({
                where: { deckId: deckId }
            });

            await prisma.deckCard.createMany({
                data: validCards.map((card) => ({
                    deckId: deckId,
                    cardId: card.id
                }))
            });
        }

        // Mettre à jour le nom si fourni
        const updatedDeck = await prisma.deck.update({
            where: { id: deckId },
            data: {
                ...(name && { name })
            },
            include: {
                cards: {
                    include: {
                        card: true
                    }
                }
            }
        });

        return res.status(200).json(updatedDeck);

    } catch (error) {
        console.error('Erreur lors de la modification du deck :', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * Route DELETE pour supprimer un deck
 * 
 * @route DELETE /decks/:id
 * @middleware authenticateToken - Vérifie l'authentification de l'utilisateur
 * 
 * @param {Request} req - Objet Request d'Express
 * @param {string} req.params.id - ID du deck à supprimer
 * @param {number} req.user.userId - ID de l'utilisateur authentifié (ajouté par le middleware)
 * 
 * @param {Response} res - Objet Response d'Express
 * 
 * @returns {Promise<Response>} 200 - Deck supprimé avec succès
 * @returns {object} response - Message de confirmation
 * @returns {string} response.message - "Deck supprimé avec succès"
 * 
 * @throws {400} L'ID du deck n'est pas un nombre valide
 * @throws {401} Utilisateur non authentifié
 * @throws {403} Le deck n'appartient pas à l'utilisateur
 * @throws {404} Le deck n'existe pas
 * @throws {500} Erreur serveur lors de la suppression du deck
 * 
 */
decksRoute.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const deckId = parseInt(req.params.id);

        // Vérifier que l'ID est un nombre valide
        if (isNaN(deckId)) {
            return res.status(400).json({ error: "ID de deck invalide" });
        }

        // Si pas d'userId
        if (!userId) {
            return res.status(401).json({ error: "Utilisateur non authentifié" });
        }

        // Vérifier que le deck existe et appartient à l'utilisateur
        const existingDeck = await prisma.deck.findUnique({
            where: { id: deckId }
        });

        if (!existingDeck) {
            return res.status(404).json({ error: "Deck non trouvé" });
        }

        if (existingDeck.userId !== userId) {
            return res.status(403).json({ error: "Accès interdit : ce deck ne vous appartient pas" });
        }

        // Supprimer les DeckCards associés puis le deck
        await prisma.deckCard.deleteMany({
            where: { deckId: deckId }
        });

        await prisma.deck.delete({
            where: { id: deckId }
        });

        return res.status(200).json({ message: "Deck supprimé avec succès" });

    } catch (error) {
        console.error('Erreur lors de la suppression du deck :', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
});