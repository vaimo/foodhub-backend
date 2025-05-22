const express = require('express');
const router = express.Router();
const { createRestaurant, getAllRestaurants, updateRestaurant, deleteRestaurant } = require('../controllers/restaurantController');
const menuItemRoutes = require('./menuItemRoutes');

router.post('/', createRestaurant);

router.get('/', getAllRestaurants);

router.put('/:id', updateRestaurant);

router.delete('/:id', deleteRestaurant);

router.use('/:restaurantId/menuitems', menuItemRoutes);

module.exports = router;