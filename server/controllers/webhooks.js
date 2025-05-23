import { Webhook } from "svix";
import User from "../models/User.js";
import Stripe from "stripe";
import { Purchase } from "../models/Purchase.js";
import Course from "../models/Course.js";

//api contoller function to manage clerk data user with database


export const clerkWebHooks =  async (req,res)=>{
    try{
        console.log("hitting webhook")
        const whook = new Webhook(process.env.CLERK_WEBHOOK_SECRET)
        console.log(req.body)

        await whook.verify(JSON.stringify(req.body),{
            "svix-id":req.headers["svix-id"],
            "svix-timestamp":req.headers["svix-timestamp"],
            "svix-signature":req.headers["svix-signature"]
        })
        
        const {data, type} = req.body
        console.log(`Data is ${data}     and    type is ${type}`)

        switch(type){
            case 'user.created':{
                const userData = {
                    _id: data.id,
                    email: data.email_addresses[0].email_address,
                    name:data.first_name + " " + data.last_name,
                    imageUrl:data.image_url
                }
                await User.create(userData)
                res.json({})
                break;
            }
            case 'user.updated': {
                const userData = {
                    email: data.email_address[0].email_address,
                    name:data.first_name + " " + data.last_name,
                    imageUrl:data.image_url
                } 
                await User.findByIdAndUpdate(data.id,userData)
                res.json({})
                break
            }

            case 'user.deleted':{
                await User.findByIdAndDelete(data.id)
                res.json({})
                break;
            }

            default:
                break;
        }
    } catch(error){
        res.json({
            success: false,
            message:error.message
        })
    }
}



export const stripeWebhooks = async (request, response)=>{
  //  console.log('Stripe secret key from env webhooks:',process.env.STRIPE_SECRET_KEY)

    const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY)
    const sig = request.headers['stripe-signature'];

    let event;
  
    try {
      //event = Stripe.webhooks.constructEvent(request.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
      event = Stripe.webhooks.constructEvent(request.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    }
    catch (err) {
      response.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
       case 'checkout.session.completed' :{
         const session = event.data.object;

    const purchaseId = session.metadata.purchaseId;
    const purchaseData = await Purchase.findById(purchaseId);
    if (!purchaseData) return response.status(404).json({ success: false, message: 'Purchase not found' });

    const userData = await User.findById(purchaseData.userId);
    const courseData = await Course.findById(purchaseData.courseId);

          if (!userData || !courseData) {
      return response.status(404).json({ success: false, message: 'User or course not found' });
    }

     if (!userData.enrolledCourses.includes(courseData._id)) {
      userData.enrolledCourses.push(courseData._id);
      await userData.save();
    }

    // Add user to course's enrolledStudents if not already present
    if (!courseData.enrolledStudents.includes(userData._id)) {
      courseData.enrolledStudents.push(userData._id);
      await courseData.save();
    }

      // Update purchase status
    purchaseData.status = 'completed';
    await purchaseData.save();

    break;

       }


        case 'payment_intent.succeeded':{
          const paymentIntent = event.data.object; 
          const paymentIntentId =  paymentIntent.id; 
          
          const session = await stripeInstance.checkout.sessions.list({
            payment_intent:paymentIntentId
          })
          const {purchaseId} = session.data[0].metadata;

          const purchaseData = await Purchase.findById(purchaseId);
          const userData = await User.findById(purchaseData.userId);
          const courseData = await Course.findById(purchaseData.courseId.toString())

          courseData.enrolledStudents.push(userData._id)
          await courseData.save()

          userData.enrolledCourses.push(courseData._id)
          await userData.save()

          purchaseData.status = 'completed'
          await purchaseData.save()
          break;
          
        }
        case 'payment_intent.payment_failed':{
            const paymentIntent = event.data.object; 
            const paymentIntentId =  paymentIntent.id; 
            
            const session = await stripeInstance.checkout.sessions.list({
              payment_intent:paymentIntentId
            })
            const {purchaseId} = session.data[0].metadata;
            const purchaseData = await Purchase.findById(purchaseId);
            purchaseData.status = 'failed'
            await purchaseData.save()
          break;
        }
        // ... handle other event types
        default:
          console.log(`Unhandled event type ${event.type}`);
      }
    
      // Return a response to acknowledge receipt of the event
     return response.status(200).json({received: true});
}