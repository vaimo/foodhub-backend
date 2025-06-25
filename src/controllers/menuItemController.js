// controllers/menuItemController.js
const prisma = require("../db/prismaClient"); // Using your existing Prisma client import

const createMenuItemForRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    // Destructure optionGroupIds from the request body
    const { name, description, price, isActive, optionGroupIds } = req.body; // NEW: optionGroupIds

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

    // Use a Prisma transaction to ensure atomicity
    const newMenuItem = await prisma.$transaction(async (tx) => {
      const menuItem = await tx.menuItem.create({
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

      // NEW: Connect to OptionGroups if optionGroupIds are provided
      if (optionGroupIds && Array.isArray(optionGroupIds) && optionGroupIds.length > 0) {
        // Prepare data for MenuItemOptionGroup creation
        const associations = optionGroupIds.map(optionGroupId => ({
          menuItemId: menuItem.id,
          optionGroupId: optionGroupId,
        }));
        await tx.menuItemOptionGroup.createMany({
          data: associations,
        });
      }
      return menuItem;
    });

    // To return the created item with its new optionGroups, you might need to fetch it again
    // or manually attach the relationships if you don't want an extra DB call.
    // For simplicity, let's fetch it for a full response.
    const createdMenuItemWithAssociations = await prisma.menuItem.findUnique({
      where: { id: newMenuItem.id },
      include: {
        optionGroups: {
          include: {
            optionGroup: {
              include: {
                options: true
              }
            }
          }
        }
      }
    });

    // Transform the data just like in getAllMenuItemsForRestaurant
    const transformedMenuItem = {
      ...createdMenuItemWithAssociations,
      optionGroups: createdMenuItemWithAssociations.optionGroups ? createdMenuItemWithAssociations.optionGroups.map(ogAssoc => ogAssoc.optionGroup) : []
    };

    res.status(201).json({
      message: "Menu-item created successfully",
      menuItem: transformedMenuItem, // Return the transformed item
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
      message: `An error occurred while creating the menu-item: ${error.message}`, // Include error message
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
      where: { restaurantId: restaurantId, isActive: true },
      include: {
        optionGroups: { // This refers to the MenuItemOptionGroup join table
          include: {
            optionGroup: { // This refers to the actual OptionGroup model
              include: {
                options: true // Include the individual Options within each OptionGroup
              }
            }
          }
        }
      }
    });

    const transformedMenuItems = menuItems.map(item => ({
      ...item,
      // Flatten the optionGroups array, so it's directly an array of OptionGroup objects
      optionGroups: item.optionGroups ? item.optionGroups.map(ogAssoc => ogAssoc.optionGroup) : []
    }));

    res.status(200).json(transformedMenuItems); // Make sure you send the transformed data here
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
    // Destructure optionGroupIds from the request body
    const { name, description, price, isActive, optionGroupIds } = req.body; // NEW: optionGroupIds

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

    // Use a Prisma transaction for updating menu item and its option groups
    const updatedMenuItem = await prisma.$transaction(async (tx) => {
      // 1. Update the MenuItem's core data
      const menuItem = await tx.menuItem.update({
        where: { id: menuItemId, restaurantId: restaurantId },
        data: dataToUpdate,
      });

      // 2. Manage MenuItemOptionGroup associations
      // First, delete all existing associations for this MenuItem
      await tx.menuItemOptionGroup.deleteMany({
        where: { menuItemId: menuItemId },
      });

      // Then, create new associations based on the provided optionGroupIds
      if (optionGroupIds && Array.isArray(optionGroupIds) && optionGroupIds.length > 0) {
        const newAssociations = optionGroupIds.map(optionGroupId => ({
          menuItemId: menuItemId,
          optionGroupId: optionGroupId,
        }));
        await tx.menuItemOptionGroup.createMany({
          data: newAssociations,
        });
      }
      return menuItem;
    });

    // To return the updated item with its current associations, fetch it again
    const updatedMenuItemWithAssociations = await prisma.menuItem.findUnique({
      where: { id: updatedMenuItem.id },
      include: {
        optionGroups: {
          include: {
            optionGroup: {
              include: {
                options: true
              }
            }
          }
        }
      }
    });

    // Transform the data just like in getAllMenuItemsForRestaurant
    const transformedMenuItem = {
      ...updatedMenuItemWithAssociations,
      optionGroups: updatedMenuItemWithAssociations.optionGroups ? updatedMenuItemWithAssociations.optionGroups.map(ogAssoc => ogAssoc.optionGroup) : []
    };

    res.status(200).json({
      message: "Menu-item updated successfully",
      menuItem: transformedMenuItem, // Return the transformed item
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
      message: `Something went wrong while updating the menu item: ${error.message}`, // Include error message
    });
  }
};

