import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'

// Mock middleware before importing app
vi.mock('../src/auth/auth.middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/auth/auth.middleware')>()
  return {
    ...actual,
    authenticateToken: vi.fn(actual.authenticateToken)
  }
})

import { app } from '../src/index'
import { prismaMock } from './vitest.setup'
import jwt from 'jsonwebtoken'
import { authenticateToken } from '../src/auth/auth.middleware'

describe('Deck Endpoints', () => {
  const userId = 1
  const userEmail = 'test@example.com'
  let token: string
  const validDeck = {
    name: 'My Deck',
    cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] // pokedexNumbers
  }

  beforeEach(() => {
    token = jwt.sign({ userId: userId, email: userEmail }, process.env.JWT_SECRET || 'default-secret')
    vi.clearAllMocks()
    
    // Restore original implementation by default
    vi.mocked(authenticateToken).mockImplementation(async (req, res, next) => {
      const authHeader = req.headers.authorization
      const t = authHeader && authHeader.split(' ')[1]
      if (!t) return res.status(401).json({error: 'Token manquant'})
      try {
        const decoded = jwt.verify(t, process.env.JWT_SECRET as string) as any
        req.user = { userId: decoded.userId, email: decoded.email }
        next()
      } catch (e) {
        return res.status(401).json({error: 'Token invalide'})
      }
    })
  })

  describe('POST /api/decks', () => {
    it('devrait créer un deck avec succès', async () => {
      // Mock cards existing (par pokedexNumber)
      prismaMock.card.findMany.mockResolvedValue(
        validDeck.cards.map((pokedexNumber, index) => ({ 
          id: index + 1,
          pokedexNumber,
          name: `Pokemon ${pokedexNumber}`
        } as any))
      )
      
      // Mock create deck
      prismaMock.deck.create.mockResolvedValue({
        id: 1,
        name: validDeck.name,
        userId: userId,
        cards: [],
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)

      const res = await request(app)
        .post('/api/decks')
        .set('Authorization', `Bearer ${token}`)
        .send(validDeck)

      expect(res.status).toBe(201)
      expect(res.body.name).toBe(validDeck.name)
    })

    it('devrait rejeter si non authentifié', async () => {
      const res = await request(app)
        .post('/api/decks')
        .send(validDeck)

      expect(res.status).toBe(401)
    })

    it('devrait rejeter si le nom manque', async () => {
      const res = await request(app)
        .post('/api/decks')
        .set('Authorization', `Bearer ${token}`)
        .send({ cards: validDeck.cards })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Le nom du deck est obligatoire')
    })

    it('devrait rejeter si le nombre de cartes n\'est pas 10', async () => {
      const res = await request(app)
        .post('/api/decks')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Deck', cards: [1, 2] })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Un deck doit contenir exactement 10 cartes')
    })

    it('devrait rejeter si cards n\'est pas un tableau', async () => {
      const res = await request(app)
        .post('/api/decks')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Deck', cards: 'invalid' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('La liste des cartes est invalide')
    })

    it('devrait rejeter si des cartes n\'existent pas', async () => {
      prismaMock.card.findMany.mockResolvedValue([]) // Aucune carte trouvée

      const res = await request(app)
        .post('/api/decks')
        .set('Authorization', `Bearer ${token}`)
        .send(validDeck)

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Une ou plusieurs cartes sont invalides')
    })

    it('devrait retourner 500 en cas d\'erreur DB', async () => {
      prismaMock.card.findMany.mockRejectedValue(new Error('DB Error'))
      
      const res = await request(app)
        .post('/api/decks')
        .set('Authorization', `Bearer ${token}`)
        .send(validDeck)
      
      expect(res.status).toBe(500)
    })
  })

  describe('GET /api/decks/mine', () => {
    it('devrait récupérer mes decks', async () => {
      prismaMock.deck.findMany.mockResolvedValue([
        { 
          id: 1, 
          name: 'Deck 1', 
          userId: userId, 
          cards: [],
          createdAt: new Date(),
          updatedAt: new Date()
        } as any
      ])

      const res = await request(app)
        .get('/api/decks/mine')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body[0].name).toBe('Deck 1')
      expect(prismaMock.deck.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: userId }
      }))
    })

    it('devrait retourner 500 en cas d\'erreur', async () => {
      prismaMock.deck.findMany.mockRejectedValue(new Error('DB'))
      
      const res = await request(app)
        .get('/api/decks/mine')
        .set('Authorization', `Bearer ${token}`)
      
      expect(res.status).toBe(500)
    })
  })

  describe('GET /api/decks/:id', () => {
    it('devrait récupérer un deck par id', async () => {
      prismaMock.deck.findFirst.mockResolvedValue({
        id: 1,
        name: 'Deck 1',
        userId: userId,
        cards: [],
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)

      const res = await request(app)
        .get('/api/decks/1')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.name).toBe('Deck 1')
    })

    it('devrait retourner 404 si le deck n\'existe pas', async () => {
      prismaMock.deck.findFirst.mockResolvedValue(null)

      const res = await request(app)
        .get('/api/decks/999')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Deck non trouvé')
    })

    it('devrait retourner 400 si l\'ID invalide', async () => {
      const res = await request(app)
        .get('/api/decks/abc')
        .set('Authorization', `Bearer ${token}`)
      
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('ID de deck invalide')
    })

    it('devrait retourner 500 en cas d\'erreur', async () => {
      prismaMock.deck.findFirst.mockRejectedValue(new Error('DB'))
      
      const res = await request(app)
        .get('/api/decks/1')
        .set('Authorization', `Bearer ${token}`)
      
      expect(res.status).toBe(500)
    })
  })

  describe('PATCH /api/decks/:id', () => {
    const validUpdate = {
      name: 'Updated Name',
      cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    }

    it('devrait mettre à jour un deck', async () => {
      prismaMock.deck.findUnique.mockResolvedValue({
        id: 1, 
        userId: userId,
        name: 'Old Name',
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)

      prismaMock.card.findMany.mockResolvedValue(
        validUpdate.cards.map((pokedexNumber, index) => ({ 
          id: index + 1,
          pokedexNumber
        } as any))
      )

      prismaMock.deckCard.deleteMany.mockResolvedValue({ count: 10 } as any)
      prismaMock.deckCard.createMany.mockResolvedValue({ count: 10 } as any)

      prismaMock.deck.update.mockResolvedValue({
        id: 1, 
        name: 'Updated Name', 
        userId: userId,
        cards: [],
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)

      const res = await request(app)
        .patch('/api/decks/1')
        .set('Authorization', `Bearer ${token}`)
        .send(validUpdate)
      
      expect(res.status).toBe(200)
      expect(prismaMock.deck.update).toHaveBeenCalled()
    })

    it('devrait retourner 403 si non propriétaire', async () => {
      prismaMock.deck.findUnique.mockResolvedValue({
        id: 1, 
        userId: 999,
        name: 'Deck',
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)

      const res = await request(app)
        .patch('/api/decks/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New' })
      
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('Accès interdit : ce deck ne vous appartient pas')
    })

    it('devrait échouer si cartes incorrectes (check length)', async () => {
      prismaMock.deck.findUnique.mockResolvedValue({
        id: 1, 
        userId: userId,
        name: 'Deck',
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)

      const res = await request(app)
        .patch('/api/decks/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ cards: [1, 2] })
      
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Un deck doit contenir exactement 10 cartes')
    })

    it('devrait échouer si cartes n\'est pas un tableau', async () => {
      prismaMock.deck.findUnique.mockResolvedValue({
        id: 1, 
        userId: userId,
        name: 'Deck',
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)

      const res = await request(app)
        .patch('/api/decks/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ cards: 'invalid' })
      
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('La liste des cartes est invalide')
    })

    it('devrait échouer si cartes incorrectes (check db existence)', async () => {
      prismaMock.deck.findUnique.mockResolvedValue({
        id: 1, 
        userId: userId,
        name: 'Deck',
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)
      
      prismaMock.card.findMany.mockResolvedValue([])

      const res = await request(app)
        .patch('/api/decks/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })
      
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Une ou plusieurs cartes sont invalides')
    })

    it('devrait mettre à jour uniquement le nom', async () => {
      prismaMock.deck.findUnique.mockResolvedValue({ 
        id: 1, 
        userId: userId,
        name: 'Old',
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)
      
      prismaMock.deck.update.mockResolvedValue({ 
        id: 1, 
        name: 'Just Name', 
        userId: userId,
        cards: [],
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)

      const res = await request(app)
        .patch('/api/decks/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Just Name' })
      
      expect(res.status).toBe(200)
    })

    it('devrait mettre à jour uniquement les cartes', async () => {
      prismaMock.deck.findUnique.mockResolvedValue({ 
        id: 1, 
        userId: userId,
        name: 'Deck',
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)
      
      prismaMock.card.findMany.mockResolvedValue(
        validUpdate.cards.map((pokedexNumber, index) => ({ 
          id: index + 1,
          pokedexNumber
        } as any))
      )
      
      prismaMock.deckCard.deleteMany.mockResolvedValue({ count: 10 } as any)
      prismaMock.deckCard.createMany.mockResolvedValue({ count: 10 } as any)
      prismaMock.deck.update.mockResolvedValue({ 
        id: 1, 
        userId: userId,
        name: 'Deck',
        cards: [],
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)

      const res = await request(app)
        .patch('/api/decks/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ cards: validUpdate.cards })
      
      expect(res.status).toBe(200)
    })
    
    it('devrait retourner 400 si l\'ID invalide', async () => {
      const res = await request(app)
        .patch('/api/decks/abc')
        .set('Authorization', `Bearer ${token}`)
      
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('ID de deck invalide')
    })

    it('devrait retourner 404 si le deck n\'existe pas', async () => {
      prismaMock.deck.findUnique.mockResolvedValue(null)
      
      const res = await request(app)
        .patch('/api/decks/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test' })
      
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Deck non trouvé')
    })

    it('devrait retourner 500 en cas d\'erreur', async () => {
      prismaMock.deck.findUnique.mockRejectedValue(new Error('DB'))
      
      const res = await request(app)
        .patch('/api/decks/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test' })
      
      expect(res.status).toBe(500)
    })
  })

  describe('DELETE /api/decks/:id', () => {
    it('devrait supprimer un deck', async () => {
      prismaMock.deck.findUnique.mockResolvedValue({
        id: 1, 
        userId: userId,
        name: 'Deck',
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)
      
      prismaMock.deckCard.deleteMany.mockResolvedValue({ count: 10 } as any)
      prismaMock.deck.delete.mockResolvedValue({ id: 1 } as any)

      const res = await request(app)
        .delete('/api/decks/1')
        .set('Authorization', `Bearer ${token}`)
      
      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Deck supprimé avec succès')
    })

    it('devrait retourner 403 si non owner', async () => {
      prismaMock.deck.findUnique.mockResolvedValue({
        id: 1, 
        userId: 999,
        name: 'Deck',
        createdAt: new Date(),
        updatedAt: new Date()
      } as any)

      const res = await request(app)
        .delete('/api/decks/1')
        .set('Authorization', `Bearer ${token}`)
      
      expect(res.status).toBe(403)
      expect(res.body.error).toBe('Accès interdit : ce deck ne vous appartient pas')
    })

    it('devrait retourner 404 si non trouvé', async () => {
      prismaMock.deck.findUnique.mockResolvedValue(null)

      const res = await request(app)
        .delete('/api/decks/1')
        .set('Authorization', `Bearer ${token}`)
      
      expect(res.status).toBe(404)
      expect(res.body.error).toBe('Deck non trouvé')
    })

    it('devrait retourner 400 si l\'ID invalide', async () => {
      const res = await request(app)
        .delete('/api/decks/abc')
        .set('Authorization', `Bearer ${token}`)
      
      expect(res.status).toBe(400)
      expect(res.body.error).toBe('ID de deck invalide')
    })

    it('devrait retourner 500 en cas d\'erreur', async () => {
      prismaMock.deck.findUnique.mockRejectedValue(new Error('DB'))
      
      const res = await request(app)
        .delete('/api/decks/1')
        .set('Authorization', `Bearer ${token}`)
      
      expect(res.status).toBe(500)
    })
  })

  // 🎯 NOUVEAU : Tests pour GET /api/decks (récupérer toutes les cartes)
  describe('GET /api/decks', () => {
    it('devrait récupérer toutes les cartes disponibles', async () => {
      const mockCards = [
        { id: 1, pokedexNumber: 1, name: 'Bulbizarre', type: 'Plante' },
        { id: 2, pokedexNumber: 2, name: 'Herbizarre', type: 'Plante' },
        { id: 3, pokedexNumber: 3, name: 'Florizarre', type: 'Plante' }
      ]

      prismaMock.card.findMany.mockResolvedValue(mockCards as any)

      const res = await request(app)
        .get('/api/decks')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body).toHaveLength(3)
      expect(res.body[0].pokedexNumber).toBe(1)
      expect(prismaMock.card.findMany).toHaveBeenCalledWith({
        orderBy: { pokedexNumber: 'asc' }
      })
    })

    it('devrait retourner un tableau vide si aucune carte', async () => {
      prismaMock.card.findMany.mockResolvedValue([])

      const res = await request(app)
        .get('/api/decks')

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body).toHaveLength(0)
    })

    it('devrait retourner 500 en cas d\'erreur DB', async () => {
      prismaMock.card.findMany.mockRejectedValue(new Error('DB Error'))

      const res = await request(app)
        .get('/api/decks')

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Erreur serveur')
    })
  })

  describe('Defensive Checks (req.user missing)', () => {
    it('POST /api/decks devrait rejeter si req.user manquant', async () => {
      vi.mocked(authenticateToken).mockImplementation((req: any, res: any, next: any) => {
        req.user = undefined
        next()
      })
      
      const res = await request(app)
        .post('/api/decks')
        .send(validDeck)
      
      expect(res.status).toBe(400)
      expect(res.body.error).toBe("l'id de l'utilisateur est invaide")
    })

    it('GET /api/decks/mine devrait rejeter si req.user manquant', async () => {
      vi.mocked(authenticateToken).mockImplementation((req: any, res: any, next: any) => {
        req.user = undefined
        next()
      })
      
      const res = await request(app).get('/api/decks/mine')
      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Utilisateur non authentifié')
    })

    it('GET /api/decks/:id devrait rejeter si req.user manquant', async () => {
      vi.mocked(authenticateToken).mockImplementation((req: any, res: any, next: any) => {
        req.user = undefined
        next()
      })
      
      const res = await request(app).get('/api/decks/1')
      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Utilisateur non authentifié')
    })

    it('PATCH /api/decks/:id devrait rejeter si req.user manquant', async () => {
      vi.mocked(authenticateToken).mockImplementation((req: any, res: any, next: any) => {
        req.user = undefined
        next()
      })
      
      const res = await request(app).patch('/api/decks/1').send(validDeck)
      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Utilisateur non authentifié')
    })

    it('DELETE /api/decks/:id devrait rejeter si req.user manquant', async () => {
      vi.mocked(authenticateToken).mockImplementation((req: any, res: any, next: any) => {
        req.user = undefined
        next()
      })
      
      const res = await request(app).delete('/api/decks/1')
      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Utilisateur non authentifié')
    })
  })
})