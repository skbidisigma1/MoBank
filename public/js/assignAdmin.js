const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.applicationDefault()
});

const assignAdmin = async (email) => {
    try {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(user.uid, { isAdmin: true });
        console.log(`Successfully assigned admin role to ${email}`);
    } catch (error) {
        console.error("Error assigning admin role:", error);
    }
};

const email = process.argv[2];
if (!email) {
    console.log("Please provide an email as an argument.");
    process.exit(1);
}

assignAdmin(email);