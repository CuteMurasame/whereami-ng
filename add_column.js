const { sequelize } = require('./server/models');

async function addColumn() {
    try {
        await sequelize.authenticate();
        console.log('Connected.');
        
        try {
            await sequelize.query('ALTER TABLE maps ADD COLUMN is_singleplayer BOOLEAN DEFAULT false;');
            console.log('Column added.');
        } catch (e) {
            if (e.original && e.original.code === 'ER_DUP_FIELDNAME') {
                console.log('Column already exists.');
            } else {
                throw e;
            }
        }
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

addColumn();