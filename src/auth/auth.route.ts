import { Request, Response, Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { prisma } from '../../src/database'

export const authRouter = Router()

// POST /auth/sign-up - INSCRIPTION
authRouter.post('/sign-up', async (req: Request, res: Response) => {
  const { email, username, password } = req.body

  try {
    // 1. Vérifier que toutes les données sont présentes
    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Donnée manquante' })
    }

    // 2. Vérifier que l'utilisateur n'existe pas déjà
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return res
        .status(409)
        .json({ error: 'Un utilisateur avec cet email existe déjà' })
    }

    // 3. Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10)

    // 4. Création de l'utilisateur
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email,
      },
    })

    // 5. Générer le JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' },
    )

    // 6. Retourner le token
    return res.status(201).json({
      message: 'Utilisateur créé avec succès',
      token,
      user: {
        id: user.id,
        name: user.username,
        email: user.email,
      },
    })
  } catch (error) {
    console.error("Erreur lors de l'inscription:", error)
    return res.status(500).json({ error: 'Erreur serveur' })
  }
})

// POST /auth/sign-in - CONNEXION
authRouter.post('/sign-in', async (req: Request, res: Response) => {
  const { email, password } = req.body

  try {
    // 1. Vérifier que toutes les données sont présentes
    if (!email || !password) {
      return res.status(400).json({ error: 'Donnée manquante' })
    }

    // 2. Vérifier que l'utilisateur existe (SANS le password dans le where!)
    const user = await prisma.user.findUnique({
      where: { email }, // ← CORRIGÉ: on cherche seulement par email
    })

    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' })
    }

    // 3. Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' })
    }

    // 4. Générer le JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' },
    )

    // 5. Retourner le token
    return res.status(200).json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        name: user.username,
        email: user.email,
      },
    })
  } catch (error) {
    console.error('Erreur lors de la connexion:', error)
    return res.status(500).json({ error: 'Erreur serveur' })
  }
})