const deleteMenuItem = async (req, res) => {
  try {
    const { restaurantId, menuItemId } = req.params;

    // Use a transaction for deleting menuItem and its associations
    await prisma.$transaction(async (tx) => {
      // First, delete all associated MenuItemOptionGroup entries
      await tx.menuItemOptionGroup.deleteMany({
        where: { menuItemId: menuItemId }
      });

      const orderCount = await tx.orderItem.count({ // Use tx for consistency
        where: { menuItemId: menuItemId },
      });

      if (orderCount > 0) {
        // If part of orders, archive it
        await tx.menuItem.update({
          where: { id: menuItemId, restaurantId: restaurantId },
          data: { isActive: false },
        });
      } else {
        // If not part of orders, truly delete it
        await tx.menuItem.delete({
          where: { id: menuItemId, restaurantId: restaurantId },
        });
      }
    });


    res.status(200).json({
      message: "Menu-item deletion/archive process completed successfully.",
      // For DELETE, typically you return 204 No Content, but your existing code returns JSON
      // If archived, you might want to return the archived item.
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
      message: `Something went wrong while deleting the menu item: ${error.message}`,
    });
  }
};

// ... (your existing addOptionGroupToMenuItem, getMenuItemOptionGroups, removeOptionGroupFromMenuItem) ...
// These operations are for direct management of associations, not for create/update flow of MenuItem

const addOptionGroupToMenuItem = async (req, res) => {
  const { menuItemId } = req.params;
  const { optionGroupId } = req.body;

  try {
    const menuItemExists = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
    const optionGroupExists = await prisma.optionGroup.findUnique({ where: { id: optionGroupId } });

    if (!menuItemExists) {
      return res.status(404).json({ error: 'Menu Item not found' });
    }
    if (!optionGroupExists) {
      return res.status(404).json({ error: 'Option Group not found' });
    }

    const existingAssociation = await prisma.menuItemOptionGroup.findUnique({
      where: {
        menuItemId_optionGroupId: {
          menuItemId: menuItemId,
          optionGroupId: optionGroupId,
        },
      },
    });

    if (existingAssociation) {
      return res.status(409).json({ error: 'Menu Item is already associated with this Option Group' });
    }

    const newAssociation = await prisma.menuItemOptionGroup.create({
      data: {
        menuItem: { connect: { id: menuItemId } },
        optionGroup: { connect: { id: optionGroupId } },
      },
    });
    res.status(201).json(newAssociation);
  } catch (error) {
    console.error('Error adding OptionGroup to MenuItem:', error);
    res.status(500).json({ error: 'Failed to add OptionGroup to MenuItem' });
  }
};

const getMenuItemOptionGroups = async (req, res) => {
  const { menuItemId } = req.params;

  try {
    const menuItemWithOptionGroups = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
      include: {
        optionGroups: {
          include: {
            optionGroup: {
              include: {
                options: true
              }
            }
          }
        },
      },
    });

    if (!menuItemWithOptionGroups) {
      return res.status(404).json({ error: 'Menu Item not found' });
    }

    const optionGroups = menuItemWithOptionGroups.optionGroups.map(association => association.optionGroup);

    res.status(200).json(optionGroups);
  } catch (error) {
    console.error('Error fetching OptionGroups for MenuItem:', error);
    res.status(500).json({ error: 'Failed to retrieve OptionGroups for MenuItem' });
  }
};

const removeOptionGroupFromMenuItem = async (req, res) => {
  const { menuItemId, optionGroupId } = req.params;

  try {
    await prisma.menuItemOptionGroup.delete({
      where: {
        menuItemId_optionGroupId: {
          menuItemId: menuItemId,
          optionGroupId: optionGroupId,
        },
      },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error removing OptionGroup from MenuItem:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Association not found' });
    }
    res.status(500).json({ error: 'Failed to remove OptionGroup from MenuItem' });
  }
};


module.exports = {
  createMenuItemForRestaurant,
  getAllMenuItemsForRestaurant,
  updateMenuItem,
  deleteMenuItem,
  addOptionGroupToMenuItem,
  getMenuItemOptionGroups,
  removeOptionGroupFromMenuItem,
};