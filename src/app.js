const express = require ('express');

const app = express();

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Welkom bij de Foodhub Backend! Yeah!');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});