const express = require('express');
const router = express.Router();
const {
  createOptionGroup,
  getAllOptionGroups,
  getOptionGroupById,
  updateOptionGroup,
  deleteOptionGroup,
  createOptionForOptionGroup, 
  getOptionsByOptionGroup,
  updateOption,
  deleteOption
} = require('../controllers/optionGroupController');

router.post('/', createOptionGroup);
router.get('/', getAllOptionGroups);
router.get('/:optionGroupId', getOptionGroupById);
router.put('/:optionGroupId', updateOptionGroup);
router.delete('/:optionGroupId', deleteOptionGroup);

router.post('/:optionGroupId/options', createOptionForOptionGroup);
router.get('/:optionGroupId/options', getOptionsByOptionGroup);
router.put('/:optionGroupId/options/:optionId', updateOption);
router.delete('/:optionGroupId/options/:optionId', deleteOption);

module.exports = router;