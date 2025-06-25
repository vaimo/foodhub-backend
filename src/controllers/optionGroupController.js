// controllers/optionGroupController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();


// Create an OptionGroup
exports.createOptionGroup = async (req, res) => {
  const { name } = req.body;
  try {
    const optionGroup = await prisma.optionGroup.create({
      data: { name },
    });
    res.status(201).json(optionGroup);
  } catch (error) {
    console.error('Error creating OptionGroup:', error);
    res.status(500).json({ error: 'Failed to create OptionGroup' });
  }
};

// Get all OptionGroups
exports.getAllOptionGroups = async (req, res) => {
  try {
    const optionGroups = await prisma.optionGroup.findMany({
      // --- ADD THIS INCLUDE BLOCK ---
      include: {
        options: true // This tells Prisma to include all Option records related to each OptionGroup
      }
      // --- END INCLUDE BLOCK ---
    });
    res.status(200).json(optionGroups);
  } catch (error) {
    console.error('Error fetching OptionGroups:', error);
    res.status(500).json({ error: 'Failed to retrieve OptionGroups' });
  }
};

// Get OptionGroup by ID
exports.getOptionGroupById = async (req, res) => {
  const { optionGroupId } = req.params;
  try {
    const optionGroup = await prisma.optionGroup.findUnique({
      where: { id: optionGroupId },
    });
    if (!optionGroup) {
      return res.status(404).json({ error: 'OptionGroup not found' });
    }
    res.status(200).json(optionGroup);
  } catch (error) {
    console.error('Error fetching OptionGroup by ID:', error);
    res.status(500).json({ error: 'Failed to retrieve OptionGroup' });
  }
};

// Update an OptionGroup
exports.updateOptionGroup = async (req, res) => {
  const { optionGroupId } = req.params;
  const { name } = req.body;
  try {
    const updatedOptionGroup = await prisma.optionGroup.update({
      where: { id: optionGroupId },
      data: { name },
    });
    res.status(200).json(updatedOptionGroup);
  } catch (error) {
    console.error('Error updating OptionGroup:', error);
    res.status(500).json({ error: 'Failed to update OptionGroup' });
  }
};

// Delete an OptionGroup
exports.deleteOptionGroup = async (req, res) => {
  const { optionGroupId } = req.params;
  try {
    // Before deleting, consider if you want to delete associated options or set their optionGroupId to null (if allowed by schema).
    // For now, let's assume Prisma's default cascade behavior or handle it manually if needed.
    await prisma.optionGroup.delete({
      where: { id: optionGroupId },
    });
    res.status(204).send(); // No content for successful deletion
  } catch (error) {
    console.error('Error deleting OptionGroup:', error);
    res.status(500).json({ error: 'Failed to delete OptionGroup' });
  }
};

// --- Option CRUD Operations (nested under OptionGroup) ---

// Create an Option for a specific OptionGroup
exports.createOptionForOptionGroup = async (req, res) => {
  const { optionGroupId } = req.params;
  const { value, price } = req.body; // price is optional, defaults to 0 in schema
  try {
    // Check if the optionGroup exists
    const optionGroupExists = await prisma.optionGroup.findUnique({
      where: { id: optionGroupId },
    });
    if (!optionGroupExists) {
      return res.status(404).json({ error: 'OptionGroup not found' });
    }

    const option = await prisma.option.create({
      data: {
        value,
        price: price !== undefined ? price : 0, // Ensure price is handled, default 0
        optionGroup: {
          connect: { id: optionGroupId },
        },
      },
    });
    res.status(201).json(option);
  } catch (error) {
    console.error('Error creating Option for OptionGroup:', error);
    res.status(500).json({ error: 'Failed to create Option' });
  }
};

// Get all Options for a specific OptionGroup
exports.getOptionsByOptionGroup = async (req, res) => {
  const { optionGroupId } = req.params;
  try {
    const options = await prisma.option.findMany({
      where: { optionGroupId: optionGroupId },
    });
    res.status(200).json(options);
  } catch (error) {
    console.error('Error fetching Options for OptionGroup:', error);
    res.status(500).json({ error: 'Failed to retrieve Options' });
  }
};

// Update an Option
exports.updateOption = async (req, res) => {
  const { optionId, optionGroupId } = req.params; // optionGroupId might be used for validation if needed
  const { value, price } = req.body;
  try {
    const updatedOption = await prisma.option.update({
      where: { id: optionId },
      data: { value, price },
    });
    res.status(200).json(updatedOption);
  } catch (error) {
    console.error('Error updating Option:', error);
    res.status(500).json({ error: 'Failed to update Option' });
  }
};

// Delete an Option
exports.deleteOption = async (req, res) => {
  const { optionId, optionGroupId } = req.params; // optionGroupId might be used for validation if needed
  try {
    await prisma.option.delete({
      where: { id: optionId },
    });
    res.status(204).send(); // No content for successful deletion
  } catch (error) {
    console.error('Error deleting Option:', error);
    res.status(500).json({ error: 'Failed to delete Option' });
  }
};