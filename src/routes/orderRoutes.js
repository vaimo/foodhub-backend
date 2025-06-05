const express = require("express");
const router = express.Router();
const {
  createOrder,
  getOrderBySummaryForRestaurant,
} = require("../controllers/orderController");

router.post("/", createOrder);

router.get("/restaurant/:restaurantId/summary", getOrderBySummaryForRestaurant);

module.exports = router;
