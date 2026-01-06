const { sequelize } = require('./server/models');

async function migrate() {
    try {
        await sequelize.authenticate();
        console.log('Connected.');
        await sequelize.sync({ alter: true });
        console.log('Database synced.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

migrate();