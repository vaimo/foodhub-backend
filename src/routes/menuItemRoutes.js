const express = require('express');
const router = express.Router({ mergeParams: true });

const { 
    createMenuItemForRestaurant, 
    getAllMenuItemsForRestaurant, 
    updateMenuItem, 
    deleteMenuItem,
    addOptionGroupToMenuItem,
    getMenuItemOptionGroups,
    removeOptionGroupFromMenuItem
} = require('../controllers/menuItemController');

// Menu items
router.post('/', createMenuItemForRestaurant);
router.get('/', getAllMenuItemsForRestaurant);
router.put('/:menuItemId', updateMenuItem);
router.delete('/:menuItemId', deleteMenuItem);

// Menu item option groups
router.post('/:menuItemId/option-groups', addOptionGroupToMenuItem);
router.get('/:menuItemId/option-groups', getMenuItemOptionGroups);
router.delete('/:menuItemId/option-groups/:optionGroupId', removeOptionGroupFromMenuItem);

module.exports = router;