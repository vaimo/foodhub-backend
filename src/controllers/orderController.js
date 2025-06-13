const prisma = require("../db/prismaClient");

const createOrder = async (req, res) => {
  const { restaurantId, items, generalComment } = req.body;
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

  if (
    generalComment &&
    typeof generalComment.text === "string" &&
    generalComment.text.trim() !== "" &&
    !generalComment.userId
  ) {
    return res.status(400).json({
      message: "General comment must have a userId if text is provided",
    });
  }
  if (generalComment && !generalComment.text && generalComment.userId) {
    return res.status(400).json({
      message: "General comment must have text if userId is provided",
    });
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
      const today = new Date();
      const existingOrder = await tx.order.findFirst({
        where: {
          restaurantId: restaurantId,
          creationDate: today,
        },
      });
      if (existingOrder) {
        return existingOrder;
      } else {
        const order = await tx.order.create({
          data: {
            restaurantId: restaurantId,
            creationDate: today,
          },
        });
      }
      const orderItemsData = items.map((item) => ({
        orderId: order.id,
        userId: item.userId,
        menuItemId: item.menuItemId,
        itemNameAtOrder: item.itemNameAtOrder,
        priceAtOrder: item.priceAtOrder,
        quantity: item.quantity,
      }));
      await tx.orderItem.createMany({
        data: orderItemsData,
      });

      if (
        generalComment &&
        typeof generalComment.text === "string" &&
        generalComment.text.trim() !== "" &&
        generalComment.userId
      ) {
        await tx.orderComment.create({
          data: {
            orderId: order.id,
            userId: generalComment.userId,
            text: generalComment.text.trim(),
          },
        });
      }

      const totalInCents = orderItemsData.reduce(
        (acc, currentItem) =>
          acc + currentItem.priceAtOrder * currentItem.quantity,
        0
      );

      const finalOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          totalPrice: totalInCents,
        },
        include: {
          orderItems: { include: { user: true } },
          restaurant: true,
          comments: { include: { user: true } },
        },
      });

      return finalOrder;
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

const getOrderBySummaryForRestaurant = async (req, res) => {
  const { restaurantId } = req.params;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (!restaurantId) {
    return res.status(400).json({ message: "Restaurant ID is required" });
  }

  try {
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          restaurantId: restaurantId,
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      },

      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        order: {
          include: {
            comments: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });
    if (!orderItems || orderItems.length === 0) {
      return res.status(200).json([]);
    }

    const summary = {};
    const orderComments = {};
    const detailsByUser = {};

    orderItems.forEach((item) => {
      if (item.order.comments && item.order.comments.length > 0) {
        orderComments[item.orderId] = item.order.comments;
      }
      if (!summary[item.menuItemId]) {
        summary[item.menuItemId] = {
          menuItemId: item.menuItemId,
          itemName: item.itemNameAtOrder,
          totalQuantity: 0,
          pricePerItem: item.priceAtOrder,
          instances: [],
        };
      }
      summary[item.menuItemId].instances.push({
        quantity: item.quantity,
      });

      summary[item.menuItemId].totalQuantity += item.quantity;

      const userId = item.userId;
      if (!detailsByUser[userId]) {
        detailsByUser[userId] = {
          userName: item.user.name,
          userTotal: 0,
          items: [],
        };
      }
      detailsByUser[userId].items.push({
        itemName: item.itemNameAtOrder,
        quantity: item.quantity,
        price: item.priceAtOrder,
        totalPrice: item.quantity * item.priceAtOrder,
      });
      detailsByUser[userId].userTotal += item.quantity * item.priceAtOrder;
    });

    const aggregatedSummary = Object.values(summary);
    const allComments = Object.values(orderComments).flat();

    res.status(200).json({
      summary: aggregatedSummary,
      detailsByUser: detailsByUser,
      comments: allComments,
    });
  } catch (error) {
    console.error(`Error fetching order summary for ${restaurantId}:`, error);
    res.status(500).json({
      message: "An error occurred while fetching the order summary",
    });
  }
};

module.exports = {
  createOrder,
  getOrderBySummaryForRestaurant,
};
