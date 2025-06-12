const prisma = require("../db/prismaClient");

const upsertOrderForUser = async (req, res) => {
  const { restaurantId, items, generalComment } = req.body;

  if (!restaurantId) {
    return res.status(400).json({ message: "Restaurant ID is required." });
  }
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ message: "Items must be an array." });
  }

  const userId = items[0]?.userId || generalComment?.userId;
  if (!userId) {
    return res
      .status(400)
      .json({ message: "User ID could not be determined from the request." });
  }

  for (const item of items) {
    if (
      !item.menuItemId ||
      !item.userId ||
      item.userId !== userId ||
      !item.quantity ||
      item.quantity <= 0 ||
      item.priceAtOrder === undefined ||
      !item.itemNameAtOrder
    ) {
      return res.status(400).json({
        message: "Invalid data in one of the items.",
        invalidItem: item,
      });
    }
  }
  if (generalComment?.text && generalComment.userId !== userId) {
    return res
      .status(400)
      .json({ message: "Comment must belong to the same user as the items." });
  }

  try {
    const resultOrder = await prisma.$transaction(async (tx) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      let order = await tx.order.findFirst({
        where: {
          restaurantId: restaurantId,
          createdAt: { gte: today, lt: tomorrow },
        },
      });

      if (!order) {
        order = await tx.order.create({
          data: { restaurantId: restaurantId, totalPrice: 0 },
        });
      }

      await tx.orderItem.deleteMany({
        where: { orderId: order.id, userId: userId },
      });
      await tx.orderComment.deleteMany({
        where: { orderId: order.id, userId: userId },
      });

      if (items.length > 0) {
        const newOrderItemsData = items.map((item) => ({
          orderId: order.id,
          userId: userId,
          menuItemId: item.menuItemId,
          itemNameAtOrder: item.itemNameAtOrder,
          priceAtOrder: item.priceAtOrder,
          quantity: item.quantity,
        }));
        await tx.orderItem.createMany({ data: newOrderItemsData });
      }

      if (generalComment?.text?.trim()) {
        await tx.orderComment.create({
          data: {
            orderId: order.id,
            userId: userId,
            text: generalComment.text.trim(),
          },
        });
      }

      const allOrderItemsInOrder = await tx.orderItem.findMany({
        where: { orderId: order.id },
      });

      const totalInCents = allOrderItemsInOrder.reduce(
        (acc, item) => acc + item.priceAtOrder * item.quantity,
        0
      );

      const finalOrder = await tx.order.update({
        where: { id: order.id },
        data: { totalPrice: totalInCents },
        include: {
          orderItems: { include: { user: true } },
          restaurant: true,
          comments: { include: { user: true } },
        },
      });

      return finalOrder;
    });

    res
      .status(200)
      .json({ message: "Order processed successfully", order: resultOrder });
  } catch (error) {
    console.error("Error in upsertOrderForUser:", error);
    res
      .status(500)
      .json({ message: "An error occurred while processing your order." });
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
          select: {
            id: true,
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
          orderId: item.orderId,
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

const getExistingOrderFromToday = async (req, res) => {
  const { restaurantId, userId } = req.params;

  if (!restaurantId || !userId) {
    return res
      .status(400)
      .json({ message: "Restaurant ID en User ID are required" });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const orderItems = await prisma.orderItem.findMany({
      where: {
        userId: userId,
        order: {
          restaurantId: restaurantId,
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      },
      include: {
        order: {
          include: {
            comments: { where: { userId: userId } },
          },
        },
      },
    });

    if (orderItems.length === 0) {
      return res.status(404).json({
        message: "No order found for this user at this restaurant today.",
      });
    }

    const order = orderItems[0].order;
    const generalComment =
      order.comments.length > 0 ? order.comments[0].text : "";

    res.status(200).json({
      orderId: order.id,
      items: orderItems.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
      })),
      generalComment: generalComment,
    });
  } catch (error) {
    console.error("Error getting order:", error);
    res
      .status(500)
      .json({ message: "Something went wrong while getting the order" });
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
      const remainingItems = await tx.orderItem.count({
        where: {
          orderId: orderId,
        },
      });

      if (remainingItems === 0) {
        await tx.order.delete({
          where: {
            id: orderId,
          },
        });
      }
    });
    res.status(200).json({ message: "Order deleted successfully" });
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
  upsertOrderForUser,
  getExistingOrderFromToday,
  deleteOrderForUser,
  getOrderBySummaryForRestaurant,
};
