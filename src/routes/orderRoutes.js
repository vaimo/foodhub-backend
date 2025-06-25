const express = require("express");
const router = express.Router();
const {
  createOrder,
  getOrderBySummaryForRestaurant,
  deleteOrderForUser,
  getExistingOrderFromToday,
  getRestaurantsWithActiveOrders,
} = require("../controllers/orderController");

router.post("/", createOrder);

router.get("/restaurant/:restaurantId/summary", getOrderBySummaryForRestaurant);

router.get("/restaurant/:restaurantId/user/:userId", getExistingOrderFromToday);

router.delete("/:orderId/user/:userId", deleteOrderForUser);

router.get("/active-restaurants", getRestaurantsWithActiveOrders);

module.exports = router;
