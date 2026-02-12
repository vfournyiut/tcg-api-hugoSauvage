import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import { authenticateToken } from '../src/auth/auth.middleware'
import jwt from 'jsonwebtoken'

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      userId: number
      email: string
    }
  }
}

// Mock de jwt
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    sign: vi.fn(),
    TokenExpiredError: class TokenExpiredError extends Error {
      name = 'TokenExpiredError'
      expiredAt: Date
      constructor(message: string, expiredAt: Date) {
        super(message)
        this.expiredAt = expiredAt
      }
    },
    JsonWebTokenError: class JsonWebTokenError extends Error {
      name = 'JsonWebTokenError'
      constructor(message: string) {
        super(message)
      }
    }
  }
}))

describe('Auth Middleware - authenticateToken', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockNext: NextFunction

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockRequest = {
      headers: {}
    }
    
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    }
    
    mockNext = vi.fn()
  })

  it('devrait rejeter si le token manque (pas d\'Authorization header)', () => {
    mockRequest.headers = {}

    authenticateToken(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    )

    expect(mockResponse.status).toHaveBeenCalledWith(401)
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Token manquant' })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it('devrait rejeter si le token manque (Authorization sans Bearer)', () => {
    mockRequest.headers = {
      authorization: 'InvalidFormat'
    }

    authenticateToken(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    )

    expect(mockResponse.status).toHaveBeenCalledWith(401)
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Token manquant' })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it('devrait accepter un token valide et appeler next()', () => {
    const mockDecoded = {
      userId: 1,
      email: 'test@example.com'
    }

    mockRequest.headers = {
      authorization: 'Bearer valid-token-123'
    }

    vi.mocked(jwt.verify).mockReturnValue(mockDecoded as any)

    authenticateToken(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    )

    expect(jwt.verify).toHaveBeenCalledWith('valid-token-123', process.env.JWT_SECRET)
    expect(mockRequest.user).toEqual({
      userId: 1,
      email: 'test@example.com'
    })
    expect(mockNext).toHaveBeenCalled()
    expect(mockResponse.status).not.toHaveBeenCalled()
  })

  it('devrait rejeter un token expiré (TokenExpiredError)', () => {
    mockRequest.headers = {
      authorization: 'Bearer expired-token'
    }

    // 🎯 Ajout du deuxième argument: expiredAt (Date)
    const expiredError = new jwt.TokenExpiredError('Token expired', new Date())
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw expiredError
    })

    authenticateToken(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    )

    expect(mockResponse.status).toHaveBeenCalledWith(401)
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Token expiré' })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it('devrait rejeter un token invalide (JsonWebTokenError)', () => {
    mockRequest.headers = {
      authorization: 'Bearer invalid-token'
    }

    const jwtError = new jwt.JsonWebTokenError('Invalid token')
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw jwtError
    })

    authenticateToken(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    )

    expect(mockResponse.status).toHaveBeenCalledWith(401)
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Token invalide' })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it('devrait gérer les autres erreurs d\'authentification', () => {
    mockRequest.headers = {
      authorization: 'Bearer some-token'
    }

    const genericError = new Error('Some other error')
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw genericError
    })

    authenticateToken(
      mockRequest as Request,
      mockResponse as Response,
      mockNext
    )

    expect(mockResponse.status).toHaveBeenCalledWith(401)
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authentification échouée' })
    expect(mockNext).not.toHaveBeenCalled()
  })
})