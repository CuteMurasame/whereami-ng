const { sequelize, Game, Guess, Map, Location } = require('./server/models');

async function test() {
    try {
        // Find any game
        const game = await Game.findOne();
        if (!game) {
            console.log("No games found in DB");
            return;
        }
        console.log("Found game ID:", game.id);

        // Try the query from the route
        const fullGame = await Game.findByPk(game.id, {
            include: [
                { model: Map, attributes: ['name'] },
                { 
                    model: Guess, 
                    attributes: ['round_number', 'guess_lat', 'guess_lng', 'score', 'distance_meters'],
                    include: [{ model: Location, attributes: ['lat', 'lng', 'pano_id'] }]
                }
            ],
            order: [[Guess, 'round_number', 'ASC']]
        });

        if (fullGame) {
            console.log("Query successful!");
            console.log("Guesses:", fullGame.Guesses.length);
        } else {
            console.log("Query returned null");
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await sequelize.close();
    }
}

test();