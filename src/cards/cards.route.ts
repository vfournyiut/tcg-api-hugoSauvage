import { Request, Response, Router } from 'express'
import { prisma } from '../database'

export const cardsRouter = Router()

// GET /cards - Récupérer toutes les cartes
cardsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const cards = await prisma.card.findMany({
      orderBy: { pokedexNumber: 'asc' },
    })

    return res.status(200).json(cards)
  } catch (error) {
    console.error('Erreur lors de la recherche :', error)
    return res.status(500).json({ error: 'Erreur serveur' })
  }
})

export default cardsRouter
