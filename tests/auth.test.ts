import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../src/index'
import { prismaMock } from './vitest.setup'
import bcrypt from 'bcrypt'

// Mock de bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn()
  }
}))

describe('Auth Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/auth/sign-up', () => {
    const validUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    }

    it('devrait créer un utilisateur avec succès', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)
      vi.mocked(bcrypt.hash).mockResolvedValue('hashedPassword' as never)
      prismaMock.user.create.mockResolvedValue({
        id: 1,
        username: validUser.username,
        email: validUser.email,
        password: 'hashedPassword',
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const res = await request(app)
        .post('/api/auth/sign-up')
        .send(validUser)

      expect(res.status).toBe(201)
      expect(res.body.message).toBe('Utilisateur créé avec succès')
      expect(res.body).toHaveProperty('token')
      expect(res.body.user.email).toBe(validUser.email)
    })

    it('devrait échouer si des informations sont manquantes', async () => {
      const res = await request(app)
        .post('/api/auth/sign-up')
        .send({ username: 'test' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Donnée manquante')
    })

    it('devrait échouer si l\'email est déjà utilisé', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        email: validUser.email,
        password: 'hash',
        username: 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const res = await request(app)
        .post('/api/auth/sign-up')
        .send(validUser)

      expect(res.status).toBe(409)
      expect(res.body.error).toBe('Un utilisateur avec cet email existe déjà')
    })

    it('devrait gérer les erreurs serveur', async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error('DB Error'))

      const res = await request(app)
        .post('/api/auth/sign-up')
        .send(validUser)

      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Erreur serveur')
    })
  })

  describe('POST /api/auth/sign-in', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'password123'
    }

    it('devrait connecter un utilisateur avec succès', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: loginData.email,
        password: 'hashedPassword',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      const res = await request(app)
        .post('/api/auth/sign-in')
        .send(loginData)

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('Connexion réussie')
      expect(res.body).toHaveProperty('token')
      expect(res.body.user.email).toBe(loginData.email)
    })

    it('devrait échouer si informations manquantes', async () => {
      const res = await request(app)
        .post('/api/auth/sign-in')
        .send({ email: 'test@example.com' })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Donnée manquante')
    })

    it('devrait échouer si l\'utilisateur n\'existe pas', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      const res = await request(app)
        .post('/api/auth/sign-in')
        .send(loginData)

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Email ou mot de passe incorrect')
    })

    it('devrait échouer si le mot de passe est invalide', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'testuser',
        email: loginData.email,
        password: 'hashedPassword',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      const res = await request(app)
        .post('/api/auth/sign-in')
        .send(loginData)

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Email ou mot de passe incorrect')
    })

    it('devrait gérer les erreurs serveur', async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error('DB Error'))
      
      const res = await request(app)
        .post('/api/auth/sign-in')
        .send(loginData)
      
      expect(res.status).toBe(500)
      expect(res.body.error).toBe('Erreur serveur')
    })
  })
})