const express = require('express');
const router = express.Router({ mergeParams: true });
const { createMenuItemForRestaurant, getAllMenuItemsForRestaurant, updateMenuItem, deleteMenuItem } = require('../controllers/menuItemController');

router.post('/', createMenuItemForRestaurant);

router.get('/', getAllMenuItemsForRestaurant);

router.put('/:menuItemId', updateMenuItem);

router.delete('/:menuItemId', deleteMenuItem);

module.exports = router;