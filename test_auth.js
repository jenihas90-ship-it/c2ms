const db = require('./src/db');
const bcrypt = require('bcryptjs');

(async () => {
    try {
        console.log("Checking for default respondent...");
        const res = await db.get("SELECT * FROM users WHERE username = 'respondent'");
        console.log(res);

        if (res) {
            const isMatch = await bcrypt.compare('resp123', res.password);
            console.log("Password match for resp123: ", isMatch);
        }

    } catch (e) {
        console.error(e);
    }
})();
