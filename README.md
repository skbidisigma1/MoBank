# MoBank

MoBank is a web-based application that helps teachers manage and monitor student currency—MoBucks—in a fun and efficient way.

## Key Features
- **Real-Time Updates:** Instantly track your MoBuck balance.
- **Transaction History:** View detailed logs of your recent transactions.
- **Peer Transfers:** Easily send MoBucks to classmates.
- **Secure Authentication:** Protect user data with Google OAuth via Auth0.
- **Admin Controls:** Use a dedicated admin panel to manage student balances and class periods.
- **Firebase Integration:** Benefit from fast, secure, and scalable data storage with Firebase Firestore.
- **Responsive Design:** Enjoy a seamless experience on both desktop and mobile devices.

## How It Works
- **Access the App:** Visit [mo-classroom.us](https://mo-classroom.us).
- **Sign In:** Use the login page to authenticate.
- **Set Up:** On your first login, configure your profile with your class period and preferred settings.
- **Transact:** Use the “Send MoBucks” feature to transfer currency.
- **Admin Management:** Teachers and admins can update student balances and class settings through the admin panel.

## Technical Overview
- **Backend:** Node.js with Express
- **Deployment:** Hosted on Vercel
- **Database:** Firebase Firestore
- **Authentication:** Auth0 (Google OAuth, JWT)
- **Security:** CSRF protection (Lusca), rate limiting (express-rate-limit), and Content Security Policy enforced by Vercel
- **Configuration:** Managed through Vercel for streamlined deployment

## Contact
For support or feedback, please reach out:
- **Email:** [luke.c309@stu.nebo.edu](mailto:luke.c309@stu.nebo.edu)
- **GitHub:** [skbidisigma1](https://github.com/skbidisigma1)
