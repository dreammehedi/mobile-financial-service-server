const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());

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
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // database
    const database = client.db("MobileFinancialService");
    const users = database.collection("users");

    // register users
    app.post("/api/register", async (req, res) => {
      const { name, mobileNumber, email, pin } = req.body;
      const hashedPin = await bcrypt.hash(pin, 10);

      try {
        const user = {
          name,
          mobileNumber,
          email,
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
    app.post("/api/login", async (req, res) => {
      const { identifier, pin } = req.body;
      try {
        // find user register before login
        const user = await users.findOne({
          $or: [{ mobileNumber: identifier }, { email: identifier }],
        });
        if (!user) return res.status(400).send("User not found!");

        // check user pin is match number and email register pin
        const isPinValid = await bcrypt.compare(pin, user.pin);
        if (!isPinValid) return res.status(400).send("Invalid PIN!");

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
        res.status(500).send("Internal Server Error!");
      }
    });

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
