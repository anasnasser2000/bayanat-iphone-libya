'use strict';
require('../scripts/env');
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL غير مضبوط. انظر .env.example'); process.exit(1); }
const app = require('./app');
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`listening on :${port}`));
