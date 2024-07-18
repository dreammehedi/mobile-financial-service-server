const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
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
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const transactions = database.collection("transactions");
    const cashInOutAgent = database.collection("cashInOutAgent");

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

        res.json({ token, status: user?.status, success: true });
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
    app.get("/all-users", authenticate, verifyAdmin, async (req, res) => {
      // user idetified
      const userSearchValue = req.query.userFind;

      try {
        let result;

        if (userSearchValue) {
          // Find user based on search value
          result = await users
            .find({
              $or: [
                { mobileNumber: new RegExp(userSearchValue, "i") }, // Case-insensitive search
                { email: new RegExp(userSearchValue, "i") },
              ],
            })
            .toArray(); // Convert to array for consistent response

          if (result.length > 0) {
            res.send(result);
          } else {
            res.send({ message: "User not found!" });
          }
        } else {
          // Fetch all users if no search value is provided
          result = await users.find().toArray();
          res.send(result);
        }
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server Error!" });
      }
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

    // verify user pin
    const verifyUserPin = async (mobileNumber, pin) => {
      const user = await users.findOne({ mobileNumber });
      if (!user) return null;
      const isPinValid = await bcrypt.compare(pin, user?.pin);
      return isPinValid ? user : null;
    };

    // verify user balance
    const verifyBalance = async (mobileNumber, amount) => {
      const user = await users.findOne({ mobileNumber });
      if (!user) return false;
      return user.balance >= amount;
    };

    // verify user is agent
    const verifyAgent = async (mobileNumber) => {
      const user = await users.findOne({ mobileNumber });
      return user?.role === "agent";
    };

    // user send money
    app.post("/user-send-money", authenticate, async (req, res) => {
      try {
        const { recipient, amount, PIN } = req.body;

        const userMobileNumber = req?.user?.mobileNumber;

        // Verify user pin and JWT token
        const userPin = await verifyUserPin(userMobileNumber, PIN);

        if (!userPin) {
          return res.status(401).send({ message: "Invalid PIN!" });
        }

        // check user has enough balance
        const userBalance = await verifyBalance(userMobileNumber, amount);
        if (!userBalance) {
          return res.status(403).send({ message: "Insufficient balance!" });
        }

        // check recipient user
        const recipientUser = await users.findOne({ mobileNumber: recipient });
        if (!recipientUser) {
          return res.status(404).send({ message: "User not found!" });
        }

        // Generate a unique transaction ID
        const transactionId = uuidv4();

        // Update the recipient's balance
        await users.updateOne(
          { mobileNumber: recipient },
          { $inc: { balance: amount } }
        );

        // Update the sender's balance
        await users.updateOne(
          { mobileNumber: req?.user?.mobileNumber },
          { $inc: { balance: -amount } }
        );

        // Record the transaction
        await transactions.insertOne({
          transactionId,
          senderId: req?.user?.mobileNumber,
          recipient,
          amount,
          date: new Date(),
          type: "send-money",
        });

        res.send({ message: "Transaction successful", transactionId });
      } catch (err) {
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // user cash out
    app.post("/user-cash-out", authenticate, async (req, res) => {
      try {
        const { recipient, totalAmount, PIN } = req.body;
        const userMobileNumber = req?.user?.mobileNumber;

        // Verify user pin and JWT token
        const userPin = await verifyUserPin(userMobileNumber, PIN);
        if (!userPin) {
          return res.status(401).send({ message: "Invalid PIN!" });
        }

        // check user has enough balance
        const userBalance = await verifyBalance(userMobileNumber, totalAmount);
        if (!userBalance) {
          return res.status(403).send({ message: "Insufficient balance!" });
        }

        // check if recipient is the agent
        const userAgent = await verifyAgent(recipient);
        if (!userAgent) {
          return res.status(403).send({
            message:
              "Reciver is not agent! Please provide a valid agent number!",
          });
        }

        const cashOutUserRequestAgent = {
          senderNumber: userMobileNumber,
          agentNumber: recipient,
          amount: totalAmount,
          date: new Date(),
          type: "cash-out",
          status: "pending",
        };

        // Update the recipient's balance
        const result = await cashInOutAgent.insertOne(cashOutUserRequestAgent);
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // user cash in
    app.post("/user-cash-in", authenticate, async (req, res) => {
      try {
        const { recipient, amount, PIN } = req.body;
        const userMobileNumber = req?.user?.mobileNumber;

        // Verify user pin and JWT token
        const userPin = await verifyUserPin(userMobileNumber, PIN);
        if (!userPin) {
          return res.status(401).send({ message: "Invalid PIN!" });
        }

        // check if recipient is the agent
        const userAgent = await verifyAgent(recipient);
        if (!userAgent) {
          return res.status(403).send({
            message:
              "Reciver is not agent! Please provide a valid agent number!",
          });
        }

        const cashInUserRequestAgent = {
          senderNumber: userMobileNumber,
          agentNumber: recipient,
          amount,
          date: new Date(),
          type: "cash-in",
          status: "pending",
        };

        // Update the recipient's balance
        const result = await cashInOutAgent.insertOne(cashInUserRequestAgent);
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // get all transactions history in user
    app.get("/all-transactions-history", authenticate, async (req, res) => {
      try {
        const userMobileNumber = req?.user?.mobileNumber;

        const getUserId = await users.findOne({
          mobileNumber: userMobileNumber,
        });

        const query = {
          $or: [{ senderId: userMobileNumber }, { userId: getUserId?._id }],
        };

        const result = await transactions
          .find(query)
          .sort({ date: -1 })
          .limit(10)
          .toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Internal server error!" });
      }
    });

    // admin all transaction history get
    app.get(
      "/admin-all-transactions-history",
      authenticate,
      verifyAdmin,
      async (req, res) => {
        const result = await transactions.find().toArray();
        res.send(result);
      }
    );

    // cash in or out transaction request
    app.get("/cash-in-or-out-request", authenticate, async (req, res) => {
      const agentNumber = req?.user?.mobileNumber;
      const query = { agentNumber: agentNumber };
      const result = await cashInOutAgent
        .find(query)
        .sort({ date: -1 })
        .limit(20)
        .toArray();
      res.send(result);
    });

    // cash in appprove agent
    app.patch("/cash-in-out-approve-agent", authenticate, async (req, res) => {
      try {
        const approveData = req.body;
        const { senderNumber, agentNumber, amount, type } = approveData;

        // Find cash-in request user
        const cashInUser = await users.findOne({
          mobileNumber: senderNumber,
        });
        if (!cashInUser) {
          return res.status(404).send({ message: "User not found!" });
        }

        // Find approving agent
        const findAgent = await users.findOne({
          mobileNumber: agentNumber,
        });
        if (!findAgent) {
          return res.status(404).send({ message: "Agent not found!" });
        }

        // Check if the agent has enough balance
        if (findAgent.balance < amount) {
          return res.status(403).send({ message: "Insufficient balance!" });
        }

        // Generate a unique transaction ID
        const transactionId = uuidv4();
        // cash in
        if (type === "cash-in") {
          //  Add amount to user balance and deduct from agent balance
          await users.updateOne(
            { mobileNumber: senderNumber },
            { $inc: { balance: amount } }
          );

          await users.updateOne(
            { mobileNumber: agentNumber },
            { $inc: { balance: -amount } }
          );

          await cashInOutAgent.updateOne(
            {
              senderNumber,
              agentNumber,
              amount,
            },
            {
              $set: { status: "approved" },
            }
          );
          // Record the transaction
          await transactions.insertOne({
            transactionId,
            senderId: senderNumber,
            recipiend: agentNumber,
            amount,
            type: "cash-in",
            date: new Date(),
            status: "approved",
          });

          return res.send({ success: true, message: "Cash-in approved." });
        }

        // cash out
        if (type === "cash-out") {
          //  deduct amount from user balance and add to agent balance
          await users.updateOne(
            { mobileNumber: senderNumber },
            { $inc: { balance: -amount } }
          );

          await users.updateOne(
            { mobileNumber: agentNumber },
            { $inc: { balance: amount } }
          );

          await cashInOutAgent.updateOne(
            {
              senderNumber,
              agentNumber,
              amount,
            },
            {
              $set: { status: "approved" },
            }
          );

          // Record the transaction
          await transactions.insertOne({
            transactionId,
            senderId: senderNumber,
            recipiend: agentNumber,
            amount,
            type: "cash-out",
            date: new Date(),
            status: "approved",
          });

          return res.send({ success: true, message: "Cash-out approved." });
        }

        return res.status(400).send({ message: "Invalid transaction type!" });
      } catch (err) {
        res.status(500).send({ message: "Internal server error!" });
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
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
