const prisma = require('../db/prismaClient');

const createRestaurant = async (req, res) => {
    try {
        const { name, description, url, isActive, orderEndTime } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Restaurant naam is verplicht' });
        }

        const newRestaurant = await prisma.restaurant.create({
            data: {
                name,
                description,
                url,
                isActive: isActive !== undefined ? isActive : false,
                orderEndTime: orderEndTime ? new Date(orderEndTime) : null,
            },
        });

        res.status(201).json({ message: 'Restaurant succesvol aangemaakt', restaurant: newRestaurant });
    } catch (error) {
        console.error('Error creating restaurant:', error);
                if (error.code === 'P2002' || error.message.includes('validation failed')) {
             return res.status(400).json({ message: 'Validatiefout bij het aanmaken van het restaurant', details: error.meta || error.message });
        }
        res.status(500).json({ error: 'Er is een fout opgetreden bij het aanmaken van het restaurant' });
    }
};

const getAllRestaurants = async (req, res) => {
    try {
        const restaurants = await prisma.restaurant.findMany();
        res.status(200).json(restaurants);
    } catch (error) {
        console.error('Error fetching restaurants:', error);
        res.status(500).json({ error: 'Er is een fout opgetreden bij het ophalen van de restaurants' });
    }
};

const updateRestaurant = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, url, isActive, orderEndTime } = req.body;

        if (Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: 'Geen gegevens opgegeven om bij te werken' });
        }

        const updatedRestaurant = await prisma.restaurant.update({
            where: { id: String(id) },
            data: {
                name,
                description,
                url,
                isActive,
                orderEndTime: orderEndTime ? new Date(orderEndTime) : (orderEndTime === null ? null : undefined),
            },
        });

        res.status(200).json({ message: 'Restaurant succesvol bijgewerkt', restaurant: updatedRestaurant });
    } catch (error) {
        console.error('Fout bij bijwerken restaurant:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: 'Restaurant niet gevonden' });
        }
        res.status(500).json({ message: 'Er ging iets mis bij het bijwerken van het restaurant', error: error.message });
    }
};

const deleteRestaurant = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedRestaurant = await prisma.restaurant.delete({
            where: { id: String(id) },
        });

        res.status(200).json({ message: 'Restaurant succesvol verwijderd', restaurant: deletedRestaurant });
    } catch (error) {
        console.error('Error deleting restaurant:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: 'Restaurant niet gevonden' });
        }
        res.status(500).json({ error: 'Er is een fout opgetreden bij het verwijderen van het restaurant', error: error.message });
    }
};

module.exports = {
    createRestaurant,
    getAllRestaurants,
    updateRestaurant,
    deleteRestaurant,
};