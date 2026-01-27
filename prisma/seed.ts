import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/database";
import { PokemonType } from "../src/generated/prisma/enums";

type PokemonJson = {
    name: string;
    hp: number;
    attack: number;
    type: keyof typeof PokemonType;
    pokedexNumber: number;
};

async function createStarterDeck(userId: number, username: string) {
    const cards = await prisma.card.findMany();

    if (cards.length < 10) {
        throw new Error("Not enough cards to create a starter deck");
    }

  // Mélange aléatoire
    const shuffled = [...cards].sort(() => 0.5 - Math.random());
    const selectedCards = shuffled.slice(0, 10);

  // Création du deck
    const deck = await prisma.deck.create({
        data: {
        name: "Starter Deck",
        userId,
        },
    });

    // Ajout des 10 cartes
    await prisma.deckCard.createMany({
        data: selectedCards.map((card) => ({
        deckId: deck.id,
        cardId: card.id,
        count: 1,
        })),
    });

    console.log(`🃏 Deck "Starter Deck" créé pour ${username}`);
    }

async function main() {
    console.log("🌱 Starting database seed...");

    // --- CLEAN DATABASE ---
    await prisma.deckCard.deleteMany();
    await prisma.deck.deleteMany();
    await prisma.card.deleteMany();
    await prisma.user.deleteMany();

    // --- USERS ---
    const hashedPassword = await bcrypt.hash("password123", 10);

    await prisma.user.createMany({
        data: [
        {
            username: "red",
            email: "red@example.com",
            password: hashedPassword,
        },
        {
            username: "blue",
            email: "blue@example.com",
            password: hashedPassword,
        },
        ],
    });

    const redUser = await prisma.user.findUnique({
        where: { username: "red" },
    });
    const blueUser = await prisma.user.findUnique({
        where: { username: "blue" },
    });

    if (!redUser || !blueUser) {
        throw new Error("Users not created correctly");
    }

    console.log(`✅ Users created: ${redUser.username}, ${blueUser.username}`);

    // --- CARDS ---
    const pokemonDataPath = join(__dirname, "data", "pokemon.json");
    const pokemonRaw = readFileSync(pokemonDataPath, "utf-8");
    const pokemonData: PokemonJson[] = JSON.parse(pokemonRaw);

    await prisma.card.createMany({
        data: pokemonData.map((pokemon) => ({
        name: pokemon.name,
        hp: pokemon.hp,
        attack: pokemon.attack,
        type: PokemonType[pokemon.type],
        pokedexNumber: pokemon.pokedexNumber,
        imgUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.pokedexNumber}.png`,
        })),
    });

    console.log(`✅ Created ${pokemonData.length} Pokémon cards`);

    // --- STARTER DECKS ---
    await createStarterDeck(redUser.id, redUser.username);
    await createStarterDeck(blueUser.id, blueUser.username);

    console.log("🎉 Database seeding completed!");
}

main()
    .catch((error) => {
        console.error("❌ Seed error:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
