const prisma = require('../db/prismaClient');

const createUser = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Naam is verplicht' });
        }
        const newUser = await prisma.user.create({
            data: {
                name,
            },
        });
        res.status(201).json({ message: 'User succesvol aangemaakt', user: newUser });
    } catch (error) {
        console.error('Error creating user:', error);
        if (error.code === 'P2002' || error.message.includes('validation failed')) {
            return res.status(400).json({ message: 'Validatiefout bij het aanmaken van de gebruiker', details: error.meta || error.message });
        }
        res.status(500).json({ error: 'Er is een fout opgetreden bij het aanmaken van de gebruiker' });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany();
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Er is een fout opgetreden bij het ophalen van de gebruikers' });
    }
};

const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: String(id) },
        });
        if (!user) {
            return res.status(404).json({ error: 'Gebruiker niet gevonden' });
        }
        res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Er is een fout opgetreden bij het ophalen van de gebruiker' });
    }
};

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: 'Geen gegevens opgegeven om bij te werken' });
        }

        const updatedUser = await prisma.user.update({
            where: { id: String(id) },
            data: {
                name,
            },
        });

        res.status(200).json({ message: 'User succesvol bijgewerkt', user: updatedUser });
    } catch (error) {
        console.error('Error updating user:', error);
        if (error.code === 'P2002' || error.message.includes('validation failed')) {
            return res.status(400).json({ message: 'Validatiefout bij het bijwerken van de gebruiker', details: error.meta || error.message });
        }
        res.status(500).json({ error: 'Er is een fout opgetreden bij het bijwerken van de gebruiker' });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedUser = await prisma.user.delete({
            where: { id: String(id) },
        });

        res.status(200).json({ message: 'User succesvol verwijderd', user: deletedUser });
    } catch (error) {
        console.error('Error deleting user:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: 'User niet gevonden' });
        }
        res.status(500).json({ error: 'Er is een fout opgetreden bij het verwijderen van de gebruiker' });
    }
};

module.exports = {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
};