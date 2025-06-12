const express = require("express");
const router = express.Router();
const {
  upsertOrderForUser,
  getOrderBySummaryForRestaurant,
  getExistingOrderFromToday,
  deleteOrderForUser,
} = require("../controllers/orderController");

router.post("/", upsertOrderForUser);

router.get("/restaurant/:restaurantId/summary", getOrderBySummaryForRestaurant);

router.get("/restaurant/:restaurantId/user/:userId", getExistingOrderFromToday);

router.delete("/:orderId/user/:userId", deleteOrderForUser);

module.exports = router;
