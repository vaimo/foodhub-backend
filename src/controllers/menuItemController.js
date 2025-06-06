const prisma = require("../db/prismaClient");

const createMenuItemForRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name, description, price, isActive } = req.body;

    if (!name || price === undefined) {
      return res
        .status(400)
        .json({ message: "Name and price are required for a menu item" });
    }

    const priceAsFloat = parseFloat(price);
    if (isNaN(priceAsFloat) || priceAsFloat < 0) {
      return res
        .status(400)
        .json({ message: "Price must be a positive number" });
    }

    const priceInCents = Math.round(priceAsFloat * 100);

    const restaurantExists = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });

    if (!restaurantExists) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const newMenuItem = await prisma.menuItem.create({
      data: {
        name,
        description,
        price: priceInCents,
        isActive: isActive !== undefined ? isActive : true,
        restaurant: {
          connect: { id: restaurantId },
        },
      },
    });

    res.status(201).json({
      message: "Menu-item created succesfully",
      menuItem: newMenuItem,
    });
  } catch (error) {
    console.error("Error creating menu item:", error);
    if (error.code === "P2002" || error.message.includes("validation failed")) {
      return res.status(400).json({
        message: "Validation error while creating the menu-item",
        details: error.meta || error.message,
      });
    }
    res.status(500).json({
      message: "An error occurred while creating the menu-item",
    });
  }
};

const getAllMenuItemsForRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const restaurantExists = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });

    if (!restaurantExists) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const menuItems = await prisma.menuItem.findMany({
      where: { restaurantId: restaurantId },
    });

    res.status(200).json(menuItems);
  } catch (error) {
    console.error("Error fetching menu items:", error);
    res.status(500).json({
      message: "An error occurred while fetching menu-items",
    });
  }
};

const updateMenuItem = async (req, res) => {
  try {
    const { restaurantId, menuItemId } = req.params;
    const { name, description, price, isActive } = req.body;

    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: "No data provided to update" });
    }

    if (price !== undefined && (typeof price !== "number" || price < 0)) {
      return res
        .status(400)
        .json({ message: "Price must be a positive number" });
    }

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (description !== undefined) dataToUpdate.description = description;
    if (isActive !== undefined) dataToUpdate.isActive = isActive;

    if (price !== undefined) {
      const priceAsFloat = parseFloat(price);
      if (isNaN(priceAsFloat) || priceAsFloat < 0) {
        return res.status(400).json({ message: "Invalid price value" });
      }
      dataToUpdate.price = Math.round(priceAsFloat * 100);
    }

    const updatedMenuItem = await prisma.menuItem.update({
      where: { id: menuItemId, restaurantId: restaurantId },
      data: dataToUpdate,
    });
    res.status(200).json({
      message: "Menu-item updated successfully",
      menuItem: updatedMenuItem,
    });
  } catch (error) {
    console.error("Error updating menu-item:", error);
    if (error.code === "P2025") {
      return res.status(404).json({
        message:
          "Menu item not found or does not belong to the specified restaurant",
      });
    }
    res.status(500).json({
      message: "Something went wrong while updating the menu item",
    });
  }
};

const deleteMenuItem = async (req, res) => {
  try {
    const { restaurantId, menuItemId } = req.params;

    const deletedMenuItem = await prisma.menuItem.delete({
      where: { id: menuItemId, restaurantId: restaurantId },
    });

    res.status(200).json({
      message: "Menu-item deleted successfully",
      menuItem: deletedMenuItem,
    });
  } catch (error) {
    console.error("Error deleting menu item:", error);
    if (error.code === "P2025") {
      return res.status(404).json({
        message:
          "Menu item not found or does not belong to the specified restaurant",
      });
    }
    res.status(500).json({
      message: "Something went wrong while deleting the menu item",
    });
  }
};

module.exports = {
  createMenuItemForRestaurant,
  getAllMenuItemsForRestaurant,
  updateMenuItem,
  deleteMenuItem,
};
