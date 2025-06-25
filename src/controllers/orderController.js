// controllers/orderController.js
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
        !item.itemNameAtOrder ||
        // Validate selectedOptions structure if provided
        (item.selectedOptions && (!Array.isArray(item.selectedOptions) ||
          item.selectedOptions.some(opt =>
            !opt.optionId ||
            opt.value === undefined ||
            opt.price === undefined // Price can be 0, but must be defined
          )
        ))
    );

    if (invalidItems.length !== 0) {
      throw new Error(
        "Each item must have menuItemId, userId, quantity (greater than 0), priceAtOrder, itemNameAtOrder, and valid selectedOptions if provided"
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

      // Delete existing order items and their associated options for this user and order
      // We need to delete OrderItemOptions first due to foreign key constraints if OrderItem is deleted
      const existingOrderItemsForUser = await tx.orderItem.findMany({
        where: {
          orderId: order.id,
          userId: currentUserId,
        },
        select: { id: true }
      });

      if (existingOrderItemsForUser.length > 0) {
        const existingOrderItemIds = existingOrderItemsForUser.map(item => item.id);
        await tx.orderItemOption.deleteMany({
          where: {
            orderItemId: { in: existingOrderItemIds }
          }
        });
        await tx.orderItem.deleteMany({
          where: {
            id: { in: existingOrderItemIds }
          }
        });
      }


      // Prepare data for OrderItems and their Options
      const orderItemsToCreate = [];
      const orderItemOptionsToCreate = [];
      let totalOrderPriceForUser = 0; // Keep track of current user's items for total price calc

      for (const item of items) {
        const orderItemData = {
          orderId: order.id,
          userId: item.userId,
          menuItemId: item.menuItemId,
          itemNameAtOrder: item.itemNameAtOrder,
          priceAtOrder: item.priceAtOrder,
          quantity: item.quantity,
        };
        
        // Calculate price for this single order item including its base price
        let currentItemTotalPrice = item.priceAtOrder * item.quantity;

        // Create the OrderItem
        const createdOrderItem = await tx.orderItem.create({
          data: orderItemData,
        });

        // If selectedOptions exist, prepare their data for creation
        if (item.selectedOptions && Array.isArray(item.selectedOptions)) {
          for (const option of item.selectedOptions) {
            // Add option's price to the current item's total price
            currentItemTotalPrice += option.price * item.quantity; // Option price * quantity of menu item

            orderItemOptionsToCreate.push({
              orderItemId: createdOrderItem.id,
              optionId: option.optionId,
              optionValueAtOrder: option.value,
              optionPriceAtOrder: option.price,
              optionGroupNameAtOrder: option.groupName, // Use the provided group name
            });
          }
        }
        totalOrderPriceForUser += currentItemTotalPrice;
      }
      
      // Create OrderItemOptions in a batch
      if (orderItemOptionsToCreate.length > 0) {
        await tx.orderItemOption.createMany({
          data: orderItemOptionsToCreate,
        });
      }

      // Delete existing general comments for this user and order
      await tx.orderComment.deleteMany({
        where: {
          orderId: order.id,
          userId: currentUserId,
        },
      });

      // Create new general comment if provided
      if (generalComment && generalComment.userId && generalComment.text) {
        await tx.orderComment.create({
          data: {
            orderId: order.id,
            userId: generalComment.userId,
            text: generalComment.text.trim(),
          },
        });
      }

      // Re-calculate the total price for the entire order (all users)
      // This part remains similar, but it will now implicitly include option prices
      // because they are factored into each OrderItem's contribution to the total.
      const allOrderItems = await tx.orderItem.findMany({
        where: { orderId: order.id },
        include: {
          selectedOptions: true // Include selected options to calculate full total
        }
      });

      let totalOrderPrice = 0;
      for (const item of allOrderItems) {
          let itemSubtotal = item.priceAtOrder * item.quantity;
          for (const selectedOption of item.selectedOptions) {
              itemSubtotal += selectedOption.optionPriceAtOrder * item.quantity; // Multiply option price by item quantity
          }
          totalOrderPrice += itemSubtotal;
      }


      const finalOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          totalPrice: totalOrderPrice,
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
        // Include selected options for each order item
        selectedOptions: true,
      },
    });

    if (!orderItems || orderItems.length === 0) {
      return res.status(200).json([]);
    }

    const summary = {};
    const orderComments = {};
    const detailsByUser = {};

    orderItems.forEach((item) => {
      // General comments associated with the order itself
      if (item.order.comments && item.order.comments.length > 0) {
        // Filter comments to only include those relevant to the specific order, if needed
        // For a daily order system, all comments for that day's order will be shown
        orderComments[item.orderId] = item.order.comments;
      }

      // Calculate total price for this specific order item including options
      let itemTotalPriceIncludingOptions = item.priceAtOrder;
      if (item.selectedOptions) {
          item.selectedOptions.forEach(option => {
              itemTotalPriceIncludingOptions += option.optionPriceAtOrder;
          });
      }


      // Aggregated summary by menu item
      if (!summary[item.menuItemId]) {
        summary[item.menuItemId] = {
          menuItemId: item.menuItemId,
          itemName: item.itemNameAtOrder,
          totalQuantity: 0,
          // Price per item for summary should probably be base item price
          // if you want to show options separately, or the average.
          // For simplicity, let's keep base price here.
          pricePerItem: item.priceAtOrder,
          instances: [],
          // Also add an array to collect selected options for summary if needed
          // You might need a more complex aggregation for options here based on your display needs
          selectedOptionsSummary: {} // e.g., { "without salt": 5, "mayonnaise": 3 }
        };
      }
      summary[item.menuItemId].instances.push({
        quantity: item.quantity,
        // Optionally include options here for detailed instance view
        selectedOptions: item.selectedOptions.map(opt => ({
            value: opt.optionValueAtOrder,
            price: opt.optionPriceAtOrder,
            groupName: opt.optionGroupNameAtOrder
        }))
      });

      summary[item.menuItemId].totalQuantity += item.quantity;
      // Aggregate options for the summary view
      if (item.selectedOptions) {
        item.selectedOptions.forEach(option => {
          const optionKey = `${option.optionGroupNameAtOrder || 'Other'}: ${option.optionValueAtOrder}`;
          summary[item.menuItemId].selectedOptionsSummary[optionKey] = 
            (summary[item.menuItemId].selectedOptionsSummary[optionKey] || 0) + item.quantity;
        });
      }


      // Details by user
      const userId = item.userId;
      if (!detailsByUser[userId]) {
        detailsByUser[userId] = {
          orderId: item.orderId,
          userName: item.user.name,
          userTotal: 0,
          items: [],
        };
      }
      // Calculate total price for this specific item (quantity * (base_price + sum_of_option_prices))
      const itemPriceWithAllOptions = item.priceAtOrder + item.selectedOptions.reduce((acc, opt) => acc + opt.optionPriceAtOrder, 0);
      const itemTotalForUser = item.quantity * itemPriceWithAllOptions;


      detailsByUser[userId].items.push({
        itemName: item.itemNameAtOrder,
        quantity: item.quantity,
        price: item.priceAtOrder, // Base price
        selectedOptions: item.selectedOptions.map(opt => ({ // Include selected options here
            value: opt.optionValueAtOrder,
            price: opt.optionPriceAtOrder,
            groupName: opt.optionGroupNameAtOrder
        })),
        totalPrice: itemTotalForUser, // Total price for this specific item line
      });
      detailsByUser[userId].userTotal += itemTotalForUser;
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


// (Keep getExistingOrderFromToday and deleteOrderForUser as they are)
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
        // Include selected options for each order item
        selectedOptions: true,
      },
    });

    if (orderItems.length === 0) {
      return res.status(200).json(null);
    }

    const order = orderItems[0].order;
    const generalComment =
      order.comments.length > 0 ? order.comments[0].text : "";

    res.status(200).json({
      orderId: order.id,
      items: orderItems.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        // Include selected options in the response
        selectedOptions: item.selectedOptions.map(opt => ({
            optionId: opt.optionId,
            value: opt.optionValueAtOrder,
            price: opt.optionPriceAtOrder,
            groupName: opt.optionGroupNameAtOrder
        }))
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
      // First, delete related OrderItemOptions for the items being deleted
      const orderItemsToDelete = await tx.orderItem.findMany({
        where: {
          orderId: orderId,
          userId: userId,
        },
        select: { id: true }
      });

      if (orderItemsToDelete.length > 0) {
        const orderItemIdsToDelete = orderItemsToDelete.map(item => item.id);
        await tx.orderItemOption.deleteMany({
          where: {
            orderItemId: { in: orderItemIdsToDelete }
          }
        });
      }

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
        // If there are remaining items, recalculate total price including options
        const remainingItems = await tx.orderItem.findMany({
          where: {
            orderId: orderId,
          },
          include: {
            selectedOptions: true // Include options for accurate total price
          }
        });

        let newTotalInCents = 0;
        for (const item of remainingItems) {
            let itemSubtotal = item.priceAtOrder * item.quantity;
            for (const selectedOption of item.selectedOptions) {
                itemSubtotal += selectedOption.optionPriceAtOrder * item.quantity;
            }
            newTotalInCents += itemSubtotal;
        }

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
  getExistingOrderFromToday,
  deleteOrderForUser,
  getOrderBySummaryForRestaurant,
};