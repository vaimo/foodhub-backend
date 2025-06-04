const prisma = require("../db/prismaClient");

const createOrder = async (req, res) => {
  const { restaurantId, items } = req.body;
  if (!restaurantId) {
    return res.status(400).json({ message: "Restaurant ID is required" });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res
      .status(400)
      .json({ message: "Items are required and must be an array" });
  }

  for (const item of items) {
    if (
      !item.menuItemId ||
      !item.userId ||
      !item.quantity ||
      item.quantity <= 0 ||
      item.priceAtOrder === undefined ||
      !item.itemNameAtOrder
    ) {
      return res.status(400).json({
        message:
          "Each item must have menuItemId, userId, quantity (greater than 0), priceAtOrder, and itemNameAtOrder",
        invalidItem: item,
      });
    }
  }

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      return res
        .status(404)
        .json({ message: `Restaurant with ID ${restaurantId} not found` });
    }
    const newOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          restaurantId: restaurantId,
        },
      });
      const orderItemsData = items.map((item) => ({
        orderId: order.id,
        userId: item.userId,
        menuItemId: item.menuItemId,
        itemNameAtOrder: item.itemNameAtOrder,
        priceAtOrder: item.priceAtOrder,
        quantity: item.quantity,
        notes: item.notes,
      }));
      await tx.orderItem.createMany({
        data: orderItemsData,
      });
      return tx.order.findUnique({
        where: { id: order.id },
        include: {
          orderItems: {
            include: {
              user: { select: { id: true, name: true } },
              menuItem: { select: { id: true, name: true, price: true } },
            },
          },
          restaurant: { select: { id: true, name: true } },
        },
      });
    });
    res.status(201).json({
      message: "Order successfully created",
      order: newOrder,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    if (error.code === "P2002") {
      return res.status(400).json({
        message: "Order creation failed due to a unique constraint violation",
        details: error.meta,
      });
    }
    if (error.code === "P2003") {
      return res.status(400).json({
        message:
          "Order creation failed due to a foreign key constraint violation",
        details: error.meta?.field_name,
      });
    }
    res
      .status(500)
      .json({ message: "An error occurred while creating the order" });
  }
};

module.exports = {
  createOrder,
  // Add other order-related functions here, such as getAllOrders, getOrderById, etc.
};
