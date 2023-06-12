const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SK);
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: '*',
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

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

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    // db collections
    const userCollection = client.db('football-coach-den').collection('users');
    const classCollection = client.db('football-coach-den').collection('classes');
    const selectCollection = client.db('football-coach-den').collection('selects');
    const paymentCollection = client.db('football-coach-den').collection('payments');

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_TOKEN, { expiresIn: '12h' })
      res.send({ token });
    })
    // verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      next();
    }
    // verify instructor 
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await userCollection.findOne(query);
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      next();
    }

    // user collection api

    app.get('/users/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      const result = await userCollection.find().toArray();
      res.send(result);
    })
    app.get('/user/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.send({ admin: false })
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })
    app.get('/instructors', async (req, res) => {
      const query = { role: 'instructor' }
      const result = await userCollection.find(query).toArray();
      res.send(result);
    })
    app.get('/user/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.send({ instructor: false })
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result);
    })
    app.get('/user/role/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let result;
      if (user?.role === 'admin') {result = 'admin'}
      else if (user?.role === 'instructor') {result = 'instructor'}
      else {result = 'user'}
      res.send(result);
    })

    app.get('/popularInstructor',async(req,res)=>{
      const query = {role:'instructor'}
      const sort = {student:-1};
      const result = await userCollection.find(query).sort(sort).limit(6).toArray();
      res.send(result);
    })

    app.put('/user', async (req, res) => {
      const user = req.body;
      const email = user.email;
      const query = { email: email };
      const options = { upsert: true }
      const updateDoc = { $set: user }
      const result = await userCollection.updateOne(query, updateDoc, options);
      res.send(result);
    })
    app.patch('/user/promote/instructor/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const email = req.body.email;
      if(email!==req.decoded.email){
        return res.status(403).send({error:true,message:'Forbidden Access'})
      }
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {role: 'instructor'}
      }
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    })
    app.patch('/user/promote/admin/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const email = req.body.email;
      if(email!==req.decoded.email){
        return res.status(403).send({error:true,message:'Forbidden Access'})
      }
      const query = { _id: new ObjectId(id) }
      const updateDoc = {$set: {role: 'admin'}}
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    })

    app.patch('/studentAdd',verifyJWT,async(req,res)=>{
      const email = req.body.email;
      const query = {email:email}
      const updateDoc={
        $inc:{student:1}
      }
      const result = await userCollection.updateOne(query,updateDoc);
      res.send(result);
    })


    // classCollection apis
    app.get('/classes/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ error: true, message: 'Forbidden Access' })
      }
      const result = await classCollection.find().toArray();
      res.send(result);
    })
    app.get('/approvedClasses', async (req, res) => {
      const query = { status: 'approved' }
      const result = await classCollection.find(query).toArray();
      res.send(result);
    })
    app.get('/class/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await classCollection.findOne(query);
      res.send(result);
    })
    app.get('/instructor/class/:email', verifyJWT, verifyInstructor, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      const query = { instructorEmail: email };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/popularClasses',async(req,res)=>{
      const query = { status: 'approved' }
      const sort = {enrolled:-1};
      const result = await classCollection.find(query).sort(sort).limit(6).toArray();
      res.send(result);
    })

    app.post('/class/:email', verifyJWT, verifyInstructor, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass);
      res.send(result);
    })
    app.patch('/editClass/:id', verifyJWT, verifyInstructor, async (req, res) => {
      const id = req.params.id;
      const updateClass = req.body;
      const email = updateClass.instructorEmail;
      if (email !== req.decoded.email) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {className: updateClass.className, seats: updateClass.seats, price: updateClass.price}
      }
      const result = await classCollection.updateOne(query, updateDoc);
      res.send(result);
    })
    app.patch('/updateClassStatus/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const email = req.body.email;
      if(email!==req.decoded.email){
        return res.status(403).send({error:true,message:'Forbidden Access'})
      }
      const query = { _id: new ObjectId(id) }
      const status = req.body.status;
      let updateDoc;
      if (status === 'deny') {
        updateDoc = { $set: { status: status } }
      }
      else { updateDoc = { $set: { status: status } } }
      const result = await classCollection.updateOne(query, updateDoc);
      res.send(result);
    })
    app.patch('/updateFeedback/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const email = req.body.email;
      if(email!==req.decoded.email){
        return res.status(403).send({error:true,message:'Forbidden Access'})
      }
      const feedback = req.body.data.feedback;
      const query = { _id: new ObjectId(id) }
      const updateDoc = {$set: { feedback: feedback }}
      const result = await classCollection.updateOne(query, updateDoc);
      res.send(result);
    })

    app.patch('/updateEnrolSeats/:id',verifyJWT,async(req,res)=>{
      const email = req.body.email;
      if(email!==req.decoded.email){
        return res.status(403).send({error:true,message:'Forbidden Access'})
      }
      const id = req.params.id;
      const query = {_id:new ObjectId(id)}
      const updateDoc={
        $inc:{seats:-1,enrolled:1}
      }
      const result = await classCollection.updateOne(query,updateDoc);
      res.send(result);
    })

    //selectedCollection apis
    app.get('/selectedByUser/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ error: true, message: 'Forbidden Access' })
      }
      const query = { email: email }
      const result = await selectCollection.find(query).toArray();
      res.send(result);
    })

    app.put('/selectedByUser/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ error: true, message: 'Forbidden Access' })
      }
      const classInfo = req.body;
      const query = { $and: [{ id: classInfo.id }, { email: email }] }
      const options = { upsert: true }
      const updateDoc = {$set: classInfo};
      const result = await selectCollection.updateOne(query, updateDoc, options);
      res.send(result);
    })
    app.delete('/cancelByUser/:id',verifyJWT, async (req, res) => {
      const id = req.params.id;
      const email = req.query.email;
      if(email!==req.decoded.email){
        return res.status(403).send({error:true,message:'Forbidden access'})
      }
      const query = { _id: new ObjectId(id) }
      const result = await selectCollection.deleteOne(query);
      res.send(result);
    })
    
    // payment apis
    app.delete('/afterPayment/:id',verifyJWT, async (req, res) => {
      const id = req.params.id;
      const email = req.query.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ error: true, message: 'Forbidden Access' })
      }
      const query = { $and: [{ id:id }, { email:email }] }
      // console.log(id,email);
      const result = await selectCollection.deleteOne(query);
      res.send(result)
    })

    // create a payment intent
    app.get('/paymentHistory/:email',verifyJWT,async(req,res)=>{
      const email = req.params.email;
      if(email!==req.decoded.email){
        res.status(403).send({error:true,message:'Forbidden Access'})
      }
      const query = {email:email}
      const options={sort:{date:-1}}
      const result = await paymentCollection.find(query,options).toArray();
      res.send(result);
    })
    app.post('/createPaymentIntent',verifyJWT, async (req, res) => {
      const { price } = req.body;
      // console.log(price);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: price * 100,
        currency: "usd",
        payment_method_types: ["card"]
      })
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })
    // payment collection
    app.put('/payment',verifyJWT,async(req,res)=>{
      const paymentInfo = req.body.paymentInfo;
      const query = { $and: [{ id: paymentInfo.id }, { email: paymentInfo.email }] }
      const options = { upsert: true }
      const updateDoc = {$set: paymentInfo};
      const result = await paymentCollection.updateOne(query,updateDoc,options);
      res.send(result)
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