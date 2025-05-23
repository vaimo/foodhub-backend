const express = require('express');
const router = express.Router();
const { createRestaurant, getAllRestaurants, updateRestaurant, deleteRestaurant } = require('../controllers/restaurantController');
const menuItemRoutes = require('./menuItemRoutes');
const { createRestaurant, getAllRestaurants, getRestaurantById, updateRestaurant, deleteRestaurant } = require('../controllers/restaurantController');

router.post('/', createRestaurant);

router.get('/', getAllRestaurants);

router.get('/:id', getRestaurantById);

router.put('/:id', updateRestaurant);

router.delete('/:id', deleteRestaurant);

router.use('/:restaurantId/menuitems', menuItemRoutes);

module.exports = router;