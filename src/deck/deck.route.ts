import { Request, Response, Router } from "express";
import { prisma } from "../database";
import { authenticateToken } from "../auth/auth.middleware";

export const decksRoute = Router();

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


// GET /decks/mine - Récupérer tous les decks de l'utilisateur authentifié avec leurs cartes
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
// GET /decks/:id - Récupérer un deck spécifique par son ID
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

// GET /cards - Récupérer toutes les cartes
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

// PATCH /decks/:id - Modifier le nom et/ou les cartes d'un deck
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

// DELETE /decks/:id - Supprimer un deck
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