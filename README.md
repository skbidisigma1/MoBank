# MoBank

MoBank is a web-based application designed to provide an easy, efficient way for a teacher to manage student currency, MoBucks.

## Key Features
- **Real-Time Currency Updates**: Track your MoBuck balance in real time.
- **Transaction History**: View transaction logs to see recent transactions for your account.
- **User-to-User Transactions**: An easy way for users to transfer MoBucks to each other.
- **Secure Authentication**: Secure authentication with Google using Auth0 ensures security for the site and user info.
- **Secure Admin Features**: A secure admin panel for admins to easily manage students' balances.
- **Firebase Integration**: Fast, secure database integration with Firebase Firestore.
- **Responsive Design**: Optimized to work on a variety of desktop and mobile devices.

## Usage

- This app is hosted on [https://mo-classroom.us](https://mo-classroom.us)
- Easy sign-in from the login page, accessible from the home page.
- On their first login, users will set profile data and preferences, then can access their user dashboard.
- By clicking "Send MoBucks" and entering other students' names, users can send currency to other users.
- Admins can access an admin panel through the site header, where they can select a class period and modify user balances.

## Technical Specifications

- **Framework**: Node.js, Express
- **Hosting**: Vercel, Namecheap
- **Database**: Firebase Firestore
- **Authentication**: Auth0, Google OAuth, JWT
- **CSRF (Cross Site Request Forgery) Protection**: Lusca
- **Rate Limiting**: express-rate-limit
- **CSP (Content Security Policy)**: Vercel
- **Environment Variables**: Vercel
- **Protocol**: HTTPS
- **Cross-Origin Resource Sharing (CORS)**: Enabled for API access
- **Functions**: Serverless-HTTP
- **RBAC (Role Based Access Control)**: Auth0 Actions

## Contact

For questions, feedback, or support, feel free to reach out:
- **Email**: [luke.c309@stu.nebo.edu](mailto:luke.c309@stu.nebo.edu)
- **GitHub**: [https://github.com/skbidisigma1](https://github.com/skbidisigma1)
