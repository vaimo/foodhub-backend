const prisma = require("../db/prismaClient");

const createOrder = async (req, res) => {
  const { restaurantId, items, generalComment } = req.body;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  try {
    if (!restaurantId) {
      throw new Error("Restaurant ID is required");
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("Items are required and must be an array");
    }

    const invalidItems = items.filter(
      (item) =>
        !item.menuItemId ||
        !item.userId ||
        !item.quantity ||
        item.quantity <= 0 ||
        item.priceAtOrder === undefined ||
        !item.itemNameAtOrder
    );

    if (invalidItems.length !== 0) {
      throw new Error(
        "Each item must have menuItemId, userId, quantity (greater than 0), priceAtOrder, and itemNameAtOrder"
      );
    }

    if (
      generalComment &&
      typeof generalComment.text === "string" &&
      generalComment.text.trim() !== "" &&
      !generalComment.userId
    ) {
      throw new Error("General comment must have a userId if text is provided");
    }
    if (generalComment && !generalComment.text && generalComment.userId) {
      throw new Error("General comment must have text if userId is provided");
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new Error(`Restaurant with ID ${restaurantId} not found`);
    }
    const newOrder = await prisma.$transaction(async (tx) => {
      let order = await tx.order.findFirst({
        where: {
          restaurantId: restaurantId,
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      });

      if (!order) {
        order = await tx.order.create({
          data: {
            restaurantId: restaurantId,
          },
        });
      }

      const currentUserId = items[0].userId;

      await tx.orderItem.deleteMany({
        where: {
          orderId: order.id,
          userId: currentUserId,
        },
      });

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
      await tx.orderComment.deleteMany({
        where: {
          orderId: order.id,
          userId: currentUserId,
        },
      });
      if (generalComment && generalComment.userId && generalComment.text) {
        await tx.orderComment.create({
          data: {
            orderId: order.id,
            userId: generalComment.userId,
            text: generalComment.text.trim(),
          },
        });
      }

      const allOrderItems = await tx.orderItem.findMany({
        where: { orderId: order.id },
      });

      const totalInCents = allOrderItems.reduce(
        (acc, currentItem) =>
          acc + currentItem.priceAtOrder * currentItem.quantity,
        0
      );

      const finalOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          totalPrice: totalInCents,
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
    res.status(500).json({
      message: `An error occurred while creating the order: ${error.message}`,
    });
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
          orderId: item.orderId,
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

const deleteOrderForUser = async (req, res) => {
  const { orderId, userId } = req.params;

  if (!orderId || !userId) {
    return res
      .status(400)
      .json({ message: "Order ID and User ID are required" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({
        where: {
          orderId: orderId,
          userId: userId,
        },
      });
      await tx.orderComment.deleteMany({
        where: {
          orderId: orderId,
          userId: userId,
        },
      });
      const remainingItemsCount = await tx.orderItem.count({
        where: {
          orderId: orderId,
        },
      });

      if (remainingItemsCount === 0) {
        await tx.order.delete({
          where: {
            id: orderId,
          },
        });
      } else {
        const remainingItems = await tx.orderItem.findMany({
          where: {
            orderId: orderId,
          },
        });

        const newTotalInCents = remainingItems.reduce(
          (acc, item) => acc + item.priceAtOrder * item.quantity,
          0
        );

        await tx.order.update({
          where: {
            id: orderId,
          },
          data: {
            totalPrice: newTotalInCents,
          },
        });
      }
    });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting user order:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Order or user items not found" });
    }
    res
      .status(500)
      .json({ message: "Something went wrong while deleting the order" });
  }
};

module.exports = {
  createOrder,
  deleteOrderForUser,
  getOrderBySummaryForRestaurant,
};
