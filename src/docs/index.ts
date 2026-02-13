import YAML from 'yamljs'
import path from 'path'
import {fileURLToPath} from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Charger la configuration principale
const swaggerConfig = YAML.load(path.join(__dirname, 'swagger.config.yml'))

// Charger les documentations des modules
const authDoc = YAML.load(path.join(__dirname, 'auth.doc.yml'))
const userDoc = YAML.load(path.join(__dirname, 'user.doc.yml'))

// Fusionner tous les paths
export const swaggerDocument = {
    ...swaggerConfig,
    paths: {
        ...authDoc.paths,
        ...userDoc.paths
    }
}
