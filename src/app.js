const express = require ('express');
const restaurantRoutes = require('./routes/restaurantRoutes');

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Welkom bij de Foodhub Backend! Yeah!');
});

app.use('/api/restaurants', restaurantRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});