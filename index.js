const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://flexiwalled.surge.sh",
      "https://flexiwalled.vercel.app",
    ],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  })
);
app.use(express.json());

// middleware user token authenticate in JWT
const authenticate = (req, res, next) => {
  const token = req.header("Authorization").replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).send({ message: "Please authenticate!" });
  }
};

// database configuration
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    // database
    const database = client.db("MobileFinancialService");
    const users = database.collection("users");

    // register users
    app.post("/register", async (req, res) => {
      const { name, mobileNumber, email, pin, role } = req.body;
      const hashedPin = await bcrypt.hash(pin, 10);

      try {
        // check if user already exists
        const existingUser = await users.findOne({
          $or: [{ mobileNumber }, { email }],
        });
        if (existingUser)
          return res.status(400).send({ message: "User already exists!" });

        const user = {
          name,
          mobileNumber,
          email,
          role,
          pin: hashedPin,
          balance: 0,
          status: "pending",
        };
        await users.insertOne(user);

        res.status(201).send({
          message: "User registered. Pending admin approval!",
          success: true,
        });
      } catch (err) {
        res.status(400).send(err.message);
      }
    });

    // login users
    app.post("/login", async (req, res) => {
      const { identifier, pin } = req.body;
      try {
        // find user register before login
        const user = await users.findOne({
          $or: [{ mobileNumber: identifier }, { email: identifier }],
        });
        if (!user) return res.status(400).send({ message: "User not found!" });

        // check user pin is match number and email register pin
        const isPinValid = await bcrypt.compare(pin, user.pin);
        if (!isPinValid)
          return res.status(400).send({ message: "An error occurred!" });

        // token payload
        const tokenPayload = {
          mobileNumber: user.mobileNumber,
          email: user.email,
        };

        // create user token
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET_KEY, {
          expiresIn: process.env.JWT_EXPIRATION_TIME,
        });
        res.json({ token, success: true });
      } catch (error) {
        res.status(500).send({ message: "Internal Server Error!" });
      }
    });

    // get user data
    app.get("/users", authenticate, async (req, res) => {
      try {
        // find user
        const user = await users.findOne({
          $or: [
            { mobileNumber: req.user.mobileNumber },
            { email: req.user.email },
          ],
        });
        if (!user) return res.status(404).send({ message: "User not found!" });
        res.json({
          name: user?.name,
          email: user?.email,
          mobileNumber: user?.mobileNumber,
          balance: user?.balance,
          role: user?.role,
          status: user?.status,
        });
      } catch (error) {
        res.status(500).send({ message: "Internal Server Error!" });
      }
    });

    // verify admin
    const verifyAdmin = async (req, res, next) => {
      try {
        const userMobileNumber = req?.user?.mobileNumber;
        const userEmail = req?.user?.email;

        // find user is valid before data get
        const user = await users.findOne({
          $or: [{ mobileNumber: userMobileNumber }, { email: userEmail }],
        });

        if (user?.role === "admin") {
          next();
        }
      } catch (err) {
        res.status(403).send({ message: "Access denied!" });
      }
    };

    // get all users
    app.get("/all-users", async (req, res) => {
      const usersData = await users.find().toArray();
      res.send(usersData);
    });

    // admin activate user account
    app.patch(
      "/user-active/:email",

      async (req, res) => {
        // get user email
        const email = req.params.email;

        // query user
        const query = { email: email };

        // Check if the user exists
        const existingUser = await users.findOne(query);

        if (!existingUser) {
          return res.status(404).send({ message: "User not found!" });
        }

        // Check the current status
        if (existingUser.status === "active") {
          return res
            .status(400)
            .send({ message: "Account is already active!" });
        }

        // updated status and balance
        let updatedStates;
        if (existingUser.status === "pending" && existingUser.role === "user") {
          updatedStates = {
            $set: {
              status: "active",
              balance: 40,
            },
          };
        } else if (
          existingUser.status === "pending" &&
          existingUser.role === "agent"
        ) {
          updatedStates = {
            $set: {
              status: "active",
              balance: 10000,
            },
          };
        } else {
          updatedStates = {
            $set: {
              status: "active",
            },
          };
        }

        const result = await users.updateOne(query, updatedStates);
        res.send(result);
      }
    );

    // admin blocked user account
    app.patch(
      "/user-block/:email",
      authenticate,
      verifyAdmin,
      async (req, res) => {
        // get user email
        const email = req.params.email;

        // query user
        const query = { email: email };
        // updated states
        const updatedStates = {
          $set: {
            status: "blocked",
          },
        };

        const result = await users.updateOne(query, updatedStates);
        res.send(result);
      }
    );

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// home route create
app.get("/", (req, res) => {
  res.send("Welcome to my mobile application server.");
});

// app listening on port
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
