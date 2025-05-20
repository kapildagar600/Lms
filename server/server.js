import express from 'express'
import cors from 'cors'
// import 'dotenv/config'
import dotenv from 'dotenv'
import connectDB from './configs/mongodb.js'
import { clerkWebHooks, stripeWebhooks } from './controllers/webhooks.js'
import educatorRouter from './routes/educatorRoutes.js'
import { clerkMiddleware } from '@clerk/express'
import connectCloudinary from './configs/cloudinary.js'
import courseRouter from './routes/courseRoutes.js'
import userRouter from './routes/userRoutes.js'

dotenv.config()

//initialize express
const app = express()
app.post('/stripe',express.raw({type: 'application/json'}),stripeWebhooks)
//connect to database
await connectDB()
await connectCloudinary()

//middleware
app.use(cors())
app.use(clerkMiddleware())

//routes
app.get('/', (req,res)=>{
 res.send('api working fine!!')
})
app.post('/clerk',express.json(),clerkWebHooks)
app.use('/api/educator',express.json(),educatorRouter)
app.use('/api/course',express.json(),courseRouter)
app.use('/api/user',express.json(),userRouter)


//port
const PORT = process.env.PORT || 5000

app.listen(PORT,()=>{
    console.log(`server is running on port ${PORT}`)
})
