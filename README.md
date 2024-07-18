# Mobile Financial Service (MFS) Application - Server Side

## Project Overview

This project is a backend service for a basic Mobile Financial Service (MFS) application similar to bKash or Nagad. It handles user authentication, transactions, and data management.

## Features

### User

- **Registration**: Users can register by providing their Name, 5-digit PIN, Mobile Number, and Email. Initially, user status is pending until approved by the admin.
- **Secure Login**: Users can log in using their Mobile Number/Email and PIN. JWT is used for authentication.
- **Send Money**: Users can send money to other users with PIN and JWT verification.
- **Cash-Out**: Users can cash out through an agent with PIN and JWT verification.
- **Cash-In**: Users can request cash-in through agents.
- **Balance Inquiry**: Users can check their account balance anytime.
- **Transaction History**: Users can view their last 10 transactions.

### Agent

- **Registration**: Agents can register by providing their Name, 5-digit PIN, Mobile Number, and Email. Initially, agent status is pending until approved by the admin.
- **Secure Login**: Agents can log in using their Mobile Number/Email and PIN. JWT is used for authentication.
- **Transaction Management**: Agents can manage cash-in and cash-out requests.
- **Balance Inquiry**: Agents can check their account balance anytime.
- **Transaction History**: Agents can view their last 20 transactions.

### Admin

- **Secure Login**: Admin can log in using their Mobile Number/Email and PIN. JWT is used for authentication.
- **User Management**: Admin can view all users, search for specific users, and manage user accounts.
- **System Monitoring**: Admin can see all transactions within the system.

## Technology Used

- **Node.js**: For server-side runtime
- **Express.js**: For building the REST API
- **MongoDB**: For database
- **Cors**: For enabling cross-origin requests
- **jsonwebtoken**: For JWT authentication
- **uuid**: For generating unique IDs
- **bcryptjs**: For hashing PINs

## Installation

1. Clone the repository:

```bash
    git clone https://github.com/dreammehedi/mobile-financial-service-server.git

```

2. Install dependencies:

- **npm install**

3. Create a .env file and add your environment variables:

   - MONGODB_URI = mongodb+srv://< username >:< password >@cluster0.sizskqa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   - JWT_SECRET_KEY = < add your secred key >
   - JWT_EXPIRATION_TIME = '1h'

4. Start the development server:
   - npm start
   - The application will be available at http://localhost:5000

## Usage

Use the provided API endpoints to interact with the system.
Register users and agents.
Perform transactions like sending money, cashing out, and cashing in.

## Authentication

JWT (JSON Web Token) is used for secure authentication. Tokens are generated upon login and used for subsequent requests to protected routes.

## API Endpoints

## Auth

POST /api/auth/register: Register a new user or agent
POST /api/auth/login: Login a user, agent, or admin

## Users

- GET /all-users: Get all users (Admin only)
- PATCH /user-active/:email: Update user status (Admin only)
- PATCH /user-block/:email: Update user status (Admin only)

## Users Register and Login

- GET /users: Get all users
- POST /register: User regiser
- POST /login: User login

## Transactions

- POST /user-send-money: Send money
- POST /user-cash-out: Cash out money
- POST /user-cash-in: Cash in money
- GET /all-transactions-history: Get transaction history
- GET /cash-in-or-out-request: Cash in or Cash out money request for agent
- GET /cash-in-out-approve-agent: Cash in or Cash out money request Approve for agent

## Security

- PINs are hashed using bcrypt.js before being stored in the database.
- JWT is used for authentication and authorization.

## Contact Information

If you have any questions, please contact me:

- [Facebook](https://www.facebook.com/dreammehedihassan/)

- [LinkedIn](https://www.linkedin.com/in/mehedi-hassan-miraj/)

- Gmail: dreammehedihassan@gmail.com

- Phone: +8801830143234

- [Portfolio Website](https://mehedihassan.vercel.app/)
