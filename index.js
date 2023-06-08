const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' })
  }
  const token = authorization.split(' ')[1]
  jwt.verify(token, process.env.JWT_TOKEN, (error, decoded) => {
    if (error) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next()
  })
}

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.maiu4ju.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();
    const userCollection = client.db('football-coach-den').collection('users')
    const classCollection = client.db('football-coach-den').collection('classes')
    const paymentCollection = client.db('football-coach-den').collection('payments')

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_TOKEN, { expiresIn: '1h' })
      res.send({ token });
    })
    // user collection api
    app.get('/users/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      const result = await userCollection.find().toArray();
      res.send(result);
    })
    app.put('/user', async (req, res) => {
      const user = req.body;
      const email = user.email;
      const query = { email: email };
      const options = { upsert: true }
      const updateDoc = {$set: user}
      const result = await userCollection.updateOne(query, updateDoc, options);
      res.send(result);
    })
    app.patch('/user/:email',async(req,res)=>{
      const email = req.params.email;
      const query = {email:email}
      const updateDoc = {
        role:'instructor'
      }
      const result = await userCollection.insertOne(query,updateDoc);
      console.log(result);
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Welcome to football-coach-den-server');
})
app.listen(port, () => {
  console.log(`Successful Connect with ${port}`)
});