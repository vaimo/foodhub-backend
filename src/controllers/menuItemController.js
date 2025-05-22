const prisma = require('../db/prismaClient');

const createMenuItemForRestaurant = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { name, description, price, isActive } = req.body;

        if (!name || price === undefined) {
            return res.status(400).json({ message: 'Naam en prijs zijn verplicht voor een menu-item' });
        }
        if (typeof price !== 'number' || price < 0) {
            return res.status(400).json({ message: 'Prijs moet een positief getal zijn' });
        }

        const restaurantExists = await prisma.restaurant.findUnique({
            where: { id: String(restaurantId) },
        });

        if (!restaurantExists) {
            return res.status(404).json({ message: 'Restaurant niet gevonden' });
        }

        const newMenuItem = await prisma.menuItem.create({
            data: {
                name,
                description,
                price,
                isActive: isActive !== undefined ? isActive : true,
                restaurant: {
                    connect: { id: String(restaurantId) },
                },
            },
        });

        res.status(201).json({ message: 'Menu-item succesvol aangemaakt', menuItem: newMenuItem });
    } catch (error) {
        console.error('Error creating menu item:', error);
        if (error.code === 'P2002' || error.message.includes('validation failed')) {
            return res.status(400).json({ message: 'Validatiefout bij het aanmaken van het menu-item', details: error.meta || error.message });
        }
        res.status(500).json({ error: 'Er is een fout opgetreden bij het aanmaken van het menu-item' });
    }
};

const getAllMenuItemsForRestaurant = async (req, res) => {
    try {
        const { restaurantId } = req.params;

        const restaurantExists = await prisma.restaurant.findUnique({
            where: { id: String(restaurantId) },
        });

        if (!restaurantExists) {
            return res.status(404).json({ message: 'Restaurant niet gevonden' });
        }

        const menuItems = await prisma.menuItem.findMany({
            where: { restaurantId: String(restaurantId) },
        });

        res.status(200).json(menuItems);
    } catch (error) {
        console.error('Error fetching menu items:', error);
        res.status(500).json({ error: 'Er is een fout opgetreden bij het ophalen van de menu-items' });
    }
};

const updateMenuItem = async (req, res) => {
    try {
        const { restaurantId, menuItemId } = req.params;
        const { name, description, price, isActive } = req.body;

        if (Object.keys(req.body).length === 0) {
            return res.status(400).json({ message: 'Geen gegevens opgegeven om bij te werken' });
        }

        if (price !== undefined && (typeof price !== 'number' || price < 0)) {
            return res.status(400).json({ message: 'Prijs moet een positief getal zijn' });
        }

        const updatedMenuItem = await prisma.menuItem.update({
            where: { id: String(menuItemId), restaurantId: String(restaurantId) },
            data: {
                name,
                description,
                price,
                isActive,
            },
        });
        res.status(200).json({ message: 'Menu-item succesvol bijgewerkt', menuItem: updatedMenuItem });
    } catch (error) {
        console.error('Fout bij bijwerken menu-item:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: 'Menu-item niet gevonden of behoort niet tot het opgegeven restaurant' });
        }
        res.status(500).json({ message: 'Er ging iets mis bij het bijwerken van het menu-item', error: error.message });
    }
};

const deleteMenuItem = async (req, res) => {
    try {
        const { restaurantId, menuItemId } = req.params;

        const deletedMenuItem = await prisma.menuItem.delete({
            where: { id: String(menuItemId), restaurantId: String(restaurantId) },
        });

        res.status(200).json({ message: 'Menu-item succesvol verwijderd', menuItem: deletedMenuItem });
    } catch (error) {
        console.error('Error deleting menu item:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: 'Menu-item niet gevonden of behoort niet tot het opgegeven restaurant' });
        }
        res.status(500).json({ message: 'Er ging iets mis bij het verwijderen van het menu-item', error: error.message });
    }
};

module.exports = {
    createMenuItemForRestaurant, getAllMenuItemsForRestaurant, updateMenuItem, deleteMenuItem,
};