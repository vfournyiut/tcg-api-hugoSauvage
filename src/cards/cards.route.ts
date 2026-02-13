import { Request, Response, Router } from 'express';
import { prisma } from "../database";

export const cardsRouter = Router();

/**
 * Route GET pour récupérer toutes les cartes Pokémon disponibles
 * 
 * @route GET /cards
 * @access Public - Aucune authentification requise
 * 
 * @param {Request} _req - Objet Request d'Express (non utilisé, d'où le underscore)
 * @param {Response} res - Objet Response d'Express
 * 
 * @returns {Promise<Response>} 200 - Liste des cartes récupérée avec succès
 * @returns {Array<object>} cards - Tableau de toutes les cartes triées par numéro Pokédex croissant
 * @returns {number} cards[].id - ID unique de la carte en base de données
 * @returns {number} cards[].pokedexNumber - Numéro du Pokédex (1-151 pour la première génération)
 * @returns {string} cards[].name - Nom du Pokémon
 * @returns {string} cards[].type - Type du Pokémon (ex: "Fire", "Water", "Grass", etc.)
 * @returns {number} cards[].hp - Points de vie du Pokémon
 * @returns {number} cards[].attack - Points d'attaque du Pokémon
 * @returns {number} cards[].defense - Points de défense du Pokémon
 * @returns {string} cards[].imageUrl - URL de l'image du Pokémon
 * @returns {Date} [cards[].createdAt] - Date de création de l'entrée (si présent dans le modèle)
 * @returns {Date} [cards[].updatedAt] - Date de dernière modification (si présent dans le modèle)
 * 
 * @throws {500} Erreur serveur lors de la récupération des cartes depuis la base de données
 * 
 * @description
 * Cette route publique permet de récupérer l'intégralité du catalogue de cartes Pokémon.
 * Les cartes sont automatiquement triées par numéro Pokédex croissant (1, 2, 3...).
 * Aucune authentification n'est requise pour accéder à cette ressource.
 * 
 * Cas d'usage typiques :
 * - Afficher le catalogue complet des cartes disponibles
 * - Permettre aux utilisateurs de sélectionner des cartes pour créer un deck
 * - Alimenter un système de recherche ou de filtrage côté client
 * 
 */
cardsRouter.get('/', async (_req: Request, res: Response) => {  
    try {
        const cards = await prisma.card.findMany({
            orderBy: { pokedexNumber: 'asc' }
        });
        
        return res.status(200).json(cards);
    } catch (error) {
        console.error('Erreur lors de la recherche :', error);
        return res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default cardsRouter;